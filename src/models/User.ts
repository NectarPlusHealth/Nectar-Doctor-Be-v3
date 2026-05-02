// src/models/User.ts
import mongoose, { Document, Schema } from 'mongoose';
import  constants from '../utils/constant';  
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;

  password?: string;
  fullName?: string;
  phone?: string;
  countryCode?: string;

  userType: number[];

  isDeleted: boolean;
  status: number;

  createdBy?: mongoose.Types.ObjectId;
  modifiedBy?: mongoose.Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    password: {
      type: String,
    },

    fullName: {
      type: String,
      // required: true,
    },

    phone: {
      type: String,
      // required: true,
    },

    countryCode: {
      type: String,
      default: '+91',
    },

    userType: [
      {
        type: Number,
        enum: constants.USER_TYPES,
      },
    ],

    isDeleted: {
      type: Boolean,
      default: false,
    },

    status: {
      type: Number,
      default: 2,
      // default: constants.PROFILE_STATUS.ACTIVE,
      enum: constants.PROFILE_STATUS,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Register with both 'User' and 'users' to support population by both names
export const User = mongoose.model<IUser>('User', UserSchema);
export const UserPlural = mongoose.model<IUser>('users', UserSchema);
export default User;
