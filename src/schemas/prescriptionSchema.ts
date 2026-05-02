// src/schemas/prescriptionSchema.ts
import Joi from 'joi';

// Schema for medication object
const medicationSchema = Joi.object({
  name: Joi.string().required(),
  dosage: Joi.string().required(),  
  frequency: Joi.string().required(),
  duration: Joi.string().required(),
  instructions: Joi.string().allow('').optional()
});

// Schema for vital signs object
const vitalSignsSchema = Joi.object({
  bloodPressure: Joi.string().allow('').optional(),
  temperature: Joi.string().allow('').optional(),
  pulse: Joi.string().allow('').optional(),
  weight: Joi.string().allow('').optional(),
  height: Joi.string().allow('').optional()
});

// Schema for creating a prescription
export const createPrescriptionSchema = Joi.object({
  patientId: Joi.string().required(),
  prescriptionDate: Joi.date().optional(),
  chiefComplaint: Joi.string().required(),
  diagnosis: Joi.string().required(),
  medications: Joi.array().items(medicationSchema).min(1).required(),
  labTests: Joi.string().allow('').optional(),
  vitalSigns: vitalSignsSchema.optional(),
  doctorNotes: Joi.string().allow('').optional(),
  followUpDate: Joi.date().optional().allow(null),
  specialInstructions: Joi.string().allow('').optional(),
  signatureImage: Joi.string().allow('').optional()
});

// Schema for updating a prescription
export const updatePrescriptionSchema = Joi.object({
  prescriptionDate: Joi.date().optional(),
  chiefComplaint: Joi.string().optional(),
  diagnosis: Joi.string().optional(),
  medications: Joi.array().items(medicationSchema).min(1).optional(),
  labTests: Joi.string().allow('').optional(),
  vitalSigns: vitalSignsSchema.optional(),
  doctorNotes: Joi.string().allow('').optional(),
  followUpDate: Joi.date().optional().allow(null),
  specialInstructions: Joi.string().allow('').optional(),
  signatureImage: Joi.string().allow('').optional(),
  status: Joi.number().valid(1, 2, 3).optional()
});

// Schema for getting prescription list
export const getPrescriptionListSchema = Joi.object({
  patientId: Joi.string().optional(),
  page: Joi.number().integer().min(1).optional(),
  size: Joi.number().integer().min(1).optional(),
  sort: Joi.string().optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC').optional()
});

// Schema for prescription ID parameter
export const prescriptionIdSchema = Joi.object({
  id: Joi.string().required()
});
