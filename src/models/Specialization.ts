import mongoose, { Document, Schema } from 'mongoose';

export interface ISpecialization extends Document {
  name: string;
}

const SpecializationSchema = new Schema<ISpecialization>({
  name: { type: String, required: true }
});

export const Specialization = mongoose.model<ISpecialization>('Specialization', SpecializationSchema);
export default Specialization;
