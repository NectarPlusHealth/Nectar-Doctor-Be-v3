// src/models/Video.ts
import mongoose, { Document, Schema } from 'mongoose';
import constants from '../utils/constant';

export interface IVideo extends Document {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  isDeleted?: boolean;
  title?: string;
  url?: string;
  userType?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const VideoSchema = new Schema<IVideo>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'users' },
    isDeleted: { type: Boolean, default: false },
    title: { type: String },
    url: { type: String },
    userType: {
      type: Number,
      enum: Object.values(constants.USER_TYPES), // numeric enum values
    },
  },
  { timestamps: true }
);

// Export as named and default (matches your OTP pattern)
export const Video = mongoose.model<IVideo>('Video', VideoSchema);
export default Video;
