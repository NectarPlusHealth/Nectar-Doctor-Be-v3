import mongoose, { Document, Schema } from 'mongoose';

export interface IEarningPayment extends Document {
  userId: mongoose.Types.ObjectId;
  patientName: string;
  appointmentDate: Date;
  status: string; // 'paid', 'refunded', 'refund_failed', 'failed'
  amount: number; // in paise
  commission: number; // in paise
  payout: number; // in paise
  refund: number; // in paise
  payoutId: string | null;
  createdAt: Date;
  updatedAt?: Date;
}

const EarningPaymentSchema = new Schema<IEarningPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patientName: { type: String, required: true },
    appointmentDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ['paid', 'refunded', 'refund_failed', 'failed'],
      default: 'paid',
    },
    amount: { type: Number, required: true },
    commission: { type: Number, required: true },
    payout: { type: Number, required: true },
    refund: { type: Number, default: 0 },
    payoutId: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const EarningPayment = mongoose.model<IEarningPayment>('EarningPayment', EarningPaymentSchema);
export default EarningPayment;
