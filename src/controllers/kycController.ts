import { Request, Response } from 'express';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import sharp from 'sharp';
import Kyc from '../models/Kyc';
import Wallet from '../models/Wallet';
import response from '../utils/response';
import { imageUpload } from '../utils/imageUpload';

/**
 * GET /api/v1/kyc/me
 * Returns the logged-in doctor's KYC status + wallet snapshot.
 * Returns sensible defaults (not_submitted / null) if no KYC record exists yet.
 */
export const getKycMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).data?.userId;
    if (!userId) {
      return response.error({ message: 'User unauthorized' }, res, httpStatus.UNAUTHORIZED);
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const [kyc, wallet] = await Promise.all([
      Kyc.findOne({ userId: userObjectId }),
      Wallet.findOne({ userId: userObjectId }),
    ]);

    const bankObj = kyc?.bank || {};
    const panObj  = kyc?.pan  || {};
    const gstObj  = kyc?.gst  || {};

    // aadhaar is stored as a plain string in the DB.
    // We ALWAYS return it as an object { last4: string } or null,
    // so the Flutter side can safely cast it as Map<String,dynamic>?.
    let aadhaarObj: { last4: string } | null = null;
    if (kyc?.aadhaar) {
      const raw = kyc.aadhaar.toString().replace(/\s/g, '');
      aadhaarObj = { last4: raw.length > 4 ? raw.slice(-4) : raw };
    }

    const resultKyc = {
      bank: {
        ifsc:               bankObj.ifsc               ?? '',
        beneficiaryName:    bankObj.beneficiaryName    ?? '',
        accountType:        bankObj.accountType        ?? 'savings',
        bankLast4:          bankObj.bankLast4          ?? '',
        cancelledChequeUrl: bankObj.cancelledChequeUrl ?? kyc?.cancelledChequeUrl ?? null,
      },
      pan: {
        nameOnPan: panObj.nameOnPan ?? '',
        panLast4:  panObj.panLast4  ?? '',
      },
      gst: {
        gstin:     gstObj.gstin     ?? '',
        legalName: gstObj.legalName ?? '',
      },
      // Always null or { last4: '...' } — never a raw string
      aadhaar:        aadhaarObj,
      cancelledChequeUrl: bankObj.cancelledChequeUrl ?? kyc?.cancelledChequeUrl ?? null,
      kycStatus:      kyc?.kycStatus || kyc?.status || 'not_submitted',
      status:         kyc?.status    || 'not_submitted',
      rejectionReason: kyc?.rejectionReason ?? null,
    };

    const resultWallet = wallet
      ? {
          pendingBalance:     wallet.pendingBalance,
          awaitingKycBalance: wallet.awaitingKycBalance,
          paidOutBalance:     wallet.paidOutBalance,
          tdsDeductedTotal:   wallet.tdsDeductedTotal,
        }
      : null;

    return response.success(
      {
        message: 'KYC loaded successfully',
        result: {
          kyc:    resultKyc,
          wallet: resultWallet,
        },
      },
      res,
      httpStatus.OK
    );
  } catch (err: any) {
    console.error('getKycMe error:', err);
    return response.error(
      { message: err.message || 'Failed to load KYC status' },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * POST /api/v1/kyc/submit
 * Create or update the doctor's KYC record.
 */
export const submitKyc = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).data?.userId;
    if (!userId) {
      return response.error({ message: 'User unauthorized' }, res, httpStatus.UNAUTHORIZED);
    }

    const {
      pan,
      nameOnPan,
      accountNumber,
      ifsc,
      beneficiaryName,
      accountType,
      gstin,
      gstLegalName,
      aadhaar,
    } = req.body;

    if (!pan || !nameOnPan || !accountNumber || !ifsc || !beneficiaryName) {
      return response.error(
        { message: 'Missing required fields: pan, nameOnPan, accountNumber, ifsc, beneficiaryName' },
        res,
        httpStatus.BAD_REQUEST
      );
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const existingKyc = await Kyc.findOne({ userId: userObjectId });

    const bankLast4 = accountNumber.length > 4
      ? accountNumber.slice(-4)
      : accountNumber;
    const panLast4  = pan.length > 4 ? pan.slice(-4) : pan;

    const updateData: any = {
      userId: userObjectId,
      bank: {
        accountNumber,
        ifsc:            ifsc.toUpperCase(),
        beneficiaryName,
        accountType:     accountType || 'savings',
        cancelledChequeUrl: existingKyc?.bank?.cancelledChequeUrl ?? existingKyc?.cancelledChequeUrl ?? null,
        bankLast4,
      },
      pan: {
        panNumber:  pan.toUpperCase(),
        nameOnPan,
        panLast4,
      },
      gst: {
        gstin:     gstin      || null,
        legalName: gstLegalName || null,
      },
      aadhaar:         aadhaar || null,
      cancelledChequeUrl: existingKyc?.bank?.cancelledChequeUrl ?? existingKyc?.cancelledChequeUrl ?? null,
      status:          'submitted',
      kycStatus:       'submitted',
      rejectionReason: null,
    };

    let savedKyc: any;
    if (existingKyc) {
      savedKyc = await Kyc.findOneAndUpdate({ userId: userObjectId }, updateData, { new: true });
    } else {
      savedKyc = await Kyc.create(updateData);
    }

    // Build the aadhaar object the same way getKycMe does
    let aadhaarObj: { last4: string } | null = null;
    if (savedKyc?.aadhaar) {
      const raw = savedKyc.aadhaar.toString().replace(/\s/g, '');
      aadhaarObj = { last4: raw.length > 4 ? raw.slice(-4) : raw };
    }

    const resultKyc = {
      bank: {
        ifsc:               savedKyc?.bank?.ifsc               ?? '',
        beneficiaryName:    savedKyc?.bank?.beneficiaryName    ?? '',
        accountType:        savedKyc?.bank?.accountType        ?? 'savings',
        bankLast4:          savedKyc?.bank?.bankLast4          ?? '',
        cancelledChequeUrl: savedKyc?.bank?.cancelledChequeUrl ?? savedKyc?.cancelledChequeUrl ?? null,
      },
      pan: {
        nameOnPan: savedKyc?.pan?.nameOnPan ?? '',
        panLast4:  savedKyc?.pan?.panLast4  ?? '',
      },
      gst: {
        gstin:     savedKyc?.gst?.gstin     ?? '',
        legalName: savedKyc?.gst?.legalName ?? '',
      },
      aadhaar:         aadhaarObj,
      cancelledChequeUrl: savedKyc?.bank?.cancelledChequeUrl ?? savedKyc?.cancelledChequeUrl ?? null,
      kycStatus:       savedKyc?.kycStatus || savedKyc?.status || 'submitted',
      status:          savedKyc?.status    || 'submitted',
      rejectionReason: savedKyc?.rejectionReason ?? null,
    };

    return response.success(
      {
        message: 'KYC submitted successfully',
        result: resultKyc,
      },
      res,
      httpStatus.OK
    );
  } catch (err: any) {
    console.error('submitKyc error:', err);
    return response.error(
      { message: err.message || 'Failed to submit KYC' },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * POST /api/v1/kyc/upload-cheque
 * Upload a cancelled cheque image and attach its URL to the KYC record.
 */
export const uploadCheque = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).data?.userId;
    if (!userId) {
      return response.error({ message: 'User unauthorized' }, res, httpStatus.UNAUTHORIZED);
    }

    if (!req.files || !('file' in req.files)) {
      return response.error({ message: 'Missing file' }, res, httpStatus.BAD_REQUEST);
    }

    const file = (req.files as { [fieldname: string]: Express.Multer.File[] }).file[0];

    // Resize large images before upload
    if (file.mimetype.startsWith('image/') && file.size > 1024 * 1024) {
      file.buffer = await sharp(file.buffer)
        .resize({ fit: 'inside', width: 800, height: 800 })
        .toBuffer();
    }

    const uploadedUrl = await imageUpload(file, 'cancelled-cheques');

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const existingKyc = await Kyc.findOne({ userId: userObjectId });

    if (!existingKyc) {
      await Kyc.create({
        userId: userObjectId,
        bank: { cancelledChequeUrl: uploadedUrl },
        cancelledChequeUrl: uploadedUrl,
      });
    } else {
      if (!existingKyc.bank) existingKyc.bank = {};
      existingKyc.bank.cancelledChequeUrl = uploadedUrl;
      existingKyc.cancelledChequeUrl = uploadedUrl;
      await existingKyc.save();
    }

    return response.success(
      {
        message: 'Cheque uploaded successfully',
        result:  { url: uploadedUrl },
      },
      res,
      httpStatus.OK
    );
  } catch (err: any) {
    console.error('uploadCheque error:', err);
    return response.error(
      { message: err.message || 'Failed to upload cheque' },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};
