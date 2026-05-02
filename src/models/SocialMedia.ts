import mongoose, { Document, Schema } from "mongoose";

export interface ISocialMedia extends Document {
  name: string;
  logo: string;
  isDeleted: boolean;
}

const SocialMediaSchema = new Schema<ISocialMedia>(
  {
    name: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const SocialMedia = mongoose.model<ISocialMedia>("socialMedia", SocialMediaSchema);
export default SocialMedia;
