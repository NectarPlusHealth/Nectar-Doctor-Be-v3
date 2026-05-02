// src/models/DoctorGoogleAccount.ts
import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * Stores per-doctor Google OAuth credentials.
 * The doctor connects their personal/Workspace Google account once;
 * we keep the long-lived `refreshToken` and use it to mint short-lived
 * access tokens whenever we need to create a Meet link via Calendar API.
 */
export interface IDoctorGoogleAccount extends Document {
  userId: Types.ObjectId;
  email?: string | null;
  refreshToken: string;
  accessToken?: string | null;
  expiresAt?: Date | null;
  scope?: string | null;
  connectedAt: Date;
  updatedAt?: Date;
  createdAt?: Date;
}

const DoctorGoogleAccountSchema = new Schema<IDoctorGoogleAccount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true,
      index: true,
    },
    email: { type: String, default: null },
    refreshToken: { type: String, required: true },
    accessToken: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    scope: { type: String, default: null },
    connectedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, versionKey: false }
);

const MODEL_NAME = "doctor_google_accounts";
const DoctorGoogleAccountModel =
  (mongoose.models &&
    (mongoose.models[MODEL_NAME] as mongoose.Model<IDoctorGoogleAccount>)) ||
  mongoose.model<IDoctorGoogleAccount>(MODEL_NAME, DoctorGoogleAccountSchema);

export default DoctorGoogleAccountModel;
