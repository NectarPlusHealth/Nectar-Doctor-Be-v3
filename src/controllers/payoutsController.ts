import { Request, Response } from 'express';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Kyc from '../models/Kyc';
import Wallet from '../models/Wallet';
import Payout from '../models/Payout';
import ChatPayment from '../models/ChatPayment';
import response from '../utils/response';

const COMMISSION_RATE = 0.15;
const MIN_PAYOUT_PAISE = 50000; // ₹500

/**
 * GET /api/v1/payouts/wallet
 * Returns wallet snapshot + KYC summary + eligibility flag.
 * Uses REAL wallet document (zeros if no payouts have been made yet) and real KYC.
 */
export const getPayoutsWallet = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).data?.userId;
    if (!userId) {
      return response.error({ message: 'User unauthorized' }, res, httpStatus.UNAUTHORIZED);
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Fetch real KYC and Wallet (may be null if not yet created)
    const [wallet, kyc] = await Promise.all([
      Wallet.findOne({ userId: userObjectId }),
      Kyc.findOne({ userId: userObjectId }),
    ]);

    const bankObj   = kyc?.bank  || {};
    const panObj    = kyc?.pan   || {};
    const kycStatus = kyc?.kycStatus || kyc?.status || 'not_submitted';

    const pendingBalance = wallet?.pendingBalance ?? 0;
    const eligibleForNextPayout =
      kycStatus === 'verified' && pendingBalance >= MIN_PAYOUT_PAISE;

    // If no wallet record exists yet, also compute lifetime gross from real ChatPayments
    // so the doctor sees their actual earnings even before a Wallet record is created.
    let lifetimeGross = wallet?.lifetimeGross ?? 0;
    if (!wallet) {
      const chatPayments = await ChatPayment.find({
        doctorUserId: userObjectId,
        status: 'success',
      });
      lifetimeGross = chatPayments.reduce(
        (sum, cp) => sum + Math.round(cp.amount * 100),
        0
      );
    }

    const resultKyc = {
      status:          kycStatus,
      beneficiaryName: bankObj.beneficiaryName ?? '',
      bankLast4:       bankObj.bankLast4       ?? '',
      ifsc:            bankObj.ifsc            ?? '',
      nameOnPan:       panObj.nameOnPan        ?? '',
      panLast4:        panObj.panLast4         ?? '',
    };

    const resultWallet = {
      pendingBalance:          wallet?.pendingBalance          ?? 0,
      awaitingKycBalance:      wallet?.awaitingKycBalance      ?? 0,
      paidOutBalance:          wallet?.paidOutBalance          ?? 0,
      tdsDeductedTotal:        wallet?.tdsDeductedTotal        ?? 0,
      lifetimeGross,
      commissionDeductedTotal: wallet?.commissionDeductedTotal ?? 0,
    };

    return response.success(
      {
        message: 'Wallet loaded successfully',
        result: {
          wallet: resultWallet,
          kyc:    resultKyc,
          eligibleForNextPayout,
          minPayoutPaise: MIN_PAYOUT_PAISE,
        },
      },
      res,
      httpStatus.OK
    );
  } catch (err: any) {
    console.error('getPayoutsWallet error:', err);
    return response.error(
      { message: err.message || 'Failed to load payouts wallet' },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * GET /api/v1/payouts/list
 * Returns paginated list of real Payout records (admin-created disbursements).
 * Returns an empty list if no payouts have been processed yet — no dummy data.
 */
export const getPayoutsList = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).data?.userId;
    if (!userId) {
      return response.error({ message: 'User unauthorized' }, res, httpStatus.UNAUTHORIZED);
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const page   = parseInt((req.query.page  as string) || '1');
    const limit  = parseInt((req.query.limit as string) || '20');
    const status = req.query.status as string | undefined;
    const from   = req.query.from   as string | undefined;
    const to     = req.query.to     as string | undefined;

    const query: any = { userId: userObjectId };

    if (status) query.status = status;

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    const [total, payouts] = await Promise.all([
      Payout.countDocuments(query),
      Payout.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    const rows = payouts.map((p) => ({
      _id:                 p._id.toString(),
      id:                  p._id.toString(),
      amount:              p.amount,
      status:              p.status,
      bankName:            p.bankName,
      accountNumberLast4:  p.accountNumberLast4,
      utr:                 p.utr ?? '',
      createdAt:           p.createdAt.toISOString(),
    }));

    const pages = Math.ceil(total / limit) || 1;

    return response.success(
      {
        message: 'Payouts loaded successfully',
        result: { rows, total, pages },
      },
      res,
      httpStatus.OK
    );
  } catch (err: any) {
    console.error('getPayoutsList error:', err);
    return response.error(
      { message: err.message || 'Failed to load payouts list' },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * GET /api/v1/payouts/:id
 * Returns a single payout's details.
 */
export const getPayoutDetail = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).data?.userId;
    if (!userId) {
      return response.error({ message: 'User unauthorized' }, res, httpStatus.UNAUTHORIZED);
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return response.error({ message: 'Invalid payout ID' }, res, httpStatus.BAD_REQUEST);
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const payoutObjectId = new mongoose.Types.ObjectId(id);

    const payout = await Payout.findOne({
      _id: payoutObjectId,
      userId: userObjectId,
    });

    if (!payout) {
      return response.error({ message: 'Payout not found' }, res, httpStatus.NOT_FOUND);
    }

    const resultPayout = {
      _id:                 payout._id.toString(),
      id:                  payout._id.toString(),
      amount:              payout.amount,
      status:              payout.status,
      bankName:            payout.bankName,
      accountNumberLast4:  payout.accountNumberLast4,
      utr:                 payout.utr ?? '',
      createdAt:           payout.createdAt.toISOString(),
      kycSnapshot:         null,
    };

    return response.success(
      {
        message: 'Payout detail loaded successfully',
        result: {
          payout: resultPayout,
        },
      },
      res,
      httpStatus.OK
    );
  } catch (err: any) {
    console.error('getPayoutDetail error:', err);
    return response.error(
      { message: err.message || 'Failed to load payout detail' },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};
