// src/models/Notification.ts
import mongoose, { Document, Schema, Types, Model } from "mongoose";
import constants from "../utils/constant";// ✅ path must match filename exactly

export interface INotification extends Document {
  receiverId: Types.ObjectId[];
  senderId: Types.ObjectId[];
  title: string;
  body?: string | null;
  userType?: number;
  eventType?: number;
  isRead?: boolean;
  isDeleted?: boolean;
  eventId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    receiverId: [{ type: Schema.Types.ObjectId }],
    senderId: [{ type: Schema.Types.ObjectId }],
    title: { type: String, required: true },
    body: { type: String, default: null },
    userType: {
      type: Number,
      enum: Array.isArray(constants.USER_TYPES)
        ? constants.USER_TYPES
        : Object.values(constants.USER_TYPES),
    },
    eventType: {
      type: Number,
      enum: Array.isArray(constants.NOTIFICATION_TYPE)
        ? constants.NOTIFICATION_TYPE
        : Object.values(constants.NOTIFICATION_TYPE),
    },
    isRead: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    eventId: { type: Schema.Types.ObjectId, default: null },
  },
  {
    collection: "notifications",
    timestamps: true,
    versionKey: false,
  }
);

// TTL: auto-delete notifications 7 days after they are created.
// MongoDB's TTL monitor purges these from the database automatically (~once per minute).
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60, name: "notif_ttl_7d" }
);

const NotificationModel: Model<INotification> =
  (mongoose.models.Notification as Model<INotification>) ||
  mongoose.model<INotification>("Notification", notificationSchema);

export default NotificationModel;
export { NotificationModel, notificationSchema };
