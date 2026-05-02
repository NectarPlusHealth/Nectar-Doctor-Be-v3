// src/models/Appointment.ts
import mongoose, { Document, Schema, Types } from "mongoose";
import constants from "../utils/constant";
import { genUUID } from "../utils/common";

/**
 * Appointment TypeScript interface
 */
export interface IAppointment extends Document {
  doctorId?: Types.ObjectId;
  establishmentId?: Types.ObjectId;
  isDeleted?: boolean;
  appointmentId?: string;
  slotTime?: number;
  consultationFees?: number | null;
  startTime?: Date;
  date?: Date | null;
  slot?: number | null;
  patientId?: Types.ObjectId | null;
  self?: boolean;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  cancelBy?: number | null;
  reason?: string | null;
  notes?: string | null;
  status?: number;
  createdBy?: Types.ObjectId | null;
  modifiedBy?: Types.ObjectId | null;
  countryCode?: string;
  consultationType?: string | null;
  /** Google Meet URL generated for video consultations. */
  videoMeetingUrl?: string | null;
  /** Provider that created the meeting link (e.g. 'google_meet'). */
  videoMeetingProvider?: string | null;
  /** Underlying provider event id (Google Calendar event id) for cleanup. */
  videoMeetingEventId?: string | null;
  /** First time a participant opened the link (sets status -> in-progress). */
  videoConsultationStartedAt?: Date | null;
  /** Doctor pressed 'End consultation' (sets status -> completed). */
  videoConsultationEndedAt?: Date | null;
  /** Doctor's post-call notes (saved separately from `notes` so we don't clobber legacy). */
  consultationNotes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Schema
 */
const appointmentSchema = new Schema<IAppointment>(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: "doctors" },
    establishmentId: { type: Schema.Types.ObjectId, ref: "establishmentmasters" },
    isDeleted: { type: Boolean, default: false },
    appointmentId: {
      type: String,
      default: function () {
        const uuid = genUUID();
        // convert a portion of UUID to numeric string like original implementation
        const numericCode = parseInt(uuid.replace(/-/g, "").slice(0, 6), 16);
        return numericCode.toString().padStart(6, "0");
      },
    },
    slotTime: { type: Number, default: 15 },
    consultationFees: { type: Number },
    startTime: { type: Date, default: Date.now },
    date: { type: Date },
    slot: { type: Number, enum: constants.SLOT as any },
    patientId: { type: Schema.Types.ObjectId, ref: "patients" },
    self: { type: Boolean, default: true },
    fullName: { type: String },
    phone: { type: String },
    email: { type: String },
    city: { type: String, default: null },
    cancelBy: { type: Number, enum: Object.values(constants.CANCEL_BY) as any },
    reason: { type: String, default: null },
    notes: { type: String, default: null },
    status: { type: Number, default: constants.BOOKING_STATUS.BOOKED },
    createdBy: { type: Schema.Types.ObjectId, ref: "users" },
    modifiedBy: { type: Schema.Types.ObjectId, ref: "users" },
    countryCode: { type: String, default: "+91" },
    consultationType: {
      type: String,
      enum: [constants.CONSULTATION_TYPES.VIDEO, constants.CONSULTATION_TYPES.IN_CLINIC],
    },
    videoMeetingUrl: { type: String, default: null },
    videoMeetingProvider: { type: String, default: null },
    videoMeetingEventId: { type: String, default: null },
    videoConsultationStartedAt: { type: Date, default: null },
    videoConsultationEndedAt: { type: Date, default: null },
    consultationNotes: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/**
 * Use existing model if already registered (prevents OverwriteModelError in hot-reload/dev)
 */
const MODEL_NAME = "appointments";
const AppointmentModel =
  (mongoose.models && (mongoose.models[MODEL_NAME] as mongoose.Model<IAppointment>)) ||
  mongoose.model<IAppointment>(MODEL_NAME, appointmentSchema);

/**
 * Export the model both as default (direct Model) and as named `model` to be backwards compatible
 * with code that expects `Something.model`.
 */
export const model = AppointmentModel;
export default AppointmentModel;
