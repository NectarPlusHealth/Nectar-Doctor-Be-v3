// src/models/Message.ts
import mongoose, { Document, Schema, Types, Model } from "mongoose";

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderType: number;
  body: string;
  isRead: boolean;
  readAt?: Date | null;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    senderType: { type: Number, required: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  {
    collection: "messages",
    timestamps: true,
    versionKey: false,
  }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

const MessageModel: Model<IMessage> =
  (mongoose.models.Message as Model<IMessage>) ||
  mongoose.model<IMessage>("Message", messageSchema);

export default MessageModel;
export { MessageModel, messageSchema };
