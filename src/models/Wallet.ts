import mongoose, { Document, Schema } from 'mongoose';

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  pendingBalance: number; // in paise
  awaitingKycBalance: number; // in paise
  paidOutBalance: number; // in paise
  tdsDeductedTotal: number; // in paise
  lifetimeGross: number; // in paise
  commissionDeductedTotal: number; // in paise
  createdAt?: Date;
  updatedAt?: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    pendingBalance: { type: Number, default: 0 },
    awaitingKycBalance: { type: Number, default: 0 },
    paidOutBalance: { type: Number, default: 0 },
    tdsDeductedTotal: { type: Number, default: 0 },
    lifetimeGross: { type: Number, default: 0 },
    commissionDeductedTotal: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
export default Wallet;
