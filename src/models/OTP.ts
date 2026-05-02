// src/models/OTP.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IOTP extends Document {
  _id: mongoose.Types.ObjectId;
  otp: string;
  phone: string;
  userType: number;
  createdAt?: Date;
  expiresAt?: Date | null;
}

const OTPSchema = new Schema<IOTP>({
  otp: { type: String, required: true },
  phone: { type: String, required: true },
  userType: { type: Number, required: true },
  expiresAt: { type: Date, default: null },
}, { timestamps: true });

export const OTP = mongoose.model<IOTP>('OTP', OTPSchema);
export default OTP;
