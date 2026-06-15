import { Request, Response } from 'express';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Wallet from '../models/Wallet';
import EarningPayment from '../models/EarningPayment';
import ChatPayment from '../models/ChatPayment';
import User from '../models/User';
import response from '../utils/response';

// Commission rate applied on each payment (15%)
const COMMISSION_RATE = 0.15;
// TDS rate applied on net payout (10%)
const TDS_RATE = 0.10;

/**
 * GET /api/v1/earnings/summary
 * Returns KPI tiles + wallet snapshot for the logged-in doctor.
 * KPIs are derived from REAL ChatPayment records where doctorUserId matches.
 */
export const getEarningsSummary = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).data?.userId;
    if (!userId) {
      return response.error({ message: 'User unauthorized' }, res, httpStatus.UNAUTHORIZED);
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const from = req.query.from as string;
    const to   = req.query.to   as string;

    // ── Build date filter ────────────────────────────────────────────────────
    const dateFilter: any = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = toDate;
      }
    }

    // ── Fetch real ChatPayments for this doctor ───────────────────────────────
    const chatPayments = await ChatPayment.find({
      doctorUserId: userObjectId,
      status: 'success',
      ...dateFilter,
    });

    // ── Compute KPIs from real payments (amounts are in INR, convert to paise) ──
    let grossEarnedPaise = 0;
    let paidCount = 0;
    let commissionPaise = 0;
    let netPayoutEarnedPaise = 0;

    for (const cp of chatPayments) {
      const grossPaise = Math.round(cp.amount * 100); // ChatPayment.amount is INR
      const commPaise  = Math.round(grossPaise * COMMISSION_RATE);
      const netPaise   = grossPaise - commPaise;
      grossEarnedPaise     += grossPaise;
      commissionPaise      += commPaise;
      netPayoutEarnedPaise += netPaise;
      paidCount++;
    }

    // ── Also include EarningPayment records (manually created payouts) ───────
    const earningsQuery: any = { userId: userObjectId, ...dateFilter };
    const earningPayments = await EarningPayment.find(earningsQuery);

    let refundedAmountPaise = 0;
    let refundedCount = 0;

    for (const ep of earningPayments) {
      if (ep.status === 'paid') {
        grossEarnedPaise     += ep.amount;
        commissionPaise      += ep.commission;
        netPayoutEarnedPaise += ep.payout;
        paidCount++;
      } else if (ep.status === 'refunded') {
        refundedAmountPaise += ep.refund;
        refundedCount++;
      }
    }

    // ── Wallet (real balances or zeros) ──────────────────────────────────────
    const wallet = await Wallet.findOne({ userId: userObjectId });

    const resultKpis = {
      grossEarned:      grossEarnedPaise,
      paidCount,
      commission:       commissionPaise,
      netPayoutEarned:  netPayoutEarnedPaise,
      refundedAmount:   refundedAmountPaise,
      refundedCount,
    };

    const resultWallet = {
      pendingBalance:          wallet?.pendingBalance          ?? 0,
      awaitingKycBalance:      wallet?.awaitingKycBalance      ?? 0,
      paidOutBalance:          wallet?.paidOutBalance          ?? 0,
      lifetimeGross:           wallet?.lifetimeGross           ?? grossEarnedPaise,
      tdsDeductedTotal:        wallet?.tdsDeductedTotal        ?? 0,
      commissionDeductedTotal: wallet?.commissionDeductedTotal ?? commissionPaise,
    };

    return response.success(
      {
        message: 'Earnings summary loaded successfully',
        result: {
          kpis:   resultKpis,
          wallet: resultWallet,
        },
      },
      res,
      httpStatus.OK
    );
  } catch (err: any) {
    console.error('getEarningsSummary error:', err);
    return response.error(
      { message: err.message || 'Failed to load earnings summary' },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * GET /api/v1/earnings/payments
 * Returns a paginated list of payment rows (real ChatPayments + EarningPayments).
 */
export const getEarningsPayments = async (req: Request, res: Response) => {
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

    const dateFilter: any = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = toDate;
      }
    }

    // ── Build rows from ChatPayments (real data) ─────────────────────────────
    const chatFilter: any = { doctorUserId: userObjectId, status: 'success', ...dateFilter };
    const chatPaymentsAll = await ChatPayment.find(chatFilter).sort({ createdAt: -1 });

    // Map to a common payment row shape
    const chatRows = await Promise.all(
      chatPaymentsAll.map(async (cp) => {
        const grossPaise = Math.round(cp.amount * 100);
        const commPaise  = Math.round(grossPaise * COMMISSION_RATE);
        const netPaise   = grossPaise - commPaise;

        // Try to get patient name from User collection
        let patientName = 'Patient';
        try {
          const user = await User.findById(cp.patientUserId).select('fullName');
          if (user?.fullName) patientName = user.fullName;
        } catch (_) {}

        return {
          createdAt:   cp.createdAt?.toISOString() ?? new Date().toISOString(),
          patient:     { fullName: patientName },
          appointment: { date: cp.extendedTo?.toISOString() ?? cp.createdAt?.toISOString() },
          status:      'paid' as const,
          amount:      grossPaise,
          commission:  commPaise,
          payout:      netPaise,
          refund:      0,
          payoutId:    '',
        };
      })
    );

    // ── Also include EarningPayment records ──────────────────────────────────
    const epQuery: any = { userId: userObjectId, ...dateFilter };
    if (status) epQuery.status = status;
    const earningPayments = await EarningPayment.find(epQuery).sort({ createdAt: -1 });

    const epRows = earningPayments.map((ep) => ({
      createdAt:   ep.createdAt.toISOString(),
      patient:     { fullName: ep.patientName },
      appointment: { date: ep.appointmentDate.toISOString() },
      status:      ep.status,
      amount:      ep.amount,
      commission:  ep.commission,
      payout:      ep.payout,
      refund:      ep.refund ?? 0,
      payoutId:    ep.payoutId ?? '',
    }));

    // ── Merge and filter ─────────────────────────────────────────────────────
    let allRows = [...chatRows, ...epRows];
    if (status) allRows = allRows.filter(r => r.status === status);
    allRows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = allRows.length;
    const pages = Math.ceil(total / limit) || 1;
    const rows  = allRows.slice((page - 1) * limit, page * limit);

    return response.success(
      {
        message: 'Payments loaded successfully',
        result: { rows, total, pages },
      },
      res,
      httpStatus.OK
    );
  } catch (err: any) {
    console.error('getEarningsPayments error:', err);
    return response.error(
      { message: err.message || 'Failed to load payments list' },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};
