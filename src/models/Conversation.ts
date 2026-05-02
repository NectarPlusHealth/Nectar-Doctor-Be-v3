// src/models/Conversation.ts
import mongoose, { Document, Schema, Types, Model } from "mongoose";

export interface IConversationParticipant {
  userId: Types.ObjectId;
  userType: number; // 1 = patient, 2 = doctor (constants.USER_TYPES)
}

export interface IConversation extends Document {
  participants: IConversationParticipant[];
  /** Sorted "<idA>_<idB>" string used as a uniqueness key for the pair */
  pairKey: string;
  lastMessage?: {
    body: string;
    senderId: Types.ObjectId;
    createdAt: Date;
  } | null;
  /** Per-user unread counter keyed by userId string */
  unread: Map<string, number>;
  /**
   * Patient chat window. Patients can only send messages until this date;
   * after that they must pay to extend (doctors are not blocked).
   * Defaults to createdAt + 7 days.
   */
  chatExpiresAt?: Date;
  /** Timestamp of the last pre-expiry notification dispatched for this conversation */
  preExpiryNotifiedAt?: Date | null;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: [
      {
        userId: { type: Schema.Types.ObjectId, required: true },
        userType: { type: Number, required: true },
        _id: false,
      },
    ],
    pairKey: { type: String, required: true, unique: true, index: true },
    lastMessage: {
      type: new Schema(
        {
          body: { type: String, required: true },
          senderId: { type: Schema.Types.ObjectId, required: true },
          createdAt: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    unread: {
      type: Map,
      of: Number,
      default: () => new Map<string, number>(),
    },
    chatExpiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    preExpiryNotifiedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  {
    collection: "conversations",
    timestamps: true,
    versionKey: false,
  }
);

conversationSchema.index({ "participants.userId": 1, updatedAt: -1 });

const ConversationModel: Model<IConversation> =
  (mongoose.models.Conversation as Model<IConversation>) ||
  mongoose.model<IConversation>("Conversation", conversationSchema);

export default ConversationModel;
export { ConversationModel, conversationSchema };
