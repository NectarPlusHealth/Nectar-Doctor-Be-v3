import mongoose, { Document, Schema } from "mongoose";

export interface IService extends Document {
  specializationId: mongoose.Types.ObjectId;
  name: string;
}

const ServiceSchema = new Schema<IService>(
  {
    specializationId: {
      type: Schema.Types.ObjectId,
      ref: "Specialization",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const Service = mongoose.model<IService>("Service", ServiceSchema);
export default Service;
