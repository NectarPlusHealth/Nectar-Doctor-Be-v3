// src/models/ChatPayment.ts
import mongoose, { Document, Schema, Types, Model } from "mongoose";

export interface IChatPayment extends Document {
  conversationId: Types.ObjectId;
  patientUserId: Types.ObjectId;
  doctorUserId?: Types.ObjectId | null;
  amount: number; // INR
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  /** chatExpiresAt value AFTER this payment was applied */
  extendedTo: Date;
  status: "success";
  createdAt?: Date;
  updatedAt?: Date;
}

const chatPaymentSchema = new Schema<IChatPayment>(
  {
    conversationId: { type: Schema.Types.ObjectId, required: true, index: true },
    patientUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    doctorUserId: { type: Schema.Types.ObjectId, default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String, required: true, unique: true },
    razorpaySignature: { type: String, required: true },
    extendedTo: { type: Date, required: true },
    status: { type: String, enum: ["success"], default: "success" },
  },
  {
    collection: "chat_payments",
    timestamps: true,
    versionKey: false,
  }
);

chatPaymentSchema.index({ conversationId: 1, createdAt: -1 });

const ChatPaymentModel: Model<IChatPayment> =
  (mongoose.models.ChatPayment as Model<IChatPayment>) ||
  mongoose.model<IChatPayment>("ChatPayment", chatPaymentSchema);

export default ChatPaymentModel;
export { ChatPaymentModel, chatPaymentSchema };
