// src/models/Doctor.ts
import mongoose, { Document, Schema } from 'mongoose';
import constants from '../utils/constant';
import '../models/Specialization';
import '../models/User';

export interface IMedicalRegistration {
  registrationNumber?: string;
  council?: string;
  year?: string;
}

export interface IEducation {
  degree?: string;
  college?: string;
  year?: string;
}

export interface IAward {
  name?: string;
  year?: string;
}

export interface IMembership {
  name?: string;
}

export interface ICertification {
  name?: string;
}

export interface ISocial {
  socialMediaId?: mongoose.Types.ObjectId;
  url?: string;
}

export interface IService {
  name?: string;
  isSurgery?: boolean | null;
}

export interface IProof {
  url?: string;
  fileType?: string;
  urlType?: string;
}

export interface IConsultationDetails {
  isVideo?: boolean;
  isInClinic?: boolean;
}

export interface IDoctor extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  specialization?: mongoose.Types.ObjectId[];
  email?: string | null;
  gender?: number;
  city?: string | null;
  state?: string | null;
  isOwnEstablishment?: boolean;
  medicalRegistration?: IMedicalRegistration[];
  education?: IEducation[];
  award?: IAward[];
  membership?: IMembership[];
  certifications?: ICertification[];
  social?: ISocial[];
  service?: IService[];
  experience?: string | null;
  identityProof?: IProof[];
  medicalProof?: IProof[];
  establishmentProof?: IProof[];
  profilePic?: string;
  about?: string | null;
  publicUrl?: string | null;
  isDeleted?: boolean;
  totalreviews?: number;
  rating?: number;
  recommended?: number;
  waitTime?: number;
  createdBy?: mongoose.Types.ObjectId;
  status?: number;
  isVerified?: number;
  rejectReason?: string;
  steps?: number;
  profileScreen?: number;
  procedure?: mongoose.Types.ObjectId[];
  profileSlug?: string;
  consultationType?: string;
  consultationDetails?: IConsultationDetails;
  createdAt?: Date;
  updatedAt?: Date;
}

const MedicalRegistrationSchema = new Schema<IMedicalRegistration>({
  registrationNumber: { type: String, default: null },
  council: { type: String, default: null },
  year: { type: String, default: null },
}, { _id: false });

// NOTE: keep default _id: true so edit/delete by _id works for existing rows
const EducationSchema = new Schema<IEducation>({
  degree: { type: String, default: null },
  college: { type: String, default: null },
  year: { type: String, default: null },
});

// NOTE: keep default _id: true so edit/delete by _id works for existing rows
const AwardSchema = new Schema<IAward>({
  name: { type: String },
  year: { type: String, default: null },
});

// NOTE: keep default _id: true so edit/delete by _id works for existing rows
const MembershipSchema = new Schema<IMembership>({
  name: { type: String, default: null },
});

const CertificationSchema = new Schema<ICertification>({
  name: { type: String, default: null },
});

// NOTE: keep default _id: true so edit/delete by _id works for existing rows
const SocialSchema = new Schema<ISocial>({
  socialMediaId: { type: Schema.Types.ObjectId, ref: 'SocialMedia', default: null },
  url: { type: String, default: null },
});

const ServiceSchema = new Schema<IService>({
  name: { type: String, default: null },
  isSurgery: { type: Boolean, default: null },
}, { _id: false });

const ProofSchema = new Schema<IProof>({
  url: { type: String, default: null },
  fileType: { type: String, default: null },
  urlType: { type: String, default: null },
}, { _id: false });

const ConsultationDetailsSchema = new Schema<IConsultationDetails>({
  isVideo: { type: Boolean },
  isInClinic: { type: Boolean },
}, { _id: false });

const DoctorSchema = new Schema<IDoctor>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  specialization: [{ type: Schema.Types.ObjectId, ref: 'Specialization' }],
  email: { type: String, default: null, index: true },
  gender: { type: Number },
  city: { type: String, default: null },
  state: { type: String, default: null },
  isOwnEstablishment: { type: Boolean, default: false },
  medicalRegistration: [MedicalRegistrationSchema],
  education: [EducationSchema],
  award: [AwardSchema],
  membership: [MembershipSchema],
  certifications: [CertificationSchema],
  social: [SocialSchema],
  service: [ServiceSchema],
  experience: { type: String, default: null },
  identityProof: [ProofSchema],
  medicalProof: [ProofSchema],
  establishmentProof: [ProofSchema],
  profilePic: {
    type: String,
    default: 'https://nector-prod.s3.ap-south-1.amazonaws.com/986d9500-921d-11ef-9eef-990c47d7fcd5-defaultProfilePicNectar.png',
  },
  about: { type: String, default: null },
  publicUrl: { type: String, default: null },
  isDeleted: { type: Boolean, default: false },
  totalreviews: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  recommended: { type: Number, default: 0 },
  waitTime: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: Number, default: 1 }, // fallback if no constants enum imported
  isVerified: { type: Number, default: 1 },
  // isVerified: { type: Number, default: constants.PROFILE_STATUS.PENDING },
  rejectReason: { type: String },
  steps: { type: Number, default: 2 },
  profileScreen: { type: Number, default: 1 },
  procedure: [{ type: Schema.Types.ObjectId, ref: 'ProcedureMaster' }],
  profileSlug: { type: String },
  consultationType: {
    type: String,
    enum: ['VIDEO', 'IN_CLINIC'],
  },
  consultationDetails: ConsultationDetailsSchema,
}, { timestamps: true, versionKey: false });

export const Doctor = mongoose.model<IDoctor>('Doctor', DoctorSchema);
export default Doctor;
