import { Schema, model, Document, Types } from 'mongoose';
import constants from '../utils/constant';

export interface ISession extends Document {
  userId: Types.ObjectId;
  jwt: string;
  deviceId: string;
  deviceToken?: string;
  deviceType: string;
  browser?: string;
  os?: string;
  osVersion?: string;
  tokenType: number;
  isDeleted: boolean;
}

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
    jwt: { type: String, required: true },
    deviceId: { type: String, required: true },
    deviceToken: String,
    deviceType: { type: String, required: true },
    browser: String,
    os: String,
    osVersion: String,
    tokenType: { type: Number, default: constants.TOKEN_TYPE.APPOINTMENT },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

export const Session = model<ISession>('sessions', sessionSchema);
export default Session;
