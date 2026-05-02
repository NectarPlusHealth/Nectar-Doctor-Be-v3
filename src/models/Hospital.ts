import { Schema, model, Document, Types } from 'mongoose';
import constants  from '../utils/constant'; // <-- using ES export

export interface IHospital extends Document {
  userId: Types.ObjectId;
  profilePic?: string;
  city?: string;
  totalDoctor?: number;
  hospitalType?: Types.ObjectId;
  isOwner?: boolean;
  totalBed?: number;
  ambulance?: number;
  about?: string;

  service?: { name?: string }[];

  social?: { type: Types.ObjectId; url?: string }[];

  image?: { url?: string }[];

  specialization?: Types.ObjectId[];

  steps: number;

  speciality?: Types.ObjectId[];
  procedure?: Types.ObjectId[];

  address?: {
    landmark?: string;
    locality?: string;
    city?: string;
    state?: Types.ObjectId;
    country?: string;
    pincode?: string;
  };

  isLocationShared?: boolean;

  location?: {
    type: string;
    coordinates: number[];
  };

  publicUrl?: string;

  isVerified?: number;
  rejectReason?: string;

  establishmentProof?: {
    url?: string;
    fileType?: string;
  }[];

  status?: string;

  isDeleted: boolean;

  createdBy?: Types.ObjectId;

  profileScreen?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

const hospitalSchema = new Schema<IHospital>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'users',
    },

    profilePic: {
      type: String,
      default: null,
    },

    city: {
      type: String,
      default: null,
    },

    totalDoctor: {
      type: Number,
      default: 0,
    },

    hospitalType: {
      type: Schema.Types.ObjectId,
      ref: 'hospitaltypes',
    },

    isOwner: {
      type: Boolean,
    },

    totalBed: {
      type: Number,
    },

    ambulance: {
      type: Number,
    },

    about: {
      type: String,
    },

    service: [
      {
        name: { type: String },
      },
    ],

    social: [
      {
        type: {
          type: Schema.Types.ObjectId,
          ref: 'socialmedias',
        },
        url: { type: String },
      },
    ],

    image: [
      {
        url: { type: String },
      },
    ],

    specialization: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Specialization',
      },
    ],

    steps: {
      type: Number,
      enum: constants.PROFILE_STEPS, // EXACT match with JS
      default: constants.PROFILE_STEPS.SECTION_A,
    },

    speciality: [
      {
        type: Schema.Types.ObjectId,
        ref: 'specializations',
      },
    ],

    procedure: [
      {
        type: Schema.Types.ObjectId,
        ref: 'proceduremasters',
      },
    ],

    address: {
      landmark: { type: String },
      locality: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String, default: 'India' },
      pincode: { type: String },
    },

    isLocationShared: {
      type: Boolean,
      default: false,
    },

    location: {
      type: {
        type: String,
        default: 'Point',
      },
      coordinates: {
        type: [
          {
            type: Number,
          },
        ],
        default: [77.216721, 28.6448],
        index: '2dsphere',
      },
    },

    publicUrl: { type: String },

    isVerified: {
      type: Number,
      enum: constants.PROFILE_STATUS,
      default: constants.PROFILE_STATUS.PENDING,
    },

    rejectReason: { type: String },

    establishmentProof: [
      {
        url: { type: String, default: null },
        fileType: { type: String, default: null },
      },
    ],

      status: {
      type: String,
      enum: [String(constants.PROFILE_STATUS.PENDING)] // now a valid string enum array
    },


    isDeleted: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'users',
    },

    profileScreen: {
      type: Number,
      enum: constants.HOSPITAL_SCREENS,
      default: constants.HOSPITAL_SCREENS.ESTABLISHMENT_DETAILS,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const Hospital = model<IHospital>('hospitals', hospitalSchema);
export default Hospital;
