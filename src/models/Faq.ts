import { Schema, model, Document, Types } from "mongoose";
import constants from "../utils/constant";
import db from "../config/database"; // assuming `getUserDB()` is default export

// ================================
// FAQ Interface
// ================================
export interface IFAQ extends Document {
  question: string;
  answer: string;
  userType: number;
  isDeleted: boolean;
  userId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ================================
// FAQ Schema
// ================================
const faqSchema = new Schema<IFAQ>(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
    userType: {
      type: Number,
      enum: Object.values(constants.USER_TYPES),
      default: constants.USER_TYPES.PATIENT,
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ================================
// Model Export
// ================================
const FAQ = db.getUserDB().model<IFAQ>("faqs", faqSchema);

export default FAQ;
