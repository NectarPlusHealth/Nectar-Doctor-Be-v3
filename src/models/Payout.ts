import mongoose, { Document, Schema } from 'mongoose';

export interface IPayout extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number; // in paise
  status: string; // 'queued', 'processing', 'processed', 'failed', 'reversed', 'cancelled'
  bankName: string;
  accountNumberLast4: string;
  utr: string | null;
  createdAt: Date;
  updatedAt?: Date;
}

const PayoutSchema = new Schema<IPayout>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      required: true,
      enum: ['queued', 'processing', 'processed', 'failed', 'reversed', 'cancelled'],
      default: 'processed',
    },
    bankName: { type: String, required: true },
    accountNumberLast4: { type: String, required: true },
    utr: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const Payout = mongoose.model<IPayout>('Payout', PayoutSchema);
export default Payout;
