import { Schema, model, Document, Types } from 'mongoose';
import constants from '../utils/constant';

import '../models/User';

export interface IPatient extends Document {
  steps: number;
  isVerified: number;
  userId: Types.ObjectId;
  languagePreference: number;
  email?: string | null;
  gender?: number;
  isDeleted: boolean;
  dob?: Date | null;
  bloodGroup?: number | null;
  address?: {
    houseNo?: string | null;
    landmark?: string | null;
    locality?: string | null;
    city?: string | null;
    state?: Types.ObjectId | null;
    pincode?: string | null;
    country?: string;
  };
  profilePic?: string | null;
  createdBy?: Types.ObjectId | null;
  modifiedBy?: Types.ObjectId | null;
}

const patientSchema = new Schema<IPatient>(
  {
    steps: { type: Number, enum: Object.values(constants.PROFILE_STEPS), default: constants.PROFILE_STEPS.COMPLETED },
    isVerified: { type: Number, enum: Object.values(constants.PROFILE_STATUS), default: constants.PROFILE_STATUS.APPROVE },
    userId: { type: Schema.Types.ObjectId, ref: 'users' },
    languagePreference: { type: Number, enum: Object.values(constants.LANGUAGES_SUPPORTED), default: constants.LANGUAGES_SUPPORTED.ENGLISH },
    email: { type: String, default: null },
    gender: { type: Number, enum: Object.values(constants.GENDER) },
    isDeleted: { type: Boolean, default: false },
    dob: { type: Date, default: null },
    bloodGroup: { type: Number, enum: Object.values(constants.BLOOD_GROUP), default: null },
    address: {
      houseNo: String,
      landmark: String,
      locality: String,
      city: String,
      state: { type: Schema.Types.ObjectId, ref: 'statemasters', default: null },
      pincode: String,
      country: { type: String, default: 'India' },
    },
    profilePic: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
  },
  { timestamps: true, versionKey: false }
);

export const Patient = model<IPatient>('patients', patientSchema);
export default Patient;
