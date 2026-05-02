// src/models/Prescription.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface IVitalSigns {
  bloodPressure?: string;
  temperature?: string;
  pulse?: string;
  weight?: string;
  height?: string;
}

export interface IPrescription extends Document {
  _id: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  prescriptionDate: Date;
  chiefComplaint: string;
  diagnosis: string;
  medications: IMedication[];
  labTests?: string;
  vitalSigns?: IVitalSigns;
  doctorNotes?: string;
  followUpDate?: Date;
  specialInstructions?: string;
  signatureImage?: string;
  status?: number; // 1: Active, 2: Completed, 3: Cancelled
  createdAt?: Date;
  updatedAt?: Date;
}

const MedicationSchema = new Schema<IMedication>({
  name: { type: String, required: true },
  dosage: { type: String, required: true },
  frequency: { type: String, required: true },
  duration: { type: String, required: true },
  instructions: { type: String }
}, { _id: false });

const VitalSignsSchema = new Schema<IVitalSigns>({
  bloodPressure: { type: String },
  temperature: { type: String },
  pulse: { type: String },
  weight: { type: String },
  height: { type: String }
}, { _id: false });

const PrescriptionSchema = new Schema<IPrescription>({
  doctorId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Doctor',
    required: true 
  },
  patientId: { 
    type: Schema.Types.ObjectId, 
    ref: 'patients',
    required: true 
  },
  prescriptionDate: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  chiefComplaint: { 
    type: String, 
    required: true 
  },
  diagnosis: { 
    type: String, 
    required: true 
  },
  medications: {
    type: [MedicationSchema],
    required: true,
    validate: {
      validator: function(v: IMedication[]) {
        return v && v.length > 0;
      },
      message: 'At least one medication is required'
    }
  },
  labTests: { type: String },
  vitalSigns: { type: VitalSignsSchema },
  doctorNotes: { type: String },
  followUpDate: { type: Date },
  specialInstructions: { type: String },
  signatureImage: { type: String },
  status: { 
    type: Number, 
    default: 1,
    enum: [1, 2, 3] // 1: Active, 2: Completed, 3: Cancelled
  }
}, {
  timestamps: true
});

// Indexes for better query performance
PrescriptionSchema.index({ doctorId: 1, createdAt: -1 });
PrescriptionSchema.index({ patientId: 1, createdAt: -1 });
PrescriptionSchema.index({ prescriptionDate: -1 });

const Prescription = mongoose.model<IPrescription>('Prescription', PrescriptionSchema);

export default Prescription;
