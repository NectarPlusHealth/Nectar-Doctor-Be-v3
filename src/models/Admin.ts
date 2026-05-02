// src/models/admin.model.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import constants from "../utils/constant";
import { genUUID } from "../utils/common";
import { getUserDB } from '../config/database';  // adjust path if needed

// Use the database connection accessor similar to your JS code
const db = getUserDB(); // make sure getUserDB() returns a mongoose.Connection

// ---------- TypeScript interfaces ----------

// Attributes required to create a new Admin
export interface AdminAttrs {
  fullName: string;
  phone: string;
  countryCode?: string;
  email: string;
  password: string;
  profilePic?: string;
  isDeleted?: boolean;
  userType?: number;
  status?: number;
  createdBy?: Types.ObjectId | string | null;
  modifiedBy?: Types.ObjectId | string | null;
}

// Mongoose Document (instance) with mongoose Document fields
export interface AdminDoc extends Document {
  fullName: string;
  phone: string;
  countryCode: string;
  email: string;
  password: string;
  profilePic?: string;
  isDeleted: boolean;
  userType: number;
  status: number;
  createdBy?: Types.ObjectId | string | null;
  modifiedBy?: Types.ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Model (static) interface: add build for type-safe creation if desired
export interface AdminModel extends Model<AdminDoc> {
  build(attrs: AdminAttrs): AdminDoc;
}

// ---------- Schema ----------

const adminSchema = new Schema<AdminDoc, AdminModel>(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    countryCode: { type: String, default: '+91' },
    email: { type: String, required: true },
    password: { type: String, required: true },
    profilePic: { type: String },
    isDeleted: { type: Boolean, default: false },
    userType: { type: Number, default: constants.USER_TYPES.ADMIN },
    status: { type: Number, default: constants.PROFILE_STATUS.ACTIVE },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', required: false },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'users', required: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Optional: add a static helper to enforce attribute typing on creation
adminSchema.statics.build = function (attrs: AdminAttrs) {
  return new Admin(attrs);
};

// ---------- Model ----------
// Use the same connection as your original file (db.model)
const Admin = (db && (db as mongoose.Connection).model<AdminDoc, AdminModel>('admin', adminSchema)) ||
  mongoose.model<AdminDoc, AdminModel>('admin', adminSchema);

export default Admin;
export { Admin as AdminModel };
