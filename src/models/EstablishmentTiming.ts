import { Schema, model, Document, Types } from 'mongoose';
import constants from '../utils/constant';

export interface IEstablishmentTiming extends Document {
  doctorId?: Types.ObjectId;
  hospitalId?: Types.ObjectId;
  establishmentId?: Types.ObjectId;
  establishmentProof?: { url?: string; fileType?: string; urlType?: string }[];
  isOwner: boolean;
  slotTime: number;
  specility?: Types.ObjectId[];
  procedure?: Types.ObjectId[];
  mon?: { slot?: string; from?: string; to?: string }[];
  tue?: { slot?: string; from?: string; to?: string }[];
  wed?: { slot?: string; from?: string; to?: string }[];
  thu?: { slot?: string; from?: string; to?: string }[];
  fri?: { slot?: string; from?: string; to?: string }[];
  sat?: { slot?: string; from?: string; to?: string }[];
  sun?: { slot?: string; from?: string; to?: string }[];
  isVerified: number;
  rejectReason?: string;
  consultationFees?: number;
  videoConsultationFees?: number;
  addedFor: number;
  createdBy?: Types.ObjectId;
  modifiedBy?: Types.ObjectId;
  isDeleted: boolean;
  isActive: boolean;
}

const establishmentTimingSchema = new Schema<IEstablishmentTiming>(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: 'doctors' },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'hospitals' },
    establishmentId: { type: Schema.Types.ObjectId, ref: 'establishmentmasters' },
    establishmentProof: [{ url: { type: String, default: null }, fileType: { type: String, default: null }, urlType: { type: String, default: null } }],
    isOwner: { type: Boolean, default: false },
    slotTime: { type: Number, default: 15 },
    specility: [{ type: Schema.Types.ObjectId, ref: 'specializations', default: null }],
    procedure: [{ type: Schema.Types.ObjectId, ref: 'proceduremasters', default: null }],
    mon: [{ slot: String, from: String, to: String }],
    tue: [{ slot: String, from: String, to: String }],
    wed: [{ slot: String, from: String, to: String }],
    thu: [{ slot: String, from: String, to: String }],
    fri: [{ slot: String, from: String, to: String }],
    sat: [{ slot: String, from: String, to: String }],
    sun: [{ slot: String, from: String, to: String }],
    isVerified: { type: Number, enum: Object.values(constants.PROFILE_STATUS), default: constants.PROFILE_STATUS.PENDING },
    rejectReason: String,
    consultationFees: Number,
    videoConsultationFees: Number,
    addedFor: { type: Number, enum: [constants.USER_TYPES.DOCTOR, constants.USER_TYPES.HOSPITAL] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'users' },
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

export const EstablishmentTiming = model<IEstablishmentTiming>('establishmenttimings', establishmentTimingSchema);
export default EstablishmentTiming;
