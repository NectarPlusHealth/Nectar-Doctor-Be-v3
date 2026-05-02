// src/controllers/prescriptionController.ts
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Prescription from '../models/Prescription';
import Doctor from '../models/Doctor';
import Patient from '../models/Patient';
import response from '../utils/response';
import httpStatus from 'http-status';
import { getPagination } from '../utils/pagination';
import { resolveOrder } from '../utils/sort';
import constants from '../utils/constant';

interface CustomRequest extends Request {
  data?: {
    userId: string;
    isAdmin?: boolean;
  };
}

/**
 * Controller: POST /prescription/create
 * Create a new prescription
 */
const createPrescription = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;

    if (!userId) {
      response.error({ msgCode: 'UNAUTHORIZED' }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    // Find doctor by userId
    const doctorRecord = await Doctor.findOne({ userId: new Types.ObjectId(String(userId)) }).lean();
    if (!doctorRecord) {
      response.error({ msgCode: 'DOCTOR_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    const {
      patientId,
      prescriptionDate,
      chiefComplaint,
      diagnosis,
      medications,
      labTests,
      vitalSigns,
      doctorNotes,
      followUpDate,
      specialInstructions,
      signatureImage
    } = req.body;

    // Validate required fields
    if (!patientId || !chiefComplaint || !diagnosis || !medications || medications.length === 0) {
      response.error({ msgCode: 'MISSING_REQUIRED_FIELDS' }, res, httpStatus.BAD_REQUEST);
      return;
    }

    // Verify patient exists
    const patientRecord = await Patient.findById(patientId).lean();
    if (!patientRecord) {
      response.error({ msgCode: 'PATIENT_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    // Create prescription
    const prescriptionData = new Prescription({
      doctorId: doctorRecord._id,
      patientId: new Types.ObjectId(patientId),
      prescriptionDate: prescriptionDate ? new Date(prescriptionDate) : new Date(),
      chiefComplaint,
      diagnosis,
      medications,
      labTests,
      vitalSigns,
      doctorNotes,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      specialInstructions,
      signatureImage,
      status: 1 // Active
    });

    const savedPrescription = await prescriptionData.save();

    response.success(
      { 
        msgCode: 'PRESCRIPTION_CREATED_SUCCESSFULLY', 
        data: savedPrescription 
      }, 
      res, 
      httpStatus.CREATED
    );
  } catch (err) {
    console.error('createPrescription error:', err);
    response.error({ msgCode: 'SOMETHING_WENT_WRONG' }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Controller: GET /prescription/list
 * Get prescriptions list for a doctor or patient
 */
const getPrescriptionList = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;

    if (!userId) {
      response.error({ msgCode: 'UNAUTHORIZED' }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    // Find doctor by userId
    const doctorRecord = await Doctor.findOne({ userId: new Types.ObjectId(String(userId)) }).lean();
    if (!doctorRecord) {
      response.error({ msgCode: 'DOCTOR_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    const { 
      patientId, 
      page = '1', 
      size = '20',
      sort = 'createdAt',
      sortOrder = 'DESC'
    } = req.query as Record<string, string>;

    const { limit, offset } = getPagination(page, size);

    const LIST_ORDER = constants?.LIST?.ORDER ?? { ASC: 1, DESC: -1 };
    const orderValue = resolveOrder(LIST_ORDER, sortOrder);
    const sortCondition: Record<string, any> = { [String(sort)]: orderValue };

    // Build query condition
    const condition: any = { doctorId: doctorRecord._id };
    
    if (patientId) {
      condition.patientId = new Types.ObjectId(patientId);
    }

    // Get total count
    const count = await Prescription.countDocuments(condition);

    // Get prescriptions with pagination
    const prescriptions = await Prescription.find(condition)
      .select('_id prescriptionDate createdAt diagnosis chiefComplaint status patientId')
      .populate({
        path: 'patientId',
        select: 'userId',
        populate: {
          path: 'userId',
          model: 'User',
          select: 'fullName'
        }
      })
      .sort(sortCondition)
      .skip(offset)
      .limit(limit)
      .lean();

    const msgCode = count === 0 ? 'NO_RECORD_FETCHED' : 'PRESCRIPTION_LIST_FETCHED';

    response.success(
      { 
        msgCode, 
        data: {
          prescriptions,
          count,
          page: parseInt(page),
          size: parseInt(size)
        }
      }, 
      res, 
      httpStatus.OK
    );
  } catch (err) {
    console.error('getPrescriptionList error:', err);
    response.error({ msgCode: 'SOMETHING_WENT_WRONG' }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Controller: GET /prescription/:id
 * Get a single prescription by ID
 */
const getPrescriptionById = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const { id } = req.params;

    if (!userId) {
      response.error({ msgCode: 'UNAUTHORIZED' }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    if (!Types.ObjectId.isValid(String(id))) {
      response.error({ msgCode: 'INVALID_PRESCRIPTION_ID' }, res, httpStatus.BAD_REQUEST);
      return;
    }

    // Find doctor by userId
    const doctorRecord = await Doctor.findOne({ userId: new Types.ObjectId(String(userId)) }).lean();
    if (!doctorRecord) {
      response.error({ msgCode: 'DOCTOR_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    // Get prescription
    const prescription = await Prescription.findOne({
      _id: new Types.ObjectId(String(id)),
      doctorId: doctorRecord._id
    })
      .populate({
        path: 'patientId',
        select: 'userId email gender dob bloodGroup',
        populate: {
          path: 'userId',
          model: 'User',
          select: 'fullName phone'
        }
      })
      .populate({
        path: 'doctorId',
        select: 'specialization userId education',
        populate: [
          {
            path: 'specialization',
            select: 'name'
          },
          {
            path: 'userId',
            select: 'fullName'
          }
        ]
      })
      .lean();

    if (!prescription) {
      response.error({ msgCode: 'PRESCRIPTION_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    response.success(
      { 
        msgCode: 'PRESCRIPTION_FETCHED', 
        data: prescription 
      }, 
      res, 
      httpStatus.OK
    );
  } catch (err) {
    console.error('getPrescriptionById error:', err);
    response.error({ msgCode: 'SOMETHING_WENT_WRONG' }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Controller: PUT /prescription/:id
 * Update a prescription
 */
const updatePrescription = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const { id } = req.params;

    if (!userId) {
      response.error({ msgCode: 'UNAUTHORIZED' }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    if (!Types.ObjectId.isValid(String(id))) {
      response.error({ msgCode: 'INVALID_PRESCRIPTION_ID' }, res, httpStatus.BAD_REQUEST);
      return;
    }

    // Find doctor by userId
    const doctorRecord = await Doctor.findOne({ userId: new Types.ObjectId(String(userId)) }).lean();
    if (!doctorRecord) {
      response.error({ msgCode: 'DOCTOR_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    // Check if prescription exists and belongs to this doctor
    const existingPrescription = await Prescription.findOne({
      _id: new Types.ObjectId(String(id)),
      doctorId: doctorRecord._id
    });

    if (!existingPrescription) {
      response.error({ msgCode: 'PRESCRIPTION_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    const {
      prescriptionDate,
      chiefComplaint,
      diagnosis,
      medications,
      labTests,
      vitalSigns,
      doctorNotes,
      followUpDate,
      specialInstructions,
      signatureImage,
      status
    } = req.body;

    // Update prescription fields
    if (prescriptionDate) existingPrescription.prescriptionDate = new Date(prescriptionDate);
    if (chiefComplaint) existingPrescription.chiefComplaint = chiefComplaint;
    if (diagnosis) existingPrescription.diagnosis = diagnosis;
    if (medications) existingPrescription.medications = medications;
    if (labTests !== undefined) existingPrescription.labTests = labTests;
    if (vitalSigns) existingPrescription.vitalSigns = vitalSigns;
    if (doctorNotes !== undefined) existingPrescription.doctorNotes = doctorNotes;
    if (followUpDate) existingPrescription.followUpDate = new Date(followUpDate);
    if (specialInstructions !== undefined) existingPrescription.specialInstructions = specialInstructions;
    if (signatureImage !== undefined) existingPrescription.signatureImage = signatureImage;
    if (status) existingPrescription.status = status;

    const updatedPrescription = await existingPrescription.save();

    response.success(
      { 
        msgCode: 'PRESCRIPTION_UPDATED_SUCCESSFULLY', 
        data: updatedPrescription 
      }, 
      res, 
      httpStatus.OK
    );
  } catch (err) {
    console.error('updatePrescription error:', err);
    response.error({ msgCode: 'SOMETHING_WENT_WRONG' }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Controller: DELETE /prescription/:id
 * Delete/Cancel a prescription
 */
const deletePrescription = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const { id } = req.params;

    if (!userId) {
      response.error({ msgCode: 'UNAUTHORIZED' }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    if (!Types.ObjectId.isValid(String(id))) {
      response.error({ msgCode: 'INVALID_PRESCRIPTION_ID' }, res, httpStatus.BAD_REQUEST);
      return;
    }

    // Find doctor by userId
    const doctorRecord = await Doctor.findOne({ userId: new Types.ObjectId(String(userId)) }).lean();
    if (!doctorRecord) {
      response.error({ msgCode: 'DOCTOR_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    // Update prescription status to cancelled (3)
    const prescription = await Prescription.findOneAndUpdate(
      {
        _id: new Types.ObjectId(String(id)),
        doctorId: doctorRecord._id
      },
      { status: 3 }, // Cancelled
      { new: true }
    );

    if (!prescription) {
      response.error({ msgCode: 'PRESCRIPTION_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    response.success(
      { 
        msgCode: 'PRESCRIPTION_CANCELLED_SUCCESSFULLY', 
        data: prescription 
      }, 
      res, 
      httpStatus.OK
    );
  } catch (err) {
    console.error('deletePrescription error:', err);
    response.error({ msgCode: 'SOMETHING_WENT_WRONG' }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Controller: GET /prescription/patient/list
 * Get prescriptions for a patient (authenticated patient user)
 */
const getPatientPrescriptionList = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;

    if (!userId) {
      response.error({ msgCode: 'UNAUTHORIZED' }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    // Find patient by userId
    const patientRecord = await Patient.findOne({ userId: new Types.ObjectId(String(userId)) }).lean();
    if (!patientRecord) {
      response.error({ msgCode: 'PATIENT_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    const { 
      page = '1', 
      size = '20',
      sort = 'createdAt',
      sortOrder = 'DESC'
    } = req.query as Record<string, string>;

    const { limit, offset } = getPagination(page, size);

    const LIST_ORDER = constants?.LIST?.ORDER ?? { ASC: 1, DESC: -1 };
    const orderValue = resolveOrder(LIST_ORDER, sortOrder);
    const sortCondition: Record<string, any> = { [String(sort)]: orderValue };

    // Build query condition for this patient
    const condition: any = { patientId: patientRecord._id, status: { $ne: 3 } }; // Exclude cancelled prescriptions

    // Get total count
    const count = await Prescription.countDocuments(condition);

    // Get prescriptions with pagination
    const prescriptions = await Prescription.find(condition)
      .populate([
        {
          path: 'doctorId',
          select: 'specialization userId medicalRegistration email profilePic education about city state',
          populate: {
            path: 'userId',
            select: 'fullName phone'
          }
        },
        {
          path: 'patientId',
          select: 'userId email gender dob bloodGroup',
          populate: {
            path: 'userId',
            select: 'fullName phone countryCode status isDeleted'
          }
        }
      ])
      .sort(sortCondition)
      .skip(offset)
      .limit(limit)
      .lean();

    const msgCode = count === 0 ? 'NO_RECORD_FETCHED' : 'PRESCRIPTION_LIST_FETCHED';

    response.success(
      { 
        msgCode, 
        data: {
          prescriptions,
          count,
          page: parseInt(page),
          size: parseInt(size)
        }
      }, 
      res, 
      httpStatus.OK
    );
  } catch (err) {
    console.error('getPatientPrescriptionList error:', err);
    response.error({ msgCode: 'SOMETHING_WENT_WRONG' }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Controller: GET /prescription/patient/:id
 * Get a single prescription by ID for a patient (authenticated patient user)
 */
const getPatientPrescriptionById = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const { id } = req.params;

    if (!userId) {
      response.error({ msgCode: 'UNAUTHORIZED' }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    if (!Types.ObjectId.isValid(String(id))) {
      response.error({ msgCode: 'INVALID_PRESCRIPTION_ID' }, res, httpStatus.BAD_REQUEST);
      return;
    }

    // Find patient by userId
    const patientRecord = await Patient.findOne({ userId: new Types.ObjectId(String(userId)) }).lean();
    if (!patientRecord) {
      response.error({ msgCode: 'PATIENT_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    // Get prescription
    const prescription = await Prescription.findOne({
      _id: new Types.ObjectId(String(id)),
      patientId: patientRecord._id
    })
      .populate([
        {
          path: 'doctorId',
          select: 'specialization userId medicalRegistration email profilePic education about city state',
          populate: {
            path: 'userId',
            select: 'fullName phone'
          }
        },
        {
          path: 'patientId',
          select: 'userId email gender dob bloodGroup',
          populate: {
            path: 'userId',
            select: 'fullName phone countryCode status isDeleted'
          }
        }
      ])
      .lean();

    if (!prescription) {
      response.error({ msgCode: 'PRESCRIPTION_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    response.success(
      { 
        msgCode: 'PRESCRIPTION_FETCHED', 
        data: prescription 
      }, 
      res, 
      httpStatus.OK
    );
  } catch (err) {
    console.error('getPatientPrescriptionById error:', err);
    response.error({ msgCode: 'SOMETHING_WENT_WRONG' }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

export default {
  createPrescription,
  getPrescriptionList,
  getPrescriptionById,
  updatePrescription,
  deletePrescription,
  getPatientPrescriptionList,
  getPatientPrescriptionById
};
