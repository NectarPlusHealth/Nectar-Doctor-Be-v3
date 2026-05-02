// // src/controllers/doctorController.ts
// import { Request, Response } from "express";
// import { ObjectId } from "mongodb";
// import Doctor from "../models/Doctor";
// import doctorService from "../services/doctorService";
// import response from "../utils/response";
// import httpStatus from "http-status";
// import constants from "../utils/constant";
// import { getPagination } from "../utils/pagination";
// import { resolveOrder } from "../utils/sort";
// import { Types } from "mongoose";
// import patientService from "../services/patientservice";
// // import Doctor from "../models/Doctor";
// import Video from "../models/Video";
// import EstablishmentMaster from "../models/EstablishmentMaster";
// import EstablishmentTiming from "../models/EstablishmentTiming";
// import Hospital from "../models/Hospital";
// import User from "../models/User";
// import common from "../utils/common";


// src/controllers/doctorController.ts
import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { Types } from "mongoose";
import Doctor from "../models/Doctor";
import doctorService from "../services/doctorService";
import response from "../utils/response";
import httpStatus from "http-status";
import constants from "../utils/constant";
import { getPagination } from "../utils/pagination";
import { resolveOrder } from "../utils/sort";
import patientService from "../services/patientservice";
import Video from "../models/Video";
import EstablishmentMaster from "../models/EstablishmentMaster";
import EstablishmentTiming from "../models/EstablishmentTiming";
import Hospital from "../models/Hospital";
import User from "../models/User";
import Admin from "../models/Admin";
import Notification from "../models/Notification";
import Appointment from "../models/Appointment";
import common from "../utils/common";

interface CustomRequest extends Request {
  data?: {
    userId: string;
    isAdmin?: boolean;
  };
}
interface DoctorUpdateProfileRequest extends Request {
  data?: {
    userId: string;
  };
  body: {
    steps: number;
    isEdit?: boolean;
    isSaveAndExit?: boolean;
    profileScreen?: any;
    records: any; // you can strongly type this later
  };
}

/**
 * Controller: GET /doctor/list
 */
const getDoctorPatientList = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId =
      (req as any).data?.userId ||
      (req as any).user?.id ||
      (typeof req.headers["x-user-id"] === "string" && req.headers["x-user-id"]) ||
      req.query.userId;

    if (!userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    if (!Doctor || typeof (Doctor as any).findOne !== "function") {
      console.error("Doctor model not available or invalid");
      response.error({ msgCode: "SOMETHING_WENT_WRONG" }, res, httpStatus.INTERNAL_SERVER_ERROR);
      return;
    }

    const doctorData: any = await (Doctor as any).findOne({ userId: new ObjectId(String(userId)) }).lean();
    if (!doctorData) {
      response.success({ msgCode: "NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    const { search = "", sort = "patientName", page = "1", size = "20", sortOrder = "ASC", type } =
      req.query as Record<string, any>;

    const LIST_ORDER = constants?.LIST?.ORDER ?? { ASC: 1, DESC: -1 };
    const orderValue = resolveOrder(LIST_ORDER, sortOrder);
    const sortCondition: Record<string, any> = { [String(sort)]: orderValue };

    const { limit, offset } = getPagination(page, size);

    const condition: any = { doctorId: new ObjectId((doctorData as any)._id), self: true };

    const todayConst = constants?.DOCTOR_PATIENT_LIST?.TODAY;
    const isToday =
      type === todayConst || String(type) === String(todayConst) || (typeof type === "string" && type.toUpperCase() === "TODAY");

    if (isToday) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(todayStart.getDate() - 1);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      condition.date = { $gte: yesterdayStart, $lte: todayEnd };
    }

    const patientData = await doctorService.getPatientList(condition, sortCondition, offset, limit, (search as string) || "");
    const count = patientData.count;
    const msgCode = count === 0 ? "NO_RECORD_FETCHED" : "PATIENT_CLINICAL_RECORD";

    response.success({ msgCode, data: patientData }, res, httpStatus.OK);
    return;
  } catch (err) {
    console.error("getDoctorPatientList error:", err);
    response.error({ msgCode: "SOMETHING_WENT_WRONG" }, res, httpStatus.INTERNAL_SERVER_ERROR);
    return;
  }
};

/**
 * Controller: doctorAppointmentList
 */
const doctorAppointmentList = async (req: Request, res: Response): Promise<void> => {
  try {
    // userId (from token). If admin, can override with ?userId=...
    let { userId } = (req as any).data || {};
    if (req.query.userId && typeof req.query.userId === "string") {
      userId = req.query.userId;
    }

    if (!userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    // Find doctor by userId
    const doctorRecord = await Doctor.findOne({ userId: new Types.ObjectId(userId) }).lean();
    if (!doctorRecord) {
      response.success({ msgCode: "DATA_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    const baseCondition: Record<string, any> = {
      doctorId: new Types.ObjectId(doctorRecord._id),
    };

    // Extract and normalize query params
    const {
      upcoming,
      status,
      fromDate,
      toDate,
      page,
      size,
      search,
      isExport
    } = req.query as Record<string, any>;

    const { limit, offset } = getPagination(page, size);

    // Date & status logic
    if (typeof upcoming === "string" && upcoming.toLowerCase() === "false") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      baseCondition.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (fromDate && toDate) {
      const startOfDay = new Date(String(fromDate));
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(String(toDate));
      endOfDay.setHours(23, 59, 59, 999);
      baseCondition.date = { $gte: startOfDay, $lte: endOfDay };
    } else {
      const currentTime = new Date();
      baseCondition.date = { $gt: currentTime };
      baseCondition.status = constants.BOOKING_STATUS.BOOKED;
    }

    // If explicit status provided (0 allowed), parse to number
    if (status !== undefined && status !== null && status !== "") {
      const parsedStatus = Number(status);
      if (Number.isNaN(parsedStatus)) {
        response.error(
          { msgCode: "INVALID_STATUS", message: "status must be numeric" },
          res,
          httpStatus.BAD_REQUEST
        );
        return;
      }
      baseCondition.status = parsedStatus;
    }

    // isExport flag: treat "true" (case-insensitive) as boolean true
    const exportFlag = typeof isExport === "string" && isExport.toLowerCase() === "true";

    // CALL THE SERVICE (note: service exports getAppointmentList)
    const findData = await (patientService as any).getAppointmentList(
      baseCondition,
      limit,
      offset,
      typeof search === "string" ? search : undefined,
      exportFlag
    );

    // Service returned explicit error (false)
    if (findData === false) {
      console.error("Service getAppointmentList returned false (internal error)");
      response.error(
        { msgCode: "SOMETHING_WENT_WRONG" },
        res,
        httpStatus.INTERNAL_SERVER_ERROR
      );
      return;
    }

    // No data found
    if (!findData || (Number(findData.count || 0) === 0 && (!Array.isArray(findData.data) || findData.data.length === 0))) {
      response.success({ msgCode: "DATA_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    // Success
    response.success({ msgCode: "FETCHED", data: findData }, res, httpStatus.OK);
    return;
  } catch (error) {
    console.error("Error in doctorAppointmentList:", error);
    response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
    return;
  }
};

const allVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      id,
      establishmentId,
      doctorProfileSlug,
      establishmentProfileSlug,
      userId,
    } = req.query as Record<string, any>;

    let videoList: any[] = [];

    // 1) doctor id or doctor profile slug
    if (id || doctorProfileSlug) {
      // find doctor either by _id or by profileSlug
      const doctor =
        doctorProfileSlug
          ? await Doctor.findOne({ profileSlug: String(doctorProfileSlug) }).lean()
          : await Doctor.findById(new Types.ObjectId(String(id))).lean();

      if (!doctor) {
        response.success({ msgCode: "DATA_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
        return;
      }

      videoList = await Video.find({
        userId: new ObjectId(String(doctor.userId)),
        userType: constants.USER_TYPES.DOCTOR,
      }).lean();
    }

    // 2) establishment id or establishment profile slug
    else if (establishmentId || establishmentProfileSlug) {
      const establishment =
        establishmentProfileSlug
          ? await EstablishmentMaster.findOne({ profileSlug: String(establishmentProfileSlug) }).lean()
          : await EstablishmentMaster.findById(new Types.ObjectId(String(establishmentId))).lean();

      if (!establishment) {
        response.success({ msgCode: "DATA_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
        return;
      }

      // get the hospital to resolve its userId
      const hospital = await Hospital.findById(new Types.ObjectId(String(establishment.hospitalId))).lean();
      if (!hospital) {
        response.success({ msgCode: "DATA_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
        return;
      }

      videoList = await Video.find({
        userId: new ObjectId(String(hospital.userId)),
        userType: constants.USER_TYPES.HOSPITAL,
      }).lean();
    }

    // 3) direct userId
    else if (userId) {
      videoList = await Video.find({
        userId: new ObjectId(String(userId)),
      }).lean();
    }

    // 4) nothing provided -> bad request
    else {
      response.error(
        {
          msgCode: "INVALID_REQUEST",
          message:
            "Provide one of: id | doctorProfileSlug | establishmentId | establishmentProfileSlug | userId",
        },
        res,
        httpStatus.BAD_REQUEST
      );
      return;
    }

    response.success(
      {
        msgCode: "VIDEO_LIST",
        data: { count: videoList.length, data: videoList },
      },
      res,
      httpStatus.OK
    );
  } catch (error) {
    console.error("allVideo error:", error);
    response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};


// export const doctorUpdateProfile = async (
//   req: DoctorUpdateProfileRequest,
//   res: Response
// ) => {
//   try {
//     const { steps, isEdit, records, isSaveAndExit } = req.body;
//     let { profileScreen } = req.body;
//     const { userId } = req.data!;

//     const condition = {
//       _id: new ObjectId(userId),
//       userType: constants.USER_TYPES.DOCTOR,
//     };

//     const findDoctor = await doctorService.getDoctorProfile(condition);

//     if (!findDoctor[0]?._id) {
//       return response.success(
//         { msgCode: "USER_NOT_FOUND" },
//         res,
//         httpStatus.NOT_FOUND
//       );
//     }

//     if (steps > findDoctor[0].steps) {
//       return response.error(
//         { msgCode: "INCOMPLETE_PROFILE" },
//         res,
//         httpStatus.FORBIDDEN
//       );
//     }

//     switch (steps) {
//       case constants.PROFILE_STEPS.SECTION_A: {
//         const {
//           basicDetails,
//           medicalRegistration,
//           education,
//           establishmentDetails,
//         } = records;

//         if (
//           !isEdit &&
//           !basicDetails &&
//           !medicalRegistration &&
//           !education &&
//           !establishmentDetails
//         ) {
//           return response.success(
//             { msgCode: "DOCTOR_LOGOUT" },
//             res,
//             httpStatus.OK
//           );
//         }

//         const updates: any = {};
//         updates.user = doctorService.updatesUser(basicDetails);
//         updates.doctor = doctorService.updatesDoctor(
//           basicDetails,
//           medicalRegistration,
//           education
//         );
//         updates.establishmentMaster = await doctorService.updatesEstablishmentMaster(
//           establishmentDetails,
//           findDoctor[0],
//           userId
//         );

//         if (!isEdit && !isSaveAndExit) {
//           updates.doctor.steps = constants.PROFILE_STEPS.SECTION_B;
//         }

//         if (!findDoctor[0].establishmentMasterTimingId) {
//           updates.establishmentMaster.createdBy = new ObjectId(userId);
//           await common.create(
//             EstablishmentTiming,
//             updates.establishmentMaster
//           );
//         }

//         if (updates.user) {
//           await common.updateByCondition(
//             User,
//             condition,
//             updates.user,
//             constants.USER_TYPES.DOCTOR
//           );
//         }

//         if (updates.doctor) {
//           await common.updateByCondition(
//             Doctor,
//             { userId: new ObjectId(userId) },
//             updates.doctor,
//             constants.USER_TYPES.DOCTOR
//           );
//         }

//         if (findDoctor[0].establishmentMasterTimingId) {
//           await common.updateByCondition(
//             EstablishmentTiming,
//             { _id: new ObjectId(findDoctor[0].establishmentMasterTimingId) },
//             updates.establishmentMaster
//           );
//         }
//         break;
//       }

//       case constants.PROFILE_STEPS.SECTION_B: {
//         const { doctor: doctorData, establishmentDetail, consultationType, consultationDetails } = records;

//         if (!isEdit && !doctorData && !establishmentDetail) {
//           return response.error(
//             { msgCode: "BAD_REQUEST" },
//             res,
//             httpStatus.BAD_REQUEST
//           );
//         }

//         if (!isEdit && !isSaveAndExit && doctorData) {
//           doctorData.steps = constants.PROFILE_STEPS.SECTION_C;
//         }

//         if (doctorData) {
//           if (doctorData.medicalRegistration) {
//             doctorData.medicalRegistration = {
//               registrationNumber: doctorData.medicalRegistration.registrationNumber,
//               council: doctorData.medicalRegistration.council,
//               year: doctorData.medicalRegistration.year,
//             };
//           }
//           if (consultationType) doctorData.consultationType = consultationType;
//           if (consultationDetails) doctorData.consultationDetails = consultationDetails;

//           await common.updateByCondition(
//             Doctor,
//             { userId: new ObjectId(userId) },
//             doctorData,
//             constants.USER_TYPES.DOCTOR
//           );
//         }

//         if (establishmentDetail) {
//           if (findDoctor[0].isOwnEstablishment) {
//             const updateHospital: any = { ...establishmentDetail };
//             if (!isEdit) {
//               updateHospital.steps = constants.PROFILE_STEPS.SECTION_C;
//               updateHospital.profileScreen =
//                 constants.HOSPITAL_SCREENS.ESTABLISHMENT_LOCATION;
//             }

//             await common.updateByCondition(
//               Hospital,
//               { userId: new ObjectId(userId) },
//               updateHospital
//             );

//             await common.updateByCondition(
//               EstablishmentMaster,
//               { _id: new ObjectId(findDoctor[0].establishmentMasterId) },
//               establishmentDetail,
//               constants.USER_TYPES.HOSPITAL
//             );
//           }

//           await common.updateByCondition(
//             EstablishmentTiming,
//             { _id: new ObjectId(findDoctor[0].establishmentMasterTimingId) },
//             establishmentDetail
//           );
//         }
//         break;
//       }

//       // ⚠️ For brevity, SECTION_C is skipped here, but you’d carry over logic the same way as SECTION_A/B with types.
//     }

//     if (!profileScreen) {
//       switch (steps) {
//         case constants.PROFILE_STEPS.SECTION_A:
//           profileScreen = constants.DOCTOR_SCREENS.DOCTOR_IDENTITY_PROOF;
//           break;
//         case constants.PROFILE_STEPS.SECTION_B:
//           profileScreen = constants.DOCTOR_SCREENS.ESTABLISHMENT_LOCATION;
//           break;
//         case constants.PROFILE_STEPS.SECTION_C:
//           profileScreen = constants.DOCTOR_SCREENS.COMPLETED;
//           break;
//       }
//     }

//     if (!isEdit && profileScreen) {
//       await common.updateByCondition(
//         Doctor,
//         { userId: new ObjectId(userId) },
//         { profileScreen },
//         constants.USER_TYPES.DOCTOR
//       );
//     }

//     if (
//       Math.max(profileScreen, findDoctor[0].profileScreen) > 1 &&
//       !findDoctor[0].profileSlug
//     ) {
//       const profileSlug = await doctorService.generateDoctorSlug(userId);
//       await common.updateByCondition(Doctor, { userId }, { profileSlug });
//     }

//     return response.success(
//       { msgCode: "DOCTOR_UPDATED", data: {} },
//       res,
//       httpStatus.OK
//     );
//   } catch (error) {
//     console.error(error);
//     return response.error(
//       { msgCode: "INTERNAL_SERVER_ERROR" },
//       res,
//       httpStatus.INTERNAL_SERVER_ERROR
//     );
//   }
// };

export const doctorUpdateProfile = async (
  req: DoctorUpdateProfileRequest,
  res: Response
): Promise<void> => {
  try {
    const { steps, isEdit, records, isSaveAndExit } = req.body;
    let { profileScreen } = req.body;
    const { userId } = req.data!;

    const condition = {
      _id: new ObjectId(userId),
      userType: constants.USER_TYPES.DOCTOR,
    };

    const findDoctor = await doctorService.getDoctorProfile(condition);

    // handle not found
    if (!findDoctor || !findDoctor[0]?._id) {
      response.success({ msgCode: "USER_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    if (steps > findDoctor[0].steps) {
      response.error({ msgCode: "INCOMPLETE_PROFILE" }, res, httpStatus.FORBIDDEN);
      return;
    }

    switch (steps) {
      case constants.PROFILE_STEPS.SECTION_A: {
        const {
          basicDetails,
          medicalRegistration,
          education,
          establishmentDetails,
        } = records ?? {};

        if (
          !isEdit &&
          !basicDetails &&
          !medicalRegistration &&
          !education &&
          !establishmentDetails
        ) {
          response.success({ msgCode: "DOCTOR_LOGOUT" }, res, httpStatus.OK);
          return;
        }

        const updates: any = {};
        updates.user = doctorService.updatesUser(basicDetails);
        updates.doctor = doctorService.updatesDoctor(
          basicDetails,
          medicalRegistration,
          education
        );
        updates.establishmentMaster = await doctorService.updatesEstablishmentMaster(
          establishmentDetails,
          findDoctor[0],
          userId
        );

        if (!isEdit && !isSaveAndExit) {
          if (!updates.doctor) updates.doctor = {};
          updates.doctor.steps = constants.PROFILE_STEPS.SECTION_B;
        }

        if (!findDoctor[0].establishmentMasterTimingId && updates.establishmentMaster) {
          // ensure createdBy exists
          updates.establishmentMaster.createdBy = new ObjectId(userId);
          await common.create(EstablishmentTiming, updates.establishmentMaster);
        }

        if (updates.user) {
          await common.updateByCondition(
            User,
            condition,
            updates.user,
            constants.USER_TYPES.DOCTOR
          );
        }

        if (updates.doctor) {
          await common.updateByCondition(
            Doctor,
            { userId: new ObjectId(userId) },
            updates.doctor,
            constants.USER_TYPES.DOCTOR
          );
        }

        if (findDoctor[0].establishmentMasterTimingId && updates.establishmentMaster) {
          await common.updateByCondition(
            EstablishmentTiming,
            { _id: new ObjectId(findDoctor[0].establishmentMasterTimingId) },
            updates.establishmentMaster
          );
        }
        break;
      }

      case constants.PROFILE_STEPS.SECTION_B: {
        const { doctor: doctorData, establishmentDetail, consultationType, consultationDetails } = records ?? {};

        if (!isEdit && !doctorData && !establishmentDetail) {
          response.error({ msgCode: "BAD_REQUEST" }, res, httpStatus.BAD_REQUEST);
          return;
        }

        if (!isEdit && !isSaveAndExit && doctorData) {
          doctorData.steps = constants.PROFILE_STEPS.SECTION_C;
        }

        if (doctorData) {
          if (doctorData.medicalRegistration) {
            doctorData.medicalRegistration = {
              registrationNumber: doctorData.medicalRegistration.registrationNumber,
              council: doctorData.medicalRegistration.council,
              year: doctorData.medicalRegistration.year,
            };
          }
          if (consultationType) doctorData.consultationType = consultationType;
          if (consultationDetails) doctorData.consultationDetails = consultationDetails;

          await common.updateByCondition(
            Doctor,
            { userId: new ObjectId(userId) },
            doctorData,
            constants.USER_TYPES.DOCTOR
          );
        }

        if (establishmentDetail) {
          if (findDoctor[0].isOwnEstablishment) {
            const updateHospital: any = { ...establishmentDetail };
            if (!isEdit) {
              updateHospital.steps = constants.PROFILE_STEPS.SECTION_C;
              updateHospital.profileScreen = constants.HOSPITAL_SCREENS.ESTABLISHMENT_LOCATION;
            }

            await common.updateByCondition(
              Hospital,
              { userId: new ObjectId(userId) },
              updateHospital
            );

            await common.updateByCondition(
              // update EstablishmentMaster by its id
              (await import("../models/EstablishmentMaster")).default,
              { _id: new ObjectId(findDoctor[0].establishmentMasterId) },
              establishmentDetail,
              constants.USER_TYPES.HOSPITAL
            );
          }

          await common.updateByCondition(
            EstablishmentTiming,
            { _id: new ObjectId(findDoctor[0].establishmentMasterTimingId) },
            establishmentDetail
          );
        }
        break;
      }

      // SECTION_C: replicate the same pattern if desired

      default:
        // unknown step -> bad request
        response.error({ msgCode: "BAD_REQUEST" }, res, httpStatus.BAD_REQUEST);
        return;
    }

    // Determine profileScreen if not provided
    if (!profileScreen) {
      switch (steps) {
        case constants.PROFILE_STEPS.SECTION_A:
          profileScreen = constants.DOCTOR_SCREENS.DOCTOR_IDENTITY_PROOF;
          break;
        case constants.PROFILE_STEPS.SECTION_B:
          profileScreen = constants.DOCTOR_SCREENS.ESTABLISHMENT_LOCATION;
          break;
        case constants.PROFILE_STEPS.SECTION_C:
          profileScreen = constants.DOCTOR_SCREENS.COMPLETED;
          break;
      }
    }

    if (!isEdit && profileScreen) {
      await common.updateByCondition(
        Doctor,
        { userId: new ObjectId(userId) },
        { profileScreen },
        constants.USER_TYPES.DOCTOR
      );
    }

    if (
      Math.max(profileScreen as number, findDoctor[0].profileScreen) > 1 &&
      !findDoctor[0].profileSlug
    ) {
      const profileSlug = await doctorService.generateDoctorSlug(userId);
      if (profileSlug) {
        await common.updateByCondition(Doctor, { userId }, { profileSlug });
      }
    }

    response.success({ msgCode: "DOCTOR_UPDATED", data: {} }, res, httpStatus.OK);
    return;
  } catch (error) {
    console.error("doctorUpdateProfile error:", error);
    response.error({ msgCode: "INTERNAL_SERVER_ERROR" }, res, httpStatus.INTERNAL_SERVER_ERROR);
    return;
  }
};


/**
 * Helper: returns array of superadmin ObjectIds (or false on error)
 */
const superAdminList = async (condition?: Record<string, any>): Promise<any[] | false> => {
  try {
    const adminType = (constants && constants.USER_TYPES && constants.USER_TYPES.ADMIN) ? constants.USER_TYPES.ADMIN : 4;
    const matchCondition = condition ?? { userType: adminType };

    const data = await Admin.aggregate([
      { $match: matchCondition },
      { $project: { _id: 1 } },
    ]);

    return data.map((adminDoc: any) => adminDoc._id);
  } catch (error) {
    console.error("superAdminList error:", error);
    return false;
  }
};

export const doctorAddEstablishment2 = async (req: Request, res: Response): Promise<void> => {
  try {
    // userId (from token). If admin, can override with ?userId=...
    let { userId, isAdmin } = (req as any).data || {};
    if (isAdmin && req.query.userId && typeof req.query.userId === "string") {
      userId = req.query.userId;
    }

    if (!userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
      return;
    }
    const {
      hospitalId,
      isOwner,
      profilePic,
      name,
      hospitalTypeId,
      consultationFees,
      videoConsultationFees,
      address,
      location,
      isLocationShared,
      establishmentMobile,
      establishmentEmail,
      mon,
      tue,
      wed,
      thu,
      fri,
      sat,
      sun,
      ownEstablishmentExist,
      secoundOwnEstablishemnt,
      establishmentProof
    } = req.body as any;

    // find Establishment using Hospital Id in Visiting Case..
    const estabMsterCondition: any = {};
    if (hospitalId) estabMsterCondition.hospitalId = new Types.ObjectId(String(hospitalId));

    const findEstablishment = hospitalId ? await common.getByCondition(EstablishmentMaster, estabMsterCondition) : null;

    // find Doctor using Decoded Id..
    const findDoctor = await common.getByCondition(Doctor, { userId: new Types.ObjectId(String(userId)) });
    if (!findDoctor) {
      response.success({ msgCode: "DATA_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    // helper condition for user (owner case)
    const condition = {
      _id: new Types.ObjectId(String(userId)),
    };

    // ======= CASE: isOwner === 1 (doctor creates/owns a hospital) =======
    if (isOwner === 1) {
      // const checkUser = await common.getByCondition(User, condition);
      // if (checkUser && Array.isArray(checkUser.userType) && checkUser.userType.includes(constants.USER_TYPES.HOSPITAL) && ownEstablishmentExist) {
      //   response.error({ msgCode: "ALREADY_ADDED_HOSPITAL" }, res, httpStatus.CONFLICT);
      //   return;
      // }
      const checkUser = await common.getByCondition(User, condition);
      if (
        checkUser &&
        Array.isArray((checkUser as any).userType) &&
        (checkUser as any).userType.includes(constants.USER_TYPES.HOSPITAL) &&
        ownEstablishmentExist
      ) {
        response.error({ msgCode: "ALREADY_ADDED_HOSPITAL" }, res, httpStatus.CONFLICT);
        return;
      }


      const userTableData = {
        userType: [constants.USER_TYPES.DOCTOR, constants.USER_TYPES.HOSPITAL],
      };
      const addUserType = await common.updateByCondition(User, condition, userTableData);
      if (!addUserType) {
        response.error({ msgCode: "FAILED_TO_ADD" }, res, httpStatus.FORBIDDEN);
        return;
      }

      const dataHospital: any = {
        userId: new Types.ObjectId(String(userId)),
        profilePic,
        address,
        location,
        isLocationShared,
        hospitalType: hospitalTypeId,
        totalDoctor: 1,
        steps: 4,
        establishmentProof
      };

      // update doctor's steps and notify admins if required
      if ((findDoctor as any).steps != 4) {
        await Doctor.findByIdAndUpdate((findDoctor as any)._id || (findDoctor as any).id, { steps: 4 }, { new: true });

        const superadminArray = await superAdminList();
        if (superadminArray && Array.isArray(superadminArray)) {
          await common.create(Notification, {
            userType: constants.USER_TYPES.ADMIN,
            eventType: constants.NOTIFICATION_TYPE.DOCTOR_SIGN_UP_PROOFS,
            senderId: new ObjectId(String(userId)),
            receiverId: superadminArray,
            title: constants.MESSAGES.DOCTOR_SIGN_UP_PROOFS.TITLE,
            body: constants.MESSAGES.DOCTOR_SIGN_UP_PROOFS.BODY,
          });
        }
      }

      const hospitalData = await common.create(Hospital, dataHospital);

      const estabMasterData: any = {
        hospitalId: (hospitalData as any)._id,
        name,
        hospitalTypeId,
        address,
        location,
        isLocationShared,
        establishmentMobile,
        establishmentEmail,
        establishmentProof,
      };

      const establishmentMasterData = await common.create(EstablishmentMaster, estabMasterData);

      const estabTimingData: any = {
        establishmentId: (establishmentMasterData as any)._id,
        doctorId: (findDoctor as any)._id,
        isOwner,
        consultationFees,
        videoConsultationFees,
        mon,
        tue,
        wed,
        thu,
        fri,
        sat,
        sun,
        isVerified: 2,
        createdBy: userId,
        establishmentProof
      };
      // console.log("estabTimingData: ",estabTimingData);

      const establishmentTimingData = await common.create(EstablishmentTiming, estabTimingData);

      response.success({
        msgCode: "DATA_CREATED",
        data: {
          ...(addUserType as any)._doc,
          ...(hospitalData as any)._doc,
          ...(establishmentMasterData as any)._doc,
          ...(establishmentTimingData as any)._doc,
        },
      }, res, httpStatus.CREATED);
      return;
    }

    // ======= CASE: hospitalId provided and isOwner === 0 (visiting case) =======
    else if (hospitalId && Number(isOwner) === 0) {
      if ((findDoctor as any).steps != 4) {
        await Doctor.findByIdAndUpdate((findDoctor as any)._id || (findDoctor as any).id, { steps: 4 }, { new: true });
        const superadminArray = await superAdminList();
        if (superadminArray && Array.isArray(superadminArray)) {
          await common.create(Notification, {
            userType: constants.USER_TYPES.ADMIN,
            eventType: constants.NOTIFICATION_TYPE.DOCTOR_SIGN_UP_PROOFS,
            senderId: new ObjectId(String(userId)),
            receiverId: superadminArray,
            title: constants.MESSAGES.DOCTOR_SIGN_UP_PROOFS.TITLE,
            body: constants.MESSAGES.DOCTOR_SIGN_UP_PROOFS.BODY,
          });
        }
      }

      if (!findEstablishment) {
        response.success({ msgCode: "DATA_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
        return;
      }

      const checkCondition = {
        doctorId: (findDoctor as any)._id,
        establishmentId: (findEstablishment as any)._id,
        isDeleted: false,
      };
      const checkHospital = await common.getByCondition(EstablishmentTiming, checkCondition);
      if (checkHospital) {
        response.error({ msgCode: "HOSPITAL_EXISTS" }, res, httpStatus.CONFLICT);
        return;
      }

      const visitData: any = {
        doctorId: (findDoctor as any)._id,
        establishmentId: (findEstablishment as any)._id,
        isOwner,
        consultationFees,
        videoConsultationFees,
        mon,
        tue,
        wed,
        thu,
        fri,
        sat,
        sun,
        isVerified: 2,
        createdBy: userId,
        establishmentProof
      };
      const establishmentVisitData = await common.create(EstablishmentTiming, visitData);

      response.success({
        msgCode: "DATA_CREATED",
        data: { establishmentVisitData },
      }, res, httpStatus.CREATED);
      return;
    }

    // ======= CASE: !hospitalId and isOwner === 0 (create visiting hospital record) =======
    else if (!hospitalId && Number(isOwner) === 0) {
      if ((findDoctor as any).steps != 4) {
        await Doctor.findByIdAndUpdate((findDoctor as any)._id || (findDoctor as any).id, { steps: 4 }, { new: true });
        const superadminArray = await superAdminList();
        if (superadminArray && Array.isArray(superadminArray)) {
          await common.create(Notification, {
            userType: constants.USER_TYPES.ADMIN,
            eventType: constants.NOTIFICATION_TYPE.DOCTOR_SIGN_UP_PROOFS,
            senderId: new ObjectId(String(userId)),
            receiverId: superadminArray,
            title: constants.MESSAGES.DOCTOR_SIGN_UP_PROOFS.TITLE,
            body: constants.MESSAGES.DOCTOR_SIGN_UP_PROOFS.BODY,
          });
        }
      }

      const dataHospital = {
        userId: new Types.ObjectId(String(userId)),
        profilePic,
        address,
        location,
        isLocationShared,
      };
      const hospitalData = await common.create(Hospital, dataHospital);

      const estabMasterData: any = {
        hospitalId: (hospitalData as any)._id,
        name,
        hospitalTypeId,
        address,
        location,
        isLocationShared,
        establishmentMobile,
        establishmentEmail,
        profileSlug: (findDoctor as any).profileSlug,
        establishmentProof
      };
      const establishmentMasterData = await common.create(EstablishmentMaster, estabMasterData);

      const estabTimingData: any = {
        establishmentId: (establishmentMasterData as any)._id,
        doctorId: (findDoctor as any)._id,
        isOwner,
        consultationFees,
        videoConsultationFees,
        mon,
        tue,
        wed,
        thu,
        fri,
        sat,
        sun,
        isVerified: 2,
        createdBy: userId,
        establishmentProof
      };
      const establishmentTimingData = await common.create(EstablishmentTiming, estabTimingData);

      response.success({
        msgCode: "DATA_CREATED",
        data: {
          ...(hospitalData as any)._doc,
          ...(establishmentMasterData as any)._doc,
          ...(establishmentTimingData as any)._doc,
        },
      }, res, httpStatus.CREATED);
      return;
    }

    // if nothing matched
    response.error({ msgCode: "BAD_REQUEST" }, res, httpStatus.BAD_REQUEST);
    return;
  } catch (error) {
    console.error("doctorAddEstablishment error:", error);
    response.error({ msgCode: "INTERNAL_SERVER_ERROR" }, res, httpStatus.INTERNAL_SERVER_ERROR);
    return;
  }
};

interface TimeSlot {
    from: string;
    to: string;
    slot?: string; // Optional field based on your frontend payload
}

/**
 * Converts a time string (e.g., "09:30 AM") to total minutes from midnight (0 to 1439).
 */
const timeToMinutes = (time: string): number => {
    if (!time || typeof time !== 'string') return -1;
    const [timePart, ampm] = time.split(' ');
    if (!timePart) return -1;

    let [hours, minutes] = timePart.split(':').map(Number);

    if (ampm === 'PM' && hours < 12) {
        hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
        hours = 0; // 12:xx AM is hour 0
    }
    
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return -1;

    return hours * 60 + minutes;
};


// =================================================================================
// 🏥 Controller Function: doctorAddEstablishment (UPDATED)
// - Ensures new establishment times do NOT overlap with any existing timings
// - Ensures new establishment's internal slots don't overlap among themselves
// - Allows any number of establishments otherwise
// - Allows ONLY one video-consultation establishment per doctor
// =================================================================================
// const getDocData = (doc: any): any => (doc && doc._doc) ? doc._doc : doc;

// export const doctorAddEstablishment = async (req: Request, res: Response): Promise<void> => {
//     try {
//         let { userId, isAdmin } = (req as any).data || {};
//         if (isAdmin && req.query.userId && typeof req.query.userId === "string") {
//             userId = req.query.userId;
//         }

//         if (!userId) {
//             response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
//             return;
//         }
        
//         const doctorUserId = String(userId);

//         // Destructuring body payload (using standard types)
//         const {
//             hospitalId, isOwner, profilePic, name, hospitalTypeId, consultationFees, videoConsultationFees,
//             address, location, isLocationShared, establishmentMobile, establishmentEmail,
//             mon, tue, wed, thu, fri, sat, sun,
//             showVideo, // 💡 New required field for video consultation
//             ownEstablishmentExist, establishmentProof
//         } = req.body;
//         console.log("Request body:", req.body);

//         // --- Find Doctor and Establishment ---
//         const findDoctor = await common.getByCondition(Doctor, { userId: new Types.ObjectId(doctorUserId) });
//         if (!findDoctor) {
//             response.error({ msgCode: "DOCTOR_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
//             return;
//         }
//         const findDoctorId = (findDoctor as any)._id || (findDoctor as any).id;

//         let findEstablishment: any = null;
//         if (hospitalId) {
//              const estabMsterCondition: any = { hospitalId: new Types.ObjectId(String(hospitalId)) };
//              findEstablishment = await common.getByCondition(EstablishmentMaster, estabMsterCondition);
//         }
        
//         // Array of days for easy iteration
//         const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

//         // -------------------------
//         // Helpers: time parsing / overlap
//         // -------------------------
//         const timeToMinutes = (time: string): number => {
//             if (!time || typeof time !== 'string') return -1;
//             const s = time.trim();

//             // Accept "09:30 AM" or "9:30 AM"
//             const ampmMatch = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
//             if (ampmMatch) {
//                 let hh = parseInt(ampmMatch[1], 10);
//                 const mm = parseInt(ampmMatch[2], 10);
//                 const ampm = ampmMatch[3].toUpperCase();
//                 if (ampm === 'AM' && hh === 12) hh = 0;
//                 if (ampm === 'PM' && hh !== 12) hh += 12;
//                 if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return -1;
//                 return hh * 60 + mm;
//             }

//             // Accept "09:30" (24-hour)
//             const twentyFour = s.match(/^(\d{1,2}):(\d{2})$/);
//             if (twentyFour) {
//                 const hh = parseInt(twentyFour[1], 10);
//                 const mm = parseInt(twentyFour[2], 10);
//                 if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return -1;
//                 return hh * 60 + mm;
//             }

//             return -1;
//         };

//         const intervalsOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean => {
//             // Return true if intervals overlap in any interior point.
//             // This treats back-to-back (aEnd === bStart) as non-overlapping.
//             return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
//         };

//         // -------------------------
//         // 1. Fetch ALL existing active EstablishmentTiming entries for the doctor
//         // -------------------------
//         const existingTimings: any[] = await common.getManyByCondition(EstablishmentTiming, {
//             doctorId: findDoctorId,
//             isDeleted: false,
//         });

//         // -------------------------
//         // 2. Video uniqueness validation
//         // -------------------------
//         const isNewEstablishmentVideo = showVideo === true;
//         if (isNewEstablishmentVideo) {
//             const existingVideoConsultations = existingTimings.filter((t: any) => t.showVideo === true);
//             if (existingVideoConsultations.length > 0) {
//                 response.error(
//                     { msgCode: "VIDEO_LIMIT_EXCEEDED", message: "Only one Video Consultation establishment is allowed per doctor." },
//                     res,
//                     httpStatus.CONFLICT
//                 );
//                 return;
//             }
//         }

//         // -------------------------
//         // 3. Build a fast lookup of existing slots by day (only existing)
//         //    We'll only check new slots against these; that prevents false positives
//         // -------------------------
//         type Slot = { start: number; end: number; sourceId?: string; isVideo?: boolean };
//         const existingSlotsByDay: Record<string, Slot[]> = {};
//         dayKeys.forEach(d => existingSlotsByDay[d] = []);

//         const addExistingSlotsFromTiming = (timing: any) => {
//             if (!timing) return;
//             for (const d of dayKeys) {
//                 const arr = Array.isArray(timing[d]) ? timing[d] : [];
//                 for (const slot of arr) {
//                     const start = timeToMinutes(String(slot.from || slot.fromTime || slot.from_time || ''));
//                     const end = timeToMinutes(String(slot.to || slot.toTime || slot.to_time || ''));
//                     if (start === -1 || end === -1) continue;
//                     if (end <= start) continue;
//                     existingSlotsByDay[d].push({ start, end, sourceId: String(timing._id || timing.establishmentId || ''), isVideo: !!timing.showVideo });
//                 }
//             }
//         };

//         for (const timing of existingTimings) {
//             addExistingSlotsFromTiming(timing);
//         }

//         // -------------------------
//         // 4. Build newSlotsByDay from incoming request (expand 'all' if necessary)
//         //    Validate new slots for correctness and internal overlaps
//         // -------------------------
//         const newInput: Record<string, any[]> = { mon, tue, wed, thu, fri, sat, sun };
//         const newSlotsByDay: Record<string, Slot[]> = {};
//         dayKeys.forEach(d => newSlotsByDay[d] = []);

//         // Helper to process an array of slots for a given dayOrAll key
//         const processIncomingDaySlots = (inputSlots: any[] | undefined, dayOrAll: string) => {
//             if (!Array.isArray(inputSlots) || inputSlots.length === 0) return;
//             const applyDays = dayOrAll === 'all' ? dayKeys : [dayOrAll];
//             for (const s of inputSlots) {
//                 const start = timeToMinutes(String(s.from || s.fromTime || s.from_time || ''));
//                 const end = timeToMinutes(String(s.to || s.toTime || s.to_time || ''));
//                 if (start === -1 || end === -1 || end <= start) {
//                     throw new Error(`Invalid time slot provided for ${dayOrAll}: ${s.from} - ${s.to}`);
//                 }
//                 for (const d of applyDays) {
//                     newSlotsByDay[d].push({ start, end, sourceId: 'new', isVideo: isNewEstablishmentVideo });
//                 }
//             }
//         };

//         // Process each day key from body. Also support incoming day value 'all' if they send that.
//         // If frontend packs days differently (like days: [{day:'mon', timeSlots:[..]}]) adapt accordingly.
//         try {
//             for (const key of Object.keys(newInput)) {
//                 // Accept either array directly for each day (mon: [{from,to},..]) or undefined
//                 processIncomingDaySlots(newInput[key], key);
//             }
//             // Also check if user sent 'all' as a separate key in payload (some frontends do)
//             if (Array.isArray((req.body as any).all) && (req.body as any).all.length) {
//                 processIncomingDaySlots((req.body as any).all, 'all');
//             }
//         } catch (err: any) {
//             response.error({ msgCode: "INVALID_TIME_SLOT", message: err.message || 'Invalid time slot' }, res, httpStatus.BAD_REQUEST);
//             return;
//         }

//         // Validate internal overlaps within NEW slots (per day)
//         for (const d of dayKeys) {
//             const arr = newSlotsByDay[d];
//             // sort by start
//             arr.sort((a, b) => a.start - b.start);
//             for (let i = 0; i < arr.length; i++) {
//                 const s1 = arr[i];
//                 if (s1.start >= s1.end) {
//                     response.error({ msgCode: "INVALID_TIME_SLOT", message: `On ${d.toUpperCase()}, a slot has from >= to.` }, res, httpStatus.BAD_REQUEST);
//                     return;
//                 }
//                 for (let j = i + 1; j < arr.length; j++) {
//                     const s2 = arr[j];
//                     if (intervalsOverlap(s1.start, s1.end, s2.start, s2.end)) {
//                         response.error({ msgCode: "INTERNAL_SLOT_CONFLICT", message: `Selected time slots on ${d.toUpperCase()} overlap with each other.` }, res, httpStatus.CONFLICT);
//                         return;
//                     }
//                 }
//             }
//         }

//         // -------------------------
//         // 5. Validate NEW slots do not overlap with ANY existing slot (across all establishments)
//         // -------------------------
//         for (const d of dayKeys) {
//             const existing = existingSlotsByDay[d] || [];
//             const incoming = newSlotsByDay[d] || [];
//             if (!incoming.length) continue;

//             for (const newSlot of incoming) {
//                 for (const exSlot of existing) {
//                     if (intervalsOverlap(newSlot.start, newSlot.end, exSlot.start, exSlot.end)) {
//                         // Build friendly message mentioning day and example existing time
//                         const toHHMM = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
//                         const message = `Submitted timings conflict with an existing schedule on ${d.toUpperCase()} (${toHHMM(exSlot.start)}-${toHHMM(exSlot.end)}). Please choose non-overlapping times.`;
//                         response.error({ msgCode: "TIMING_CONFLICT", message }, res, httpStatus.CONFLICT);
//                         return;
//                     }
//                 }
//             }
//         }

//         // =========================
//         // 🎯 VALIDATION COMPLETE: create/save records according to incoming flags
//         // =========================

//         const userCondition = { _id: new Types.ObjectId(doctorUserId) };
//         const userData = await common.getById(User, doctorUserId); // Fetch user data

//         // ======= CASE: isOwner === 1 (doctor creates/owns a hospital) =======
//         if (Number(isOwner) === 1) {
//             const checkUser = await common.getByCondition(User, userCondition);
//             // if (
//             //     checkUser &&
//             //     Array.isArray((checkUser as any).userType) &&
//             //     (checkUser as any).userType.includes(constants.USER_TYPES.HOSPITAL) &&
//             //     ownEstablishmentExist
//             // ) 
//             // {
//             //     response.error({ msgCode: "ALREADY_ADDED_HOSPITAL" }, res, httpStatus.CONFLICT);
//             //     return;
//             // }

//             // Allow multiple owned establishments.
//             // Only restrict if trying to create more than one VIDEO consultation establishment.
//             if (isNewEstablishmentVideo) {
//               const existingVideoEstablishments = await common.getManyByCondition(EstablishmentTiming, {
//                 doctorId: findDoctorId,
//                 showVideo: true,
//                 isDeleted: false,
//               });

//               if (existingVideoEstablishments.length > 0) {
//                 response.error(
//                   { msgCode: "VIDEO_LIMIT_EXCEEDED", message: "Only one video consultation establishment allowed per doctor." },
//                   res,
//                   httpStatus.CONFLICT
//                 );
//                 return;
//               }
//             }


//             const userTableData = {
//                 userType: [constants.USER_TYPES.DOCTOR, constants.USER_TYPES.HOSPITAL],
//             };
//             const addUserType = await common.updateByCondition(User, userCondition, userTableData);
//             if (!addUserType) {
//                 response.error({ msgCode: "FAILED_TO_ADD" }, res, httpStatus.FORBIDDEN);
//                 return;
//             }

//             // const dataHospital: any = {
//             //     userId: new Types.ObjectId(doctorUserId),
//             //     profilePic, address, location, isLocationShared,
//             //     hospitalType: hospitalTypeId, totalDoctor: 1, steps: 4, establishmentProof
//             // };
//             const dataHospital: any = {
//                 userId: new Types.ObjectId(doctorUserId),
//                 profilePic, address, location, isLocationShared,
//                 totalDoctor: 1, steps: 4, establishmentProof
//             };

//             if (hospitalTypeId) {
//                 dataHospital.hospitalType = hospitalTypeId;
//             }

//             if ((findDoctor as any).steps != 4) {
//                 await Doctor.findByIdAndUpdate(findDoctorId, { steps: 4 }, { new: true });
//                 const superadminArray = await superAdminList();
//                 if (superadminArray && Array.isArray(superadminArray)) {
//                     await common.create(Notification, {
//                         userType: constants.USER_TYPES.ADMIN,
//                         eventType: constants.NOTIFICATION_TYPE.DOCTOR_SIGN_UP_PROOFS,
//                         senderId: new ObjectId(doctorUserId),
//                         receiverId: superadminArray,
//                         title: constants.MESSAGES.DOCTOR_SIGN_UP_PROOFS.TITLE,
//                         body: constants.MESSAGES.DOCTOR_SIGN_UP_PROOFS.BODY,
//                     });
//                 }
//             }

//             const hospitalData = await common.create(Hospital, dataHospital);
//             // const hospitalData = await common.create(Hospital, dataHospital);
//             // const estabMasterData: any = {
//             //     hospitalId: (hospitalData as any)._id, name, hospitalTypeId, address, location, isLocationShared,
//             //     establishmentMobile, establishmentEmail, establishmentProof,
//             // };
//             const estabMasterData: any = {
//                 hospitalId: (hospitalData as any)._id, 
//                 name, 
//                 address, 
//                 location, 
//                 isLocationShared,
//                 establishmentMobile, 
//                 establishmentEmail, 
//                 establishmentProof,
//             };
//             if (hospitalTypeId) { // Checks if hospitalTypeId is not null, undefined, 0, false, or ""
//                 estabMasterData.hospitalTypeId = hospitalTypeId;
//             }
//             // const establishmentMasterData = await common.create(EstablishmentMaster, estabMasterData);
//             const establishmentMasterData = await common.create(EstablishmentMaster, estabMasterData);

//             const estabTimingData: any = {
//                 establishmentId: (establishmentMasterData as any)._id,
//                 doctorId: findDoctorId, isOwner, consultationFees, videoConsultationFees,
//                 mon, tue, wed, thu, fri, sat, sun,
//                 isVerified: 2, createdBy: doctorUserId, establishmentProof,
//                 showVideo: isNewEstablishmentVideo, // 💡 SAVING VIDEO FLAG
//             };

//             const establishmentTimingData = await common.create(EstablishmentTiming, estabTimingData);

//             response.success({
//                 msgCode: "DATA_CREATED",
//                 data: {
//                     ...getDocData(addUserType), ...getDocData(hospitalData),
//                     ...getDocData(establishmentMasterData), ...getDocData(establishmentTimingData),
//                 },
//             }, res, httpStatus.CREATED);
//             return;
//         }

//         // ======= CASE: hospitalId provided and isOwner === 0 (visiting case) =======
//         else if (hospitalId && Number(isOwner) === 0) {
//             if ((findDoctor as any).steps != 4) {
//                 await Doctor.findByIdAndUpdate(findDoctorId, { steps: 4 }, { new: true });
//                 const superadminArray = await superAdminList();
//                 if (superadminArray && Array.isArray(superadminArray)) {
//                     await common.create(Notification, {
//                         userType: constants.USER_TYPES.ADMIN,
//                         eventType: constants.NOTIFICATION_TYPE.DOCTOR_SIGN_UP_PROOFS,
//                         senderId: new ObjectId(doctorUserId),
//                         receiverId: superadminArray,
//                         title: constants.MESSAGES.DOCTOR_SIGN_UP_PROOFS.TITLE,
//                         body: constants.MESSAGES.DOCTOR_SIGN_UP_PROOFS.BODY,
//                     });
//                 }
//             }

//             if (!findEstablishment) {
//                 response.error({ msgCode: "ESTABLISHMENT_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
//                 return;
//             }

//             const checkCondition = {
//                 doctorId: findDoctorId,
//                 establishmentId: (findEstablishment as any)._id,
//                 isDeleted: false,
//             };
//             const checkHospital = await common.getByCondition(EstablishmentTiming, checkCondition);
//             if (checkHospital) {
//                 response.error({ msgCode: "HOSPITAL_EXISTS" }, res, httpStatus.CONFLICT);
//                 return;
//             }

//             const visitData: any = {
//                 doctorId: findDoctorId,
//                 establishmentId: (findEstablishment as any)._id,
//                 isOwner, consultationFees, videoConsultationFees,
//                 mon, tue, wed, thu, fri, sat, sun,
//                 isVerified: 2, createdBy: doctorUserId, establishmentProof,
//                 showVideo: isNewEstablishmentVideo, // 💡 SAVING VIDEO FLAG
//             };
//             const establishmentVisitData = await common.create(EstablishmentTiming, visitData);

//             response.success({
//                 msgCode: "DATA_CREATED",
//                 data: { establishmentVisitData },
//             }, res, httpStatus.CREATED);
//             return;
//         }

//         // ======= CASE: !hospitalId and isOwner === 0 (create new master and timing for visiting) =======
//         else if (!hospitalId && Number(isOwner) === 0) {
//             if ((findDoctor as any).steps != 4) {
//                 await Doctor.findByIdAndUpdate(findDoctorId, { steps: 4 }, { new: true });
//                 const superadminArray = await superAdminList();
//                 if (superadminArray && Array.isArray(superadminArray)) {
//                     await common.create(Notification, {
//                         userType: constants.USER_TYPES.ADMIN,
//                         eventType: constants.NOTIFICATION_TYPE.DOCTOR_SIGN_UP_PROOFS,
//                         senderId: new ObjectId(doctorUserId),
//                         receiverId: superadminArray,
//                         title: constants.MESSAGES.DOCTOR_SIGN_UP_PROOFS.TITLE,
//                         body: constants.MESSAGES.DOCTOR_SIGN_UP_PROOFS.BODY,
//                     });
//                 }
//             }

//             const dataHospital = {
//                 userId: new Types.ObjectId(doctorUserId), profilePic, address, location, isLocationShared,
//             };
//             const hospitalData = await common.create(Hospital, dataHospital);

//             const estabMasterData: any = {
//                 hospitalId: (hospitalData as any)._id, name, hospitalTypeId, address, location, isLocationShared,
//                 establishmentMobile, establishmentEmail, profileSlug: (findDoctor as any).profileSlug, establishmentProof
//             };
//             const establishmentMasterData = await common.create(EstablishmentMaster, estabMasterData);

//             const estabTimingData: any = {
//                 establishmentId: (establishmentMasterData as any)._id,
//                 doctorId: findDoctorId, isOwner, consultationFees, videoConsultationFees,
//                 mon, tue, wed, thu, fri, sat, sun,
//                 isVerified: 2, createdBy: doctorUserId, establishmentProof,
//                 showVideo: isNewEstablishmentVideo, // 💡 SAVING VIDEO FLAG
//             };
//             const establishmentTimingData = await common.create(EstablishmentTiming, estabTimingData);

//             response.success({
//                 msgCode: "DATA_CREATED",
//                 data: {
//                     ...getDocData(hospitalData), ...getDocData(establishmentMasterData),
//                     ...getDocData(establishmentTimingData),
//                 },
//             }, res, httpStatus.CREATED);
//             return;
//         }

//         // if nothing matched
//         response.error({ msgCode: "BAD_REQUEST" }, res, httpStatus.BAD_REQUEST);
//         return;
//     } catch (error) {
//         console.error("doctorAddEstablishment error:", error);
//         response.error({ msgCode: "INTERNAL_SERVER_ERROR" }, res, httpStatus.INTERNAL_SERVER_ERROR);
//         return;
//     }
// };

const slugify = (str: string): string => 
    str.toLowerCase()
       .replace(/[^a-z0-9\s-]/g, '') // Remove all special chars except letters, numbers, and spaces
       .trim()
       .replace(/\s+/g, '-');    
const getDocData = (doc: any): any => (doc && doc._doc) ? doc._doc : doc;

export const doctorAddEstablishment = async (req: Request, res: Response): Promise<void> => {
  // console.log("doctorAddEstablishment called");
  // console.log("Request body:", req.body);
    try {
        let { userId, isAdmin } = (req as any).data || {};
        if (isAdmin && req.query.userId && typeof req.query.userId === "string") {
            userId = req.query.userId;
        }

        if (!userId) {
            response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
            return;
        }
        const doctorUserId = String(userId);
        // Destructuring body payload (using standard types)
        const {
            hospitalId, isOwner, profilePic, name, hospitalTypeId, consultationFees, videoConsultationFees,
            address, location, isLocationShared, establishmentMobile, establishmentEmail,
            mon, tue, wed, thu, fri, sat, sun,
            showVideo, // 💡 Flag indicating video consultation
            Consultation_type, // 💡 Used by frontend to determine type in absence of showVideo/showInClinic
            ownEstablishmentExist, establishmentProof,availableModes,consultationMode,isCustomEstablishment
        } = req.body;

        // --- Find Doctor and Establishment ---
        const findDoctor = await common.getByCondition(Doctor, { userId: new Types.ObjectId(doctorUserId) });
        if (!findDoctor) {
            response.error({ msgCode: "DOCTOR_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
            return;
        }
        const findDoctorId = (findDoctor as any)._id || (findDoctor as any).id;

        let findEstablishment: any = null;
        if (hospitalId) {
             const estabMsterCondition: any = { hospitalId: new Types.ObjectId(String(hospitalId)) };
             findEstablishment = await common.getByCondition(EstablishmentMaster, estabMsterCondition);
        }
        
        const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

        // -------------------------
        // Helper Functions defined here for proper scoping
        // -------------------------
        const timeToMinutes = (time: string): number => {
            if (!time || typeof time !== 'string') return -1;
            const s = time.trim();
            const ampmMatch = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (ampmMatch) {
                let hh = parseInt(ampmMatch[1], 10);
                const mm = parseInt(ampmMatch[2], 10);
                const ampm = ampmMatch[3].toUpperCase();
                if (ampm === 'AM' && hh === 12) hh = 0;
                if (ampm === 'PM' && hh !== 12) hh += 12;
                if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return -1;
                return hh * 60 + mm;
            }
            const twentyFour = s.match(/^(\d{1,2}):(\d{2})$/);
            if (twentyFour) {
                const hh = parseInt(twentyFour[1], 10);
                const mm = parseInt(twentyFour[2], 10);
                if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return -1;
                return hh * 60 + mm;
            }
            return -1;
        };

        const intervalsOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean => {
            // Check for overlap (where touching endpoints are NOT considered overlap)
            return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
        };
        // -------------------------

        // -------------------------
        // 1. Fetch ALL existing active EstablishmentTiming entries for the doctor
        // -------------------------
        const existingTimings: any[] = await common.getManyByCondition(EstablishmentTiming, {
            doctorId: findDoctorId,
            isDeleted: false,
        });

        // -------------------------
        // 2. Video uniqueness validation check
        // -------------------------
        const isNewEstablishmentVideo = consultationMode === "video-only" && availableModes.video === true;
//         const isNewEstablishmentVideo = showVideo === true && availableModes.includes('video') === true || Consultation_type === 'video';
        console.log("isNewEstablishmentVideo: ", isNewEstablishmentVideo);
        
        if (isNewEstablishmentVideo) {
            const existingVideoConsultations = existingTimings.filter((t: any) => 
                t.showVideo === true || t.Consultation_type === 'video'
            );
            
            if (existingVideoConsultations.length > 0) {
                response.error(
                    { msgCode: "VIDEO_LIMIT_EXCEEDED", message: "Only one Video Consultation establishment is allowed per doctor." },
                    res,
                    httpStatus.CONFLICT
                );
                return;
            }
        }

        // -------------------------
        // 3. Build a fast lookup of existing slots by day (Only for in-clinic overlap check)
        // -------------------------
        type Slot = { start: number; end: number; sourceId?: string; isVideo?: boolean };
        const existingSlotsByDay: Record<string, Slot[]> = {};
        dayKeys.forEach(d => existingSlotsByDay[d] = []);

        const addExistingSlotsFromTiming = (timing: any) => {
            if (!timing) return;

            for (const d of dayKeys) {
                const arr = Array.isArray(timing[d]) ? timing[d] : [];
                for (const slot of arr) {
                    const start = timeToMinutes(String(slot.from || slot.fromTime || slot.from_time || ''));
                    const end = timeToMinutes(String(slot.to || slot.toTime || slot.to_time || ''));
                    if (start === -1 || end === -1) continue;
                    if (end <= start) continue;
                    existingSlotsByDay[d].push({ start, end, sourceId: String(timing._id || timing.establishmentId || ''), isVideo: !!timing.showVideo });
                }
            }
        };

        for (const timing of existingTimings) {
            addExistingSlotsFromTiming(timing);
        }

        // -------------------------
        // 4. Build newSlotsByDay from incoming request & Internal validation
        // -------------------------
        const newInput: Record<string, any[]> = { mon, tue, wed, thu, fri, sat, sun };
        const newSlotsByDay: Record<string, Slot[]> = {};
        dayKeys.forEach(d => newSlotsByDay[d] = []);

        const processIncomingDaySlotsImplementation = (inputSlots: any[] | undefined, dayOrAll: string) => {
            if (!Array.isArray(inputSlots) || inputSlots.length === 0) return;
            const applyDays = dayOrAll === 'all' ? dayKeys : [dayOrAll];
            for (const s of inputSlots) {
                const start = timeToMinutes(String(s.from || s.fromTime || s.from_time || ''));
                const end = timeToMinutes(String(s.to || s.toTime || s.to_time || ''));
                if (start === -1 || end === -1 || end <= start) {
                    throw new Error(`Invalid time slot provided for ${dayOrAll}: ${s.from} - ${s.to}`);
                }
                for (const d of applyDays) {
                    newSlotsByDay[d].push({ start, end, sourceId: 'new', isVideo: isNewEstablishmentVideo });
                }
            }
        };
        
        try {
            for (const key of Object.keys(newInput)) {
                processIncomingDaySlotsImplementation(newInput[key], key);
            }
            if (Array.isArray((req.body as any).all) && (req.body as any).all.length) {
                processIncomingDaySlotsImplementation((req.body as any).all, 'all');
            }
        } catch (err: any) {
            response.error({ msgCode: "INVALID_TIME_SLOT", message: err.message || 'Invalid time slot' }, res, httpStatus.BAD_REQUEST);
            return;
        }
        
        // Validate internal overlaps within NEW slots (per day)
        for (const d of dayKeys) {
            const arr = newSlotsByDay[d];
            arr.sort((a, b) => a.start - b.start);
            for (let i = 0; i < arr.length; i++) {
                const s1 = arr[i];
                if (s1.start >= s1.end) {
                    response.error({ msgCode: "INVALID_TIME_SLOT", message: `On ${d.toUpperCase()}, a slot has from >= to.` }, res, httpStatus.BAD_REQUEST);
                    return;
                }
                for (let j = i + 1; j < arr.length; j++) {
                    const s2 = arr[j];
                    if (intervalsOverlap(s1.start, s1.end, s2.start, s2.end)) { // 🎯 intervalsOverlap is now defined
                        response.error({ msgCode: "INTERNAL_SLOT_CONFLICT", message: `Selected time slots on ${d.toUpperCase()} overlap with each other.` }, res, httpStatus.CONFLICT);
                        return;
                    }
                }
            }
        }

        // -------------------------
        // 5. Validate NEW IN-CLINIC slots do not overlap with existing IN-CLINIC slots
        // -------------------------
        if (!isNewEstablishmentVideo) { // Only perform external overlap check for in-clinic/combined
            for (const d of dayKeys) {
                const existing = existingSlotsByDay[d] || [];
                const incoming = newSlotsByDay[d] || [];
                if (!incoming.length) continue;

                for (const newSlot of incoming) {
                    for (const exSlot of existing) {
                        if (intervalsOverlap(newSlot.start, newSlot.end, exSlot.start, exSlot.end)) { // 🎯 intervalsOverlap is now defined
                            const toHHMM = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
                            const message = `Submitted timings conflict with an existing **in-clinic** schedule on ${d.toUpperCase()} (${toHHMM(exSlot.start)}-${toHHMM(exSlot.end)}). Please choose non-overlapping times.`;
                            response.error({ msgCode: "TIMING_CONFLICT", message }, res, httpStatus.CONFLICT);
                            return;
                        }
                    }
                }
            }
        }

        // =========================
        // 🎯 VALIDATION COMPLETE: create/save records
        // =========================

        const userCondition = { _id: new Types.ObjectId(doctorUserId) };
        // finalConsultationType will be 'video' only if the frontend explicitly sets Consultation_type='video'
        const finalConsultationType = isNewEstablishmentVideo ? 'video' : Consultation_type || 'own';

        // ======= CASE: isOwner === 1 (doctor creates/owns a hospital) =======
        if (Number(isOwner) === 1) {

            console.log("Processing owner case 1");
            const userTableData = {
                userType: [constants.USER_TYPES.DOCTOR, constants.USER_TYPES.HOSPITAL],
            };
            const addUserType = await common.updateByCondition(User, userCondition, userTableData);
            if (!addUserType) {
                response.error({ msgCode: "FAILED_TO_ADD" }, res, httpStatus.FORBIDDEN);
                return;
            }

            const dataHospital: any = {
                userId: new Types.ObjectId(doctorUserId),
                profilePic, address, location, isLocationShared,
                totalDoctor: 1, steps: 4, establishmentProof,isVerified:Consultation_type==="video"?2:1,
            };
            if (hospitalTypeId) {
                dataHospital.hospitalType = hospitalTypeId;
            }

            if ((findDoctor as any).steps != 4) {
                 await Doctor.findByIdAndUpdate(findDoctorId, { steps: 4 }, { new: true });
                 // ... (notification logic)
            }
            
            const hospitalData = await common.create(Hospital, dataHospital);
            
            const estabMasterData: any = {
                hospitalId: (hospitalData as any)._id, 
                // 🎯 FIX: Use finalConsultationType to decide if name must be overridden
                name: finalConsultationType === 'video' ? "Video Consultation Only" : name,
                address, 
                location, 
                isLocationShared,
                establishmentMobile, 
                establishmentEmail, 
                profileSlug:
                finalConsultationType === 'video'
                  ? `${(findDoctor as any).profileSlug}-video-only`
                  : `${(findDoctor as any).profileSlug}-${name.toLowerCase().replace(/\s+/g, '-')}-${address.city.toLowerCase().replace(/\s+/g, '-')}-${address.locality.toLowerCase().replace(/\s+/g, '-')}`,
                establishmentProof,
            };
            if (hospitalTypeId) {
                estabMasterData.hospitalTypeId = hospitalTypeId;
            }
            // console.log("estabMasterData:", estabMasterData);
            const establishmentMasterData = await common.create(EstablishmentMaster, estabMasterData);

            const estabTimingData: any = {
                establishmentId: (establishmentMasterData as any)._id,
                doctorId: findDoctorId, isOwner, consultationFees, videoConsultationFees,
                mon, tue, wed, thu, fri, sat, sun,
                isVerified: 2, createdBy: doctorUserId, establishmentProof,
                showVideo: isNewEstablishmentVideo, 
                Consultation_type: finalConsultationType,
            };

            const establishmentTimingData = await common.create(EstablishmentTiming, estabTimingData);

            response.success({
                msgCode: "DATA_CREATED",
                data: {
                    ...getDocData(addUserType), ...getDocData(hospitalData),
                    ...getDocData(establishmentMasterData), ...getDocData(establishmentTimingData),
                },
            }, res, httpStatus.CREATED);
            return;
        }

        // ======= CASE: hospitalId provided and isOwner === 0 (visiting case) =======
        else if (hospitalId && Number(isOwner) === 0) {
           console.log("Processing owner case 2");
            if ((findDoctor as any).steps != 4) {
                 await Doctor.findByIdAndUpdate(findDoctorId, { steps: 4 }, { new: true });
                 // ... (notification logic)
            }

            if (!findEstablishment) {
                response.error({ msgCode: "ESTABLISHMENT_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
                return;
            }

            const checkCondition = {
                doctorId: findDoctorId,
                establishmentId: (findEstablishment as any)._id,
                isDeleted: false,
            };
            const checkHospital = await common.getByCondition(EstablishmentTiming, checkCondition);
            if (checkHospital) {
                response.error({ msgCode: "HOSPITAL_EXISTS" }, res, httpStatus.CONFLICT);
                return;
            }

            const visitData: any = {
                doctorId: findDoctorId,
                establishmentId: (findEstablishment as any)._id,
                isOwner, consultationFees, videoConsultationFees,
                mon, tue, wed, thu, fri, sat, sun,
                isVerified:req.body.Consultation_type==="visit"?1: 2, createdBy: doctorUserId, establishmentProof,
                showVideo: isNewEstablishmentVideo, 
                Consultation_type: finalConsultationType,
            };
            const establishmentVisitData = await common.create(EstablishmentTiming, visitData);

            response.success({
                msgCode: "DATA_CREATED",
                data: { establishmentVisitData },
            }, res, httpStatus.CREATED);
            return;
        }

        // ======= CASE: !hospitalId and isOwner === 0 (create new master and timing for visiting) =======
        else if (!hospitalId && Number(isOwner) === 0) {
              console.log("Processing owner case 3");
            if ((findDoctor as any).steps != 4) {
                await Doctor.findByIdAndUpdate(findDoctorId, { steps: 4 }, { new: true });
                // ... (notification logic)
            }

            const dataHospital = {
                userId: new Types.ObjectId(doctorUserId), profilePic, address, location, isLocationShared,
            };
            const hospitalData = await common.create(Hospital, dataHospital);

            const cleanName = slugify(name);
            const cleanCity = slugify(address.city);
            const cleanLocality = slugify(address.locality);

            const estabMasterData: any = {
                hospitalId: (hospitalData as any)._id, 
                // 🎯 FIX: Use finalConsultationType to decide if name must be overridden
                name: finalConsultationType === 'video' ? "Video Consultation Only" : name,
                hospitalTypeId, address, location, isLocationShared,
                // isVerified:Consultation_type==="video"?2:1,
                isVerified: isCustomEstablishment== true
                ? 1
                : Consultation_type === 'video'
                  ? 2
                  : 1,

                establishmentMobile, establishmentEmail,
                profileSlug: `${cleanName}-${cleanCity}-${cleanLocality}`
                , establishmentProof
                            };
            // console.log("estabMasterData:", estabMasterData);
            const establishmentMasterData = await common.create(EstablishmentMaster, estabMasterData);

            const estabTimingData: any = {
                establishmentId: (establishmentMasterData as any)._id,
                doctorId: findDoctorId, isOwner, consultationFees, videoConsultationFees,
                mon, tue, wed, thu, fri, sat, sun,
                isVerified: isCustomEstablishment== true
                ? 1                :2 , createdBy: doctorUserId, establishmentProof,
                showVideo: isNewEstablishmentVideo, 
                Consultation_type: finalConsultationType,
            };
            // console.log("estabTimingData:", estabTimingData);
            const establishmentTimingData = await common.create(EstablishmentTiming, estabTimingData);

            response.success({
                msgCode: "DATA_CREATED",
                data: {
                    ...getDocData(hospitalData), ...getDocData(establishmentMasterData),
                    ...getDocData(establishmentTimingData),
                },
            }, res, httpStatus.CREATED);
            return;
        }

        // if nothing matched
        response.error({ msgCode: "BAD_REQUEST" }, res, httpStatus.BAD_REQUEST);
        return;
    } catch (error) {
        console.error("doctorAddEstablishment error:", error);
        response.error({ msgCode: "INTERNAL_SERVER_ERROR" }, res, httpStatus.INTERNAL_SERVER_ERROR);
        return;
    }
};
// working code 
// const getDocData = (doc: any): any => (doc && doc._doc) ? doc._doc : doc;

// export const doctorAddEstablishment = async (req: Request, res: Response): Promise<void> => {
//     try {
//         let { userId, isAdmin } = (req as any).data || {};
//         if (isAdmin && req.query.userId && typeof req.query.userId === "string") {
//             userId = req.query.userId;
//         }

//         if (!userId) {
//             response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
//             return;
//         }
        
//         const doctorUserId = String(userId);

//         // Destructuring body payload (using standard types)
//         const {
//             hospitalId, isOwner, profilePic, name, hospitalTypeId, consultationFees, videoConsultationFees,
//             address, location, isLocationShared, establishmentMobile, establishmentEmail,
//             mon, tue, wed, thu, fri, sat, sun,
//             showVideo, // 💡 Flag indicating video consultation
//             Consultation_type, // 💡 Used by frontend to determine type in absence of showVideo/showInClinic
//             ownEstablishmentExist, establishmentProof
//         } = req.body;
//         console.log("Request body:", req.body);

//         // --- Find Doctor and Establishment ---
//         const findDoctor = await common.getByCondition(Doctor, { userId: new Types.ObjectId(doctorUserId) });
//         if (!findDoctor) {
//             response.error({ msgCode: "DOCTOR_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
//             return;
//         }
//         const findDoctorId = (findDoctor as any)._id || (findDoctor as any).id;

//         let findEstablishment: any = null;
//         if (hospitalId) {
//              const estabMsterCondition: any = { hospitalId: new Types.ObjectId(String(hospitalId)) };
//              findEstablishment = await common.getByCondition(EstablishmentMaster, estabMsterCondition);
//         }
        
//         const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

//         // -------------------------
//         // 🎯 FIX: Helper Functions defined here for proper scoping
//         // -------------------------
//         const timeToMinutes = (time: string): number => {
//             if (!time || typeof time !== 'string') return -1;
//             const s = time.trim();
//             const ampmMatch = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
//             if (ampmMatch) {
//                 let hh = parseInt(ampmMatch[1], 10);
//                 const mm = parseInt(ampmMatch[2], 10);
//                 const ampm = ampmMatch[3].toUpperCase();
//                 if (ampm === 'AM' && hh === 12) hh = 0;
//                 if (ampm === 'PM' && hh !== 12) hh += 12;
//                 if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return -1;
//                 return hh * 60 + mm;
//             }
//             const twentyFour = s.match(/^(\d{1,2}):(\d{2})$/);
//             if (twentyFour) {
//                 const hh = parseInt(twentyFour[1], 10);
//                 const mm = parseInt(twentyFour[2], 10);
//                 if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return -1;
//                 return hh * 60 + mm;
//             }
//             return -1;
//         };

//         const intervalsOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean => {
//             // Check for overlap (where touching endpoints are NOT considered overlap)
//             return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
//         };
//         // -------------------------

//         // -------------------------
//         // 1. Fetch ALL existing active EstablishmentTiming entries for the doctor
//         // -------------------------
//         const existingTimings: any[] = await common.getManyByCondition(EstablishmentTiming, {
//             doctorId: findDoctorId,
//             isDeleted: false,
//         });

//         // -------------------------
//         // 2. Video uniqueness validation check
//         // -------------------------
//         const isNewEstablishmentVideo = showVideo === true || Consultation_type === 'video';
        
//         if (isNewEstablishmentVideo) {
//             const existingVideoConsultations = existingTimings.filter((t: any) => 
//                 t.showVideo === true || t.Consultation_type === 'video'
//             );
            
//             if (existingVideoConsultations.length > 0) {
//                 response.error(
//                     { msgCode: "VIDEO_LIMIT_EXCEEDED", message: "Only one Video Consultation establishment is allowed per doctor." },
//                     res,
//                     httpStatus.CONFLICT
//                 );
//                 return;
//             }
//         }

//         // -------------------------
//         // 3. Build a fast lookup of existing slots by day (Only for in-clinic overlap check)
//         // -------------------------
//         type Slot = { start: number; end: number; sourceId?: string; isVideo?: boolean };
//         const existingSlotsByDay: Record<string, Slot[]> = {};
//         dayKeys.forEach(d => existingSlotsByDay[d] = []);

//         const addExistingSlotsFromTiming = (timing: any) => {
//             if (!timing) return;
            
//             // Only consider in-clinic establishments for overlap check
//             if (timing.showVideo === true || timing.Consultation_type === 'video') return; 

//             for (const d of dayKeys) {
//                 const arr = Array.isArray(timing[d]) ? timing[d] : [];
//                 for (const slot of arr) {
//                     const start = timeToMinutes(String(slot.from || slot.fromTime || slot.from_time || ''));
//                     const end = timeToMinutes(String(slot.to || slot.toTime || slot.to_time || ''));
//                     if (start === -1 || end === -1) continue;
//                     if (end <= start) continue;
//                     existingSlotsByDay[d].push({ start, end, sourceId: String(timing._id || timing.establishmentId || ''), isVideo: !!timing.showVideo });
//                 }
//             }
//         };

//         for (const timing of existingTimings) {
//             addExistingSlotsFromTiming(timing);
//         }

//         // -------------------------
//         // 4. Build newSlotsByDay from incoming request & Internal validation
//         // -------------------------
//         const newInput: Record<string, any[]> = { mon, tue, wed, thu, fri, sat, sun };
//         const newSlotsByDay: Record<string, Slot[]> = {};
//         dayKeys.forEach(d => newSlotsByDay[d] = []);

//         const processIncomingDaySlotsImplementation = (inputSlots: any[] | undefined, dayOrAll: string) => {
//             if (!Array.isArray(inputSlots) || inputSlots.length === 0) return;
//             const applyDays = dayOrAll === 'all' ? dayKeys : [dayOrAll];
//             for (const s of inputSlots) {
//                 const start = timeToMinutes(String(s.from || s.fromTime || s.from_time || ''));
//                 const end = timeToMinutes(String(s.to || s.toTime || s.to_time || ''));
//                 if (start === -1 || end === -1 || end <= start) {
//                     throw new Error(`Invalid time slot provided for ${dayOrAll}: ${s.from} - ${s.to}`);
//                 }
//                 for (const d of applyDays) {
//                     newSlotsByDay[d].push({ start, end, sourceId: 'new', isVideo: isNewEstablishmentVideo });
//                 }
//             }
//         };
        
//         try {
//             for (const key of Object.keys(newInput)) {
//                 processIncomingDaySlotsImplementation(newInput[key], key);
//             }
//             if (Array.isArray((req.body as any).all) && (req.body as any).all.length) {
//                 processIncomingDaySlotsImplementation((req.body as any).all, 'all');
//             }
//         } catch (err: any) {
//             response.error({ msgCode: "INVALID_TIME_SLOT", message: err.message || 'Invalid time slot' }, res, httpStatus.BAD_REQUEST);
//             return;
//         }
        
//         // Validate internal overlaps within NEW slots (per day)
//         for (const d of dayKeys) {
//             const arr = newSlotsByDay[d];
//             arr.sort((a, b) => a.start - b.start);
//             for (let i = 0; i < arr.length; i++) {
//                 const s1 = arr[i];
//                 if (s1.start >= s1.end) {
//                     response.error({ msgCode: "INVALID_TIME_SLOT", message: `On ${d.toUpperCase()}, a slot has from >= to.` }, res, httpStatus.BAD_REQUEST);
//                     return;
//                 }
//                 for (let j = i + 1; j < arr.length; j++) {
//                     const s2 = arr[j];
//                     if (intervalsOverlap(s1.start, s1.end, s2.start, s2.end)) { // 🎯 intervalsOverlap is now defined
//                         response.error({ msgCode: "INTERNAL_SLOT_CONFLICT", message: `Selected time slots on ${d.toUpperCase()} overlap with each other.` }, res, httpStatus.CONFLICT);
//                         return;
//                     }
//                 }
//             }
//         }

//         // -------------------------
//         // 5. Validate NEW IN-CLINIC slots do not overlap with existing IN-CLINIC slots
//         // -------------------------
//         if (!isNewEstablishmentVideo) { // Only perform external overlap check for in-clinic/combined
//             for (const d of dayKeys) {
//                 const existing = existingSlotsByDay[d] || [];
//                 const incoming = newSlotsByDay[d] || [];
//                 if (!incoming.length) continue;

//                 for (const newSlot of incoming) {
//                     for (const exSlot of existing) {
//                         if (intervalsOverlap(newSlot.start, newSlot.end, exSlot.start, exSlot.end)) { // 🎯 intervalsOverlap is now defined
//                             const toHHMM = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
//                             const message = `Submitted timings conflict with an existing **in-clinic** schedule on ${d.toUpperCase()} (${toHHMM(exSlot.start)}-${toHHMM(exSlot.end)}). Please choose non-overlapping times.`;
//                             response.error({ msgCode: "TIMING_CONFLICT", message }, res, httpStatus.CONFLICT);
//                             return;
//                         }
//                     }
//                 }
//             }
//         }

//         // =========================
//         // 🎯 VALIDATION COMPLETE: create/save records
//         // =========================

//         const userCondition = { _id: new Types.ObjectId(doctorUserId) };
//         const finalConsultationType = isNewEstablishmentVideo ? 'video' : Consultation_type || 'own';

//         // ======= CASE: isOwner === 1 (doctor creates/owns a hospital) =======
//         if (Number(isOwner) === 1) {
            
//             const userTableData = {
//                 userType: [constants.USER_TYPES.DOCTOR, constants.USER_TYPES.HOSPITAL],
//             };
//             const addUserType = await common.updateByCondition(User, userCondition, userTableData);
//             if (!addUserType) {
//                 response.error({ msgCode: "FAILED_TO_ADD" }, res, httpStatus.FORBIDDEN);
//                 return;
//             }

//             const dataHospital: any = {
//                 userId: new Types.ObjectId(doctorUserId),
//                 profilePic, address, location, isLocationShared,
//                 totalDoctor: 1, steps: 4, establishmentProof
//             };
//             if (hospitalTypeId) {
//                 dataHospital.hospitalType = hospitalTypeId;
//             }

//             if ((findDoctor as any).steps != 4) {
//                  await Doctor.findByIdAndUpdate(findDoctorId, { steps: 4 }, { new: true });
//                  // ... (notification logic)
//             }
            
//             const hospitalData = await common.create(Hospital, dataHospital);
            
//             const estabMasterData: any = {
//                 hospitalId: (hospitalData as any)._id, 
//                 name: isNewEstablishmentVideo ? "Video Consultation Only" : name,
//                 address, 
//                 location, 
//                 isLocationShared,
//                 establishmentMobile, 
//                 establishmentEmail, 
//                 establishmentProof,
//             };
//             if (hospitalTypeId) {
//                 estabMasterData.hospitalTypeId = hospitalTypeId;
//             }
//             const establishmentMasterData = await common.create(EstablishmentMaster, estabMasterData);

//             const estabTimingData: any = {
//                 establishmentId: (establishmentMasterData as any)._id,
//                 doctorId: findDoctorId, isOwner, consultationFees, videoConsultationFees,
//                 mon, tue, wed, thu, fri, sat, sun,
//                 isVerified: 2, createdBy: doctorUserId, establishmentProof,
//                 showVideo: isNewEstablishmentVideo, 
//                 Consultation_type: finalConsultationType,
//             };

//             const establishmentTimingData = await common.create(EstablishmentTiming, estabTimingData);

//             response.success({
//                 msgCode: "DATA_CREATED",
//                 data: {
//                     ...getDocData(addUserType), ...getDocData(hospitalData),
//                     ...getDocData(establishmentMasterData), ...getDocData(establishmentTimingData),
//                 },
//             }, res, httpStatus.CREATED);
//             return;
//         }

//         // ======= CASE: hospitalId provided and isOwner === 0 (visiting case) =======
//         else if (hospitalId && Number(isOwner) === 0) {
            
//             if ((findDoctor as any).steps != 4) {
//                  await Doctor.findByIdAndUpdate(findDoctorId, { steps: 4 }, { new: true });
//                  // ... (notification logic)
//             }

//             if (!findEstablishment) {
//                 response.error({ msgCode: "ESTABLISHMENT_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
//                 return;
//             }

//             const checkCondition = {
//                 doctorId: findDoctorId,
//                 establishmentId: (findEstablishment as any)._id,
//                 isDeleted: false,
//             };
//             const checkHospital = await common.getByCondition(EstablishmentTiming, checkCondition);
//             if (checkHospital) {
//                 response.error({ msgCode: "HOSPITAL_EXISTS" }, res, httpStatus.CONFLICT);
//                 return;
//             }

//             const visitData: any = {
//                 doctorId: findDoctorId,
//                 establishmentId: (findEstablishment as any)._id,
//                 isOwner, consultationFees, videoConsultationFees,
//                 mon, tue, wed, thu, fri, sat, sun,
//                 isVerified: 2, createdBy: doctorUserId, establishmentProof,
//                 showVideo: isNewEstablishmentVideo, 
//                 Consultation_type: finalConsultationType,
//             };
//             const establishmentVisitData = await common.create(EstablishmentTiming, visitData);

//             response.success({
//                 msgCode: "DATA_CREATED",
//                 data: { establishmentVisitData },
//             }, res, httpStatus.CREATED);
//             return;
//         }

//         // ======= CASE: !hospitalId and isOwner === 0 (create new master and timing for visiting) =======
//         else if (!hospitalId && Number(isOwner) === 0) {
            
//             if ((findDoctor as any).steps != 4) {
//                 await Doctor.findByIdAndUpdate(findDoctorId, { steps: 4 }, { new: true });
//                 // ... (notification logic)
//             }

//             const dataHospital = {
//                 userId: new Types.ObjectId(doctorUserId), profilePic, address, location, isLocationShared,
//             };
//             const hospitalData = await common.create(Hospital, dataHospital);

//             const estabMasterData: any = {
//                 hospitalId: (hospitalData as any)._id, 
//                 name: isNewEstablishmentVideo ? "Video Consultation Only" : name,
//                 hospitalTypeId, address, location, isLocationShared,
//                 establishmentMobile, establishmentEmail, profileSlug: (findDoctor as any).profileSlug, establishmentProof
//             };
//             const establishmentMasterData = await common.create(EstablishmentMaster, estabMasterData);

//             const estabTimingData: any = {
//                 establishmentId: (establishmentMasterData as any)._id,
//                 doctorId: findDoctorId, isOwner, consultationFees, videoConsultationFees,
//                 mon, tue, wed, thu, fri, sat, sun,
//                 isVerified: 2, createdBy: doctorUserId, establishmentProof,
//                 showVideo: isNewEstablishmentVideo, 
//                 Consultation_type: finalConsultationType,
//             };
//             const establishmentTimingData = await common.create(EstablishmentTiming, estabTimingData);

//             response.success({
//                 msgCode: "DATA_CREATED",
//                 data: {
//                     ...getDocData(hospitalData), ...getDocData(establishmentMasterData),
//                     ...getDocData(establishmentTimingData),
//                 },
//             }, res, httpStatus.CREATED);
//             return;
//         }

//         // if nothing matched
//         response.error({ msgCode: "BAD_REQUEST" }, res, httpStatus.BAD_REQUEST);
//         return;
//     } catch (error) {
//         console.error("doctorAddEstablishment error:", error);
//         response.error({ msgCode: "INTERNAL_SERVER_ERROR" }, res, httpStatus.INTERNAL_SERVER_ERROR);
//         return;
//     }
// };

// working code 


// Controller: Get Doctor Calendar
export const getCalender = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    let { userId, isAdmin } = req.data || {};

    // If admin, allow fetching userId from query
    if (isAdmin) {
      userId = req.query.userId as string;
    }

    // console.log("i called getCalender1");

    if (!userId) {
      response.error(
        { msgCode: "USER_ID_REQUIRED" },
        res,
        httpStatus.BAD_REQUEST
      );
      return; // ✅ Exit after sending response
    }

    // console.log("i called getCalender2");

    const condition = { userId: new Types.ObjectId(userId) };
    const condition1: Record<string, any> = {};

    const { startDate, endDate, today } = req.body as {
      startDate?: string;
      endDate?: string;
      today?: string;
    };

    const findDoctor = await common.getByCondition(Doctor, condition) as { _id: string };

    if (!findDoctor) {
      response.success(
        { msgCode: "DATA_NOT_FOUND" },
        res,
        httpStatus.NOT_FOUND
      );
      return; // ✅ Exit here too
    }

    const matchCondition = {
      doctorId: new Types.ObjectId(findDoctor._id),
      status: { $ne: constants.BOOKING_STATUS.RESCHEDULE },
    };

    // Handle today filter
    if (today) {
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      condition1.date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    // Handle date range filter
    if (startDate && endDate) {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      condition1.date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    const findData = await doctorService.calenderList(
      matchCondition,
      condition1
    );

    response.success(
      { msgCode: "FETCHED", data: findData },
      res,
      httpStatus.OK
    );
  } catch (error) {
    console.error("Error in getCalender:", error);
    response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

export const getDoctorProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    let { userId, isAdmin } = (req as any).data;
    if (isAdmin) userId = req.query.userId;

    const condition = {
      _id: new ObjectId(userId),
      userType: constants.USER_TYPES.DOCTOR,
    };

    const userDetails = await doctorService.getProfile(condition);
    if (!userDetails) {
      response.error(
        { msgCode: "ACCOUNT_NOT_FOUND" },
        res,
        httpStatus.NOT_FOUND
      );
      return; // ✅ stop execution but do NOT return Response
    }

    response.success(
      {    "success": true,"status_code": 200,"message": "Account data found successfully.", result: userDetails },
      res,
      httpStatus.OK
    );
  } catch (error) {
    response.error(
      { msgCode: "SOMETHING_WENT_WRONG" },
      res,
      httpStatus.NOT_FOUND
    );
  }
};

export const doctorEstablishmentList = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    let { userId, isAdmin } = req.data || {};

    // If admin, allow userId override via query
    if (isAdmin && req.query.userId) {
      userId = req.query.userId as string;
    }

    if (!userId) {
      response.error(
        { msgCode: "USER_ID_REQUIRED" },
        res,
        httpStatus.BAD_REQUEST
      );
      return;
    }

    const condition1 = { userId: new Types.ObjectId(userId) };

    const findDoctor = await common.getByCondition(Doctor, condition1) as { _id: string } | null;

    if (!findDoctor) {
      response.success(
        { msgCode: "DATA_NOT_FOUND" },
        res,
        httpStatus.NOT_FOUND
      );
      return;
    }

    // Pagination
    const { page = 1, size = 10 } = req.query as { page?: string; size?: string };
    const { limit, offset } = getPagination(Number(page), Number(size));

    const condition = {
      doctorId: new Types.ObjectId(findDoctor._id),
      // isVerified: constants.PROFILE_STATUS.APPROVE,
    };

    const findEstablishment = await doctorService.establishmentListforPortal(condition, limit, offset);

    response.success(
      { "message": "Data successfully found","status_code": 200, result: findEstablishment },
      res,
      httpStatus.OK
    );

  } catch (error) {
    console.error("Error in doctorEstablishmentList:", error);
    response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId =
      (req as any).data?.userId ||
      (req as any).user?.id ||
      (typeof req.headers["x-user-id"] === "string" && req.headers["x-user-id"]) ||
      req.query.userId;

    if (!userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    const dashboardData = await doctorService.getDashboardSummary(String(userId));

    if (!dashboardData) {
      response.error({ msgCode: "DATA_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    response.success(
      { msgCode: "DASHBOARD_SUMMARY_FETCHED", data: dashboardData },
      res,
      httpStatus.OK
    );
  } catch (err) {
    console.error("getDashboardSummary error:", err);
    response.error({ msgCode: "SOMETHING_WENT_WRONG" }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

const getDashboardProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId =
      (req as any).data?.userId ||
      (req as any).user?.id ||
      (typeof req.headers["x-user-id"] === "string" && req.headers["x-user-id"]) ||
      req.query.userId;

    if (!userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    const profileData = await doctorService.getDashboardProfile(String(userId));

    if (!profileData) {
      response.error({ msgCode: "DATA_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    response.success(
      { msgCode: "PROFILE_FETCHED", data: profileData },
      res,
      httpStatus.OK
    );
  } catch (err) {
    console.error("getDashboardProfile error:", err);
    response.error({ msgCode: "SOMETHING_WENT_WRONG" }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

const getAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId =
      (req as any).data?.userId ||
      (req as any).user?.id ||
      (typeof req.headers["x-user-id"] === "string" && req.headers["x-user-id"]) ||
      req.query.userId;

    if (!userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    const days = req.query.days ? Number(req.query.days) : 30;
    const analyticsData = await doctorService.getAnalytics(String(userId), days);

    if (!analyticsData) {
      response.error({ msgCode: "DATA_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    response.success(
      { msgCode: "ANALYTICS_FETCHED", data: analyticsData },
      res,
      httpStatus.OK
    );
  } catch (err) {
    console.error("getAnalytics error:", err);
    response.error({ msgCode: "SOMETHING_WENT_WRONG" }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

const editEstablishment = async (req: Request, res: Response): Promise<void> => {
  try {
    let { userId, isAdmin } = (req as any).data || {};
    if (isAdmin && req.query.userId && typeof req.query.userId === "string") {
      userId = req.query.userId;
    }

    if (!userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    const doctorUserId = String(userId);
    const establishmentId = req.query.establishmentId as string;
    const hospitalId = req.query.hospitalId as string;

    if (!establishmentId) {
      response.error({ msgCode: "BAD_REQUEST", message: "establishmentId is required" }, res, httpStatus.BAD_REQUEST);
      return;
    }

    const {
      consultationFees,
      videoConsultationFees,
      mon, tue, wed, thu, fri, sat, sun,
      isOwnershipTransferred,
      isActive
    } = req.body;

    const findDoctor = await common.getByCondition(Doctor, { userId: new Types.ObjectId(doctorUserId) });
    if (!findDoctor) {
      response.error({ msgCode: "DOCTOR_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }
    const findDoctorId = (findDoctor as any)._id || (findDoctor as any).id;

    const existingTiming = await common.getByCondition(EstablishmentTiming, {
      _id: new Types.ObjectId(establishmentId),
      doctorId: findDoctorId,
      isDeleted: false,
    });

    if (!existingTiming) {
      response.error({ msgCode: "ESTABLISHMENT_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    const isVideoConsultation = (existingTiming as any).showVideo === true || 
                                 (existingTiming as any).Consultation_type === 'video' ||
                                 (existingTiming as any).consultationMode === 'video-only';

    const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    const timeToMinutes = (time: string): number => {
      if (!time || typeof time !== 'string') return -1;
      const s = time.trim();
      const ampmMatch = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (ampmMatch) {
        let hh = parseInt(ampmMatch[1], 10);
        const mm = parseInt(ampmMatch[2], 10);
        const ampm = ampmMatch[3].toUpperCase();
        if (ampm === 'AM' && hh === 12) hh = 0;
        if (ampm === 'PM' && hh !== 12) hh += 12;
        if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return -1;
        return hh * 60 + mm;
      }
      const twentyFour = s.match(/^(\d{1,2}):(\d{2})$/);
      if (twentyFour) {
        const hh = parseInt(twentyFour[1], 10);
        const mm = parseInt(twentyFour[2], 10);
        if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return -1;
        return hh * 60 + mm;
      }
      return -1;
    };

    const intervalsOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean => {
      return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
    };

    const existingTimings: any[] = await common.getManyByCondition(EstablishmentTiming, {
      doctorId: findDoctorId,
      _id: { $ne: new Types.ObjectId(establishmentId) },
      isDeleted: false,
    });

    type Slot = { start: number; end: number; sourceId?: string };
    const existingSlotsByDay: Record<string, Slot[]> = {};
    dayKeys.forEach(d => existingSlotsByDay[d] = []);

    const addExistingSlotsFromTiming = (timing: any) => {
      if (!timing) return;
      for (const d of dayKeys) {
        const arr = Array.isArray(timing[d]) ? timing[d] : [];
        for (const slot of arr) {
          const start = timeToMinutes(String(slot.from || slot.fromTime || slot.from_time || ''));
          const end = timeToMinutes(String(slot.to || slot.toTime || slot.to_time || ''));
          if (start === -1 || end === -1) continue;
          if (end <= start) continue;
          existingSlotsByDay[d].push({ start, end, sourceId: String(timing._id || timing.establishmentId || '') });
        }
      }
    };

    for (const timing of existingTimings) {
      addExistingSlotsFromTiming(timing);
    }

    const newInput: Record<string, any[]> = { mon, tue, wed, thu, fri, sat, sun };
    const newSlotsByDay: Record<string, Slot[]> = {};
    dayKeys.forEach(d => newSlotsByDay[d] = []);

    const processIncomingDaySlots = (inputSlots: any[] | undefined, dayOrAll: string) => {
      if (!Array.isArray(inputSlots) || inputSlots.length === 0) return;
      const applyDays = dayOrAll === 'all' ? dayKeys : [dayOrAll];
      for (const s of inputSlots) {
        const start = timeToMinutes(String(s.from || s.fromTime || s.from_time || ''));
        const end = timeToMinutes(String(s.to || s.toTime || s.to_time || ''));
        if (start === -1 || end === -1 || end <= start) {
          throw new Error(`Invalid time slot provided for ${dayOrAll}: ${s.from} - ${s.to}`);
        }
        for (const d of applyDays) {
          newSlotsByDay[d].push({ start, end, sourceId: 'new' });
        }
      }
    };

    try {
      for (const key of Object.keys(newInput)) {
        processIncomingDaySlots(newInput[key], key);
      }
      if (Array.isArray((req.body as any).all) && (req.body as any).all.length) {
        processIncomingDaySlots((req.body as any).all, 'all');
      }
    } catch (err: any) {
      response.error({ msgCode: "INVALID_TIME_SLOT", message: err.message || 'Invalid time slot' }, res, httpStatus.BAD_REQUEST);
      return;
    }

    for (const d of dayKeys) {
      const arr = newSlotsByDay[d];
      arr.sort((a, b) => a.start - b.start);
      for (let i = 0; i < arr.length; i++) {
        const s1 = arr[i];
        if (s1.start >= s1.end) {
          response.error({ msgCode: "INVALID_TIME_SLOT", message: `On ${d.toUpperCase()}, a slot has from >= to.` }, res, httpStatus.BAD_REQUEST);
          return;
        }
        for (let j = i + 1; j < arr.length; j++) {
          const s2 = arr[j];
          if (intervalsOverlap(s1.start, s1.end, s2.start, s2.end)) {
            response.error({ msgCode: "INTERNAL_SLOT_CONFLICT", message: `Selected time slots on ${d.toUpperCase()} overlap with each other.` }, res, httpStatus.CONFLICT);
            return;
          }
        }
      }
    }

    for (const d of dayKeys) {
      const existing = existingSlotsByDay[d] || [];
      const incoming = newSlotsByDay[d] || [];
      if (!incoming.length) continue;

      for (const newSlot of incoming) {
        for (const exSlot of existing) {
          if (intervalsOverlap(newSlot.start, newSlot.end, exSlot.start, exSlot.end)) {
            const toHHMM = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
            const message = `Submitted timings conflict with an existing schedule on ${d.toUpperCase()} (${toHHMM(exSlot.start)}-${toHHMM(exSlot.end)}). Please choose non-overlapping times.`;
            response.error({ msgCode: "TIMING_CONFLICT", message }, res, httpStatus.CONFLICT);
            return;
          }
        }
      }
    }

    const updateData: any = {};

    if (consultationFees !== undefined) {
      updateData.consultationFees = consultationFees;
    }
    if (videoConsultationFees !== undefined) {
      updateData.videoConsultationFees = videoConsultationFees;
    }

    dayKeys.forEach(day => {
      if (newInput[day] !== undefined) {
        updateData[day] = newInput[day];
      }
    });

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (isVideoConsultation) {
      updateData.isVerified = 2;
    } else {
      updateData.isVerified = 1;
    }

    updateData.updatedAt = new Date();

    const updatedTiming = await EstablishmentTiming.findByIdAndUpdate(
      establishmentId,
      { $set: updateData },
      { new: true }
    );

    if (!updatedTiming) {
      response.error({ msgCode: "UPDATE_FAILED" }, res, httpStatus.INTERNAL_SERVER_ERROR);
      return;
    }

    if (hospitalId && !isVideoConsultation) {
      await EstablishmentMaster.findOneAndUpdate(
        { hospitalId: new Types.ObjectId(hospitalId) },
        { $set: { isVerified: 1, updatedAt: new Date() } },
        { new: true }
      );
    }

    response.success({
      msgCode: "ESTABLISHMENT_UPDATED",
      success: true,
      data: updatedTiming,
      message: isVideoConsultation 
        ? "Video consultation establishment updated successfully." 
        : "Establishment updated successfully. It will be reviewed for approval."
    }, res, httpStatus.OK);
    return;

  } catch (error) {
    console.error("editEstablishment error:", error);
    response.error({ msgCode: "INTERNAL_SERVER_ERROR" }, res, httpStatus.INTERNAL_SERVER_ERROR);
    return;
  }
};

/**
 * Controller: rescheduleAppointment
 * PUT /doctor/reschedule-appointment/:appointmentId
 */
const rescheduleAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = (req as any).data || {};
    if (!userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    const { appointmentId } = req.params;
    if (!appointmentId) {
      response.error({ msgCode: "MISSING_PARAMS", message: "appointmentId is required" }, res, httpStatus.BAD_REQUEST);
      return;
    }

    const { date, notes } = req.body;
    if (!date) {
      response.error({ msgCode: "MISSING_PARAMS", message: "date is required" }, res, httpStatus.BAD_REQUEST);
      return;
    }

    const existingAppointment = await Appointment.findById(appointmentId);
    if (!existingAppointment) {
      response.error({ msgCode: "DATA_NOT_FOUND", message: "Appointment not found" }, res, httpStatus.NOT_FOUND);
      return;
    }

    // Update date/time/notes and explicitly keep status as BOOKED
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        date: new Date(date),
        startTime: new Date(date),
        status: constants.BOOKING_STATUS.BOOKED,
        ...(notes ? { notes } : {}),
        modifiedBy: new Types.ObjectId(userId),
      },
      { new: true }
    );

    response.success(
      { msgCode: "SUCCESS", message: "Appointment rescheduled successfully", data: updatedAppointment },
      res,
      httpStatus.OK
    );
  } catch (error) {
    console.error("rescheduleAppointment error:", error);
    response.error({ msgCode: "INTERNAL_SERVER_ERROR" }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Soft-delete an OWN establishment (and its timing) for the logged-in doctor.
 * POST /doctor/doctor-delete-establishment2
 * body: { establishmentId }
 */
const deleteOwnEstablishment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = (req as any).data || {};
    if (!userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
      return;
    }
    const { establishmentId } = req.body || {};
    if (!establishmentId) {
      response.error({ msgCode: "MISSING_PARAMS", message: "establishmentId is required" }, res, httpStatus.BAD_REQUEST);
      return;
    }

    const estId = new Types.ObjectId(String(establishmentId));
    const doctor = await Doctor.findOne({ userId: new Types.ObjectId(String(userId)) }).lean();
    const doctorId = (doctor as any)?._id;

    await EstablishmentMaster.updateOne({ _id: estId }, { $set: { isDeleted: true, isActive: false } });
    await EstablishmentTiming.updateMany(
      { establishmentId: estId, ...(doctorId ? { doctorId } : {}) },
      { $set: { isDeleted: true, isActive: false } }
    );

    response.success({ msgCode: "SUCCESS", message: "Establishment deleted" }, res, httpStatus.OK);
  } catch (error) {
    console.error("deleteOwnEstablishment error:", error);
    response.error({ msgCode: "INTERNAL_SERVER_ERROR" }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Soft-delete a VISITING establishment (timing only) for the doctor.
 * POST /doctor/doctor-delete-establishment3
 * body: { establishmentId, doctorId? }
 */
const deleteVisitingEstablishment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = (req as any).data || {};
    if (!userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, httpStatus.UNAUTHORIZED);
      return;
    }
    const { establishmentId, doctorId } = req.body || {};
    if (!establishmentId) {
      response.error({ msgCode: "MISSING_PARAMS", message: "establishmentId is required" }, res, httpStatus.BAD_REQUEST);
      return;
    }

    let resolvedDoctorId: Types.ObjectId | null = null;
    if (doctorId) {
      try { resolvedDoctorId = new Types.ObjectId(String(doctorId)); } catch { /* ignore */ }
    }
    if (!resolvedDoctorId) {
      const doctor = await Doctor.findOne({ userId: new Types.ObjectId(String(userId)) }).lean();
      if ((doctor as any)?._id) resolvedDoctorId = (doctor as any)._id;
    }

    const filter: any = { establishmentId: new Types.ObjectId(String(establishmentId)) };
    if (resolvedDoctorId) filter.doctorId = resolvedDoctorId;

    await EstablishmentTiming.updateMany(filter, { $set: { isDeleted: true, isActive: false } });

    response.success({ msgCode: "SUCCESS", message: "Visiting establishment removed" }, res, httpStatus.OK);
  } catch (error) {
    console.error("deleteVisitingEstablishment error:", error);
    response.error({ msgCode: "INTERNAL_SERVER_ERROR" }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

export default {
  getDoctorPatientList,doctorAppointmentList,allVideo,doctorUpdateProfile,doctorAddEstablishment,getCalender,getDoctorProfile,doctorEstablishmentList,getDashboardSummary,getDashboardProfile,getAnalytics,editEstablishment,rescheduleAppointment,deleteOwnEstablishment,deleteVisitingEstablishment
};
