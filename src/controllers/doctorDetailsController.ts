import { Request, Response } from 'express';
import Doctor from '../models/Doctor';
import EstablishmentMaster from '../models/EstablishmentMaster';
import response from '../utils/response';
import httpStatus from 'http-status';
import { Types } from 'mongoose';

/**
 * Controller: GET /prescription/doctor-details/:doctorId
 * Fetch doctor details with specialization and establishment address
 */


export const getDoctorDetails = async (req: Request, res: Response): Promise<void> => {
  console.log('getDoctorDetails called with doctorId (userId):', req.params.doctorId);
  try {
    const { doctorId } = req.params;
    if (!doctorId || !Types.ObjectId.isValid(doctorId)) {
      response.error({ msgCode: 'INVALID_DOCTOR_ID' }, res, httpStatus.BAD_REQUEST);
      return;
    }

    // Find doctor by userId instead of _id
    const doctor = await Doctor.findOne({ userId: doctorId })
      .select('specialization userId education')
      .populate([
        {
          path: 'specialization',
          select: 'name',
          model: 'Specialization'
        },
        {
          path: 'userId',
          select: 'fullName',
          model: 'User'
        }
      ])
      .lean();
    if (!doctor) {
      response.error({ msgCode: 'DOCTOR_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    // userId can be ObjectId or populated object
    let doctorName: string | null = null;
    if (doctor.userId && typeof doctor.userId === 'object' && 'fullName' in doctor.userId) {
      doctorName = (doctor.userId as any).fullName || null;
    }

    const result = {
      name: doctorName,
      specialization: doctor?.specialization,
      education: doctor?.education || [],
    };

    response.success({ msgCode: 'DOCTOR_DETAILS_FETCHED', data: result }, res, httpStatus.OK);
  } catch (err) {
    console.error('getDoctorDetails error:', err);
    response.error({ msgCode: 'SOMETHING_WENT_WRONG' }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};
