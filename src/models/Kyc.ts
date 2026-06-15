import mongoose, { Document, Schema } from 'mongoose';

export interface IKyc extends Document {
  userId: mongoose.Types.ObjectId;
  bank?: {
    accountNumber?: string;
    ifsc?: string;
    beneficiaryName?: string;
    accountType?: string;
    cancelledChequeUrl?: string;
    bankLast4?: string;
  };
  pan?: {
    panNumber?: string;
    nameOnPan?: string;
    panLast4?: string;
  };
  gst?: {
    gstin?: string;
    legalName?: string;
  };
  aadhaar?: string;
  cancelledChequeUrl?: string;
  status: string; // 'verified' | 'rejected' | 'submitted' | 'manual_review' | 'not_submitted'
  kycStatus: string;
  rejectionReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const KycSchema = new Schema<IKyc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    bank: {
      accountNumber: { type: String, default: null },
      ifsc: { type: String, default: null },
      beneficiaryName: { type: String, default: null },
      accountType: { type: String, default: 'savings' },
      cancelledChequeUrl: { type: String, default: null },
      bankLast4: { type: String, default: null },
    },
    pan: {
      panNumber: { type: String, default: null },
      nameOnPan: { type: String, default: null },
      panLast4: { type: String, default: null },
    },
    gst: {
      gstin: { type: String, default: null },
      legalName: { type: String, default: null },
    },
    aadhaar: { type: String, default: null },
    cancelledChequeUrl: { type: String, default: null },
    status: {
      type: String,
      default: 'not_submitted',
      enum: ['verified', 'rejected', 'submitted', 'manual_review', 'not_submitted'],
    },
    kycStatus: {
      type: String,
      default: 'not_submitted',
      enum: ['verified', 'rejected', 'submitted', 'manual_review', 'not_submitted'],
    },
    rejectionReason: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const Kyc = mongoose.model<IKyc>('Kyc', KycSchema);
export default Kyc;
