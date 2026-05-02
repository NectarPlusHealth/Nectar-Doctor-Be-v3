// src/controllers/patientController.ts
import { Request, Response } from "express";
import patientservice from "../services/patientservice";
import response from "../utils/response";
import httpStatus from "../utils/httpStatus";
import Doctor from "../models/Doctor";
import Appointment from "../models/Appointment";
import common from "../utils/common";
import constants from "../utils/constant";
import { Types } from "mongoose";


/**
 * GET /doctor/record?patientId=...
 *
 * Note: returns Promise<void> because Express route handlers should not return a Response object.
 */
const getPatientData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { patientId } = req.query as { patientId?: string };

    console.log("patientId: ",patientId);
    if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
      response.error(
        { msgCode: "INVALID_REQUEST", message: "patientId query parameter is required" },
        res,
        httpStatus.BAD_REQUEST
      );
      return;
    }

    const isHex24 = /^[a-fA-F0-9]{24}$/.test(patientId);
    if (!isHex24) {
      response.error(
        { msgCode: "INVALID_PATIENT_ID", message: "patientId must be a 24 character hex string" },
        res,
        httpStatus.BAD_REQUEST
      );
      return;
    }

    const condition = { _id: patientId };
    console.log("condition: ",condition);

    const userDetails = await patientservice.getPatientData(condition);

    if (!userDetails) {
      response.error({ msgCode: "USER_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    response.success({ msgCode: "PATIENT_DATA", data: userDetails }, res, httpStatus.OK);
    return;
  } catch (err) {
    console.error("Error in getPatientData controller:", err);
    response.error(
      { msgCode: "SOMETHING_WENT_WRONG" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
    return;
  }
};

const patientAppointmentList = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).data?.userId as string | undefined;
    if (!userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    const { patientId, status, fromDate, toDate } = req.query as {
      patientId?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
    };

    if (!patientId || !/^[a-fA-F0-9]{24}$/.test(patientId)) {
      response.error(
        { msgCode: "INVALID_REQUEST", message: "patientId (24 hex) is required" },
        res,
        httpStatus.BAD_REQUEST
      );
      return;
    }

    // Find doctor record linked to current userId
    const doctorUser = await Doctor.findOne({ userId: new Types.ObjectId(userId) }).lean();
    if (!doctorUser) {
      response.error({ msgCode: "NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    // Build condition
    const condition: Record<string, any> = {
      doctorId: new Types.ObjectId(doctorUser._id),
      patientId: new Types.ObjectId(patientId),
    };

    if (status !== undefined && status !== null && status !== "") {
      const parsed = Number(status);
      if (Number.isNaN(parsed)) {
        response.error(
          { msgCode: "INVALID_STATUS", message: "status must be numeric" },
          res,
          httpStatus.BAD_REQUEST
        );
        return;
      }
      condition.status = parsed;
    } else {
      condition.status = { $ne: constants.BOOKING_STATUS.RESCHEDULE };
    }

    // Date filters
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        response.error(
          { msgCode: "INVALID_DATE", message: "fromDate/toDate must be valid ISO date strings" },
          res,
          httpStatus.BAD_REQUEST
        );
        return;
      }
      condition.date = { $gte: from, $lte: to };
    } else if (toDate) {
      const to = new Date(toDate);
      if (isNaN(to.getTime())) {
        response.error(
          { msgCode: "INVALID_DATE", message: "toDate must be valid ISO date string" },
          res,
          httpStatus.BAD_REQUEST
        );
        return;
      }
      condition.date = { $lte: to };
    }

    // Call service
    const appointmentList = await patientservice.appointmentList(condition);

    if (appointmentList === false) {
      response.error({ msgCode: "SOMETHING_WENT_WRONG" }, res, httpStatus.INTERNAL_SERVER_ERROR);
      return;
    }

    const msgCode =
      appointmentList.count === 0 ? "NO_RECORD_FETCHED" : "APPOINTMENT_LIST_FETCHED";

    response.success({ msgCode, data: appointmentList }, res, httpStatus.OK);
  } catch (err) {
    console.error("Error in patientAppointmentList:", err);
    response.error(
      { msgCode: "SOMETHING_WENT_WRONG" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};
/**
 * GET /doctor/doctor-appointment-dashboard?today=YYYY-MM-DD
 *
 * Returns counts for today's completed, pending and upcoming appointments for the logged-in doctor.
 * Accepts optional `today` query string (ISO date like "2025-09-13") — otherwise uses server current date.
 */
// const getDoctorAppointmentDashboard = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const userId = (req as any).data?.userId as string | undefined;
//     if (!userId) {
//       response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
//       return;
//     }

//     // find doctor by userId
//     const condition = {
//       userId: new Types.ObjectId(userId),
//     };
//     // common.getByCondition may not have TS types — cast to any to avoid type errors
//     const findDoctor = await (common as any).getByCondition(Doctor, condition);
//     if (!findDoctor) {
//       response.error({ msgCode: "DATA_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
//       return;
//     }

//     // Accept `today` as query param for GET. If missing, use current date.
//     const todayQuery = (req.query.today as string) || "";
//     const now = new Date();

//     let todayDate: Date;
//     if (todayQuery) {
//       const parsed = new Date(todayQuery);
//       if (isNaN(parsed.getTime())) {
//         response.error(
//           { msgCode: "INVALID_DATE", message: "today query param must be a valid date" },
//           res,
//           httpStatus.BAD_REQUEST
//         );
//         return;
//       }
//       todayDate = parsed;
//     } else {
//       todayDate = now;
//     }

//     const startOfDay = new Date(todayDate);
//     startOfDay.setHours(0, 0, 0, 0);
//     const endOfDay = new Date(todayDate);
//     endOfDay.setHours(23, 59, 59, 999);

//     const doctorObjectId = new Types.ObjectId(findDoctor._id);

//     const todayCompleteCondition = {
//       doctorId: doctorObjectId,
//       isDeleted: false,
//       status: constants.BOOKING_STATUS.COMPLETE,
//       date: { $gte: startOfDay, $lte: endOfDay },
//     };
//     const completeCount = await (common as any).count(Appointment, todayCompleteCondition);

//     const todayPendingCondition = {
//       doctorId: doctorObjectId,
//       isDeleted: false,
//       status: constants.BOOKING_STATUS.BOOKED,
//       date: { $gte: startOfDay, $lte: endOfDay },
//     };
//     const pendingCount = await (common as any).count(Appointment, todayPendingCondition);

//     const todayTotalCountCondition = {
//       doctorId: doctorObjectId,
//       isDeleted: false,
//       status: { $ne: constants.BOOKING_STATUS.RESCHEDULE },
//       date: { $gte: startOfDay, $lte: endOfDay },
//     };
//     const todayTotalCount = await (common as any).count(Appointment, todayTotalCountCondition);

//     const upcomingCountCondition = {
//       doctorId: doctorObjectId,
//       isDeleted: false,
//       status: constants.BOOKING_STATUS.BOOKED,
//       date: { $gte: now },
//     };
//     const totalData = await (common as any).count(Appointment, upcomingCountCondition);

//     const data = {
//       todayData: completeCount,
//       pendingData: pendingCount,
//       todayTotalCount,
//       totalData,
//     };

//     response.success({ msgCode: "FETCHED", data }, res, httpStatus.OK);
//     return;
//   } catch (error) {
//     console.error("Error in getDoctorAppointmentDashboard:", error);
//     response.error(
//       { msgCode: "INTERNAL_SERVER_ERROR" },
//       res,
//       httpStatus.INTERNAL_SERVER_ERROR
//     );
//     return;
//   }
// };
// replace only the getDoctorAppointmentDashboard function with this

const getDoctorAppointmentDashboard = async (req: Request, res: Response): Promise<void> => {
  // console.log("getDoctorAppointmentDashboard called");

  try {
    const userId = (req as any).data?.userId as string | undefined;
    // console.log("userId: ", userId);
    if (!userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    // find doctor by userId (use the model directly)
    const doctor = await Doctor.findOne({ userId: new Types.ObjectId(userId) }).lean();
    if (!doctor) {
      response.error({ msgCode: "DATA_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    // Accept `today` as query param for GET. If missing, use current date.
    const todayQuery = (req.query.today as string) || "";
    const now = new Date();

    let todayDate: Date;
    if (todayQuery) {
      const parsed = new Date(todayQuery);
      if (isNaN(parsed.getTime())) {
        response.error(
          { msgCode: "INVALID_DATE", message: "today query param must be a valid date" },
          res,
          httpStatus.BAD_REQUEST
        );
        return;
      }
      todayDate = parsed;
    } else {
      todayDate = now;
    }

    const startOfDay = new Date(todayDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(todayDate);
    endOfDay.setHours(23, 59, 59, 999);

    const doctorObjectId = new Types.ObjectId((doctor as any)._id);

    // Use Mongoose countDocuments directly (avoids relying on `common.count`)
    const todayCompleteCondition = {
      doctorId: doctorObjectId,
      isDeleted: false,
      status: constants.BOOKING_STATUS.COMPLETE,
      date: { $gte: startOfDay, $lte: endOfDay },
    };
    const completeCount = await Appointment.countDocuments(todayCompleteCondition);

    const todayPendingCondition = {
      doctorId: doctorObjectId,
      isDeleted: false,
      status: constants.BOOKING_STATUS.BOOKED,
      date: { $gte: startOfDay, $lte: endOfDay },
    };
    const pendingCount = await Appointment.countDocuments(todayPendingCondition);

    const todayTotalCountCondition = {
      doctorId: doctorObjectId,
      isDeleted: false,
      status: { $ne: constants.BOOKING_STATUS.RESCHEDULE },
      date: { $gte: startOfDay, $lte: endOfDay },
    };
    const todayTotalCount = await Appointment.countDocuments(todayTotalCountCondition);

    const upcomingCountCondition = {
      doctorId: doctorObjectId,
      isDeleted: false,
      status: constants.BOOKING_STATUS.BOOKED,
      date: { $gte: now },
    };
    const totalData = await Appointment.countDocuments(upcomingCountCondition);

    const data = {
      todayData: completeCount,
      pendingData: pendingCount,
      todayTotalCount,
      totalData,
    };

    response.success({ msgCode: "FETCHED", data }, res, httpStatus.OK);
    return;
  } catch (error) {
    console.error("Error in getDoctorAppointmentDashboard:", error);
    response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
    return;
  }
};


export default {
  getPatientData,
  patientAppointmentList,
  getDoctorAppointmentDashboard,
};