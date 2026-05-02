// src/routes/prescription.ts
import { Router } from 'express';
import { verifyAuthToken } from '../utils/auth';
import validate from '../middlewares/validate';
import * as schema from '../schemas/prescriptionSchema';
import prescriptionController from '../controllers/prescriptionController';

import { getDoctorDetails } from '../controllers/doctorDetailsController';

const router = Router();

// Get doctor details (name, specialization, address)
router.get('/doctor-details/:doctorId', verifyAuthToken, getDoctorDetails);

// Create a new prescription
router.post(
  '/create',
  verifyAuthToken,
  validate(schema.createPrescriptionSchema, 'body'),
  prescriptionController.createPrescription
);

// Get prescription list for a doctor (optionally filtered by patientId)
router.get(
  '/list',
  verifyAuthToken,
  validate(schema.getPrescriptionListSchema, 'query'),
  prescriptionController.getPrescriptionList
);

// Patient Routes - Get prescription list for authenticated patient
router.get(
  '/patient/list',
  verifyAuthToken,
  validate(schema.getPrescriptionListSchema, 'query'),
  prescriptionController.getPatientPrescriptionList
);

// Patient Routes - Get a single prescription by ID for authenticated patient
router.get(
  '/patient/:id',
  verifyAuthToken,
  validate(schema.prescriptionIdSchema, 'params'),
  prescriptionController.getPatientPrescriptionById
);

// Get a single prescription by ID
router.get(
  '/:id',
  verifyAuthToken,
  validate(schema.prescriptionIdSchema, 'params'),
  prescriptionController.getPrescriptionById
);

// Update a prescription
router.put(
  '/:id',
  verifyAuthToken,
  validate(schema.prescriptionIdSchema, 'params'),
  validate(schema.updatePrescriptionSchema, 'body'),
  prescriptionController.updatePrescription
);

// Delete/Cancel a prescription
router.delete(
  '/:id',
  verifyAuthToken,
  validate(schema.prescriptionIdSchema, 'params'),
  prescriptionController.deletePrescription
);

export default router;
