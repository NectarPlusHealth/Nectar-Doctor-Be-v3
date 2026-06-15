// src/services/doctorService.ts
import mongoose, { PipelineStage } from "mongoose";
import slugify from "slugify";
import Appointment from "../models/Appointment";
import User from "../models/User";
import Doctor from "../models/Doctor";
import Hospital from "../models/Hospital";
import EstablishmentTiming from "../models/EstablishmentTiming";
import EstablishmentMaster from "../models/EstablishmentMaster";
import NotificationModel from "../models/Notification";
import common from "../utils/common";
import constants from "../utils/constant"; // same import you already had

// Generic type for plain JS object
type AnyObj = Record<string, any>;

interface CalenderListParams {
  matchCondition: AnyObj;
  condition1: AnyObj;
  hospitalQuery: AnyObj;
}

/**
 * Returns grouped patient list in shape { count: number, data: any[] }.
 */
export async function getPatientList(
  condition: Record<string, any>,
  sortCondition: Record<string, any>,
  offset: number,
  limit: number,
  searchQuery: string
): Promise<{ count: number; data: any[] }> {
  try {
    if (!Appointment || typeof (Appointment as any).aggregate !== "function") {
      console.error("Appointment model not available or invalid");
      return { count: 0, data: [] };
    }

    const pipeline: any[] = [
      { $match: condition },
      {
        $lookup: {
          from: "patients",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: "users",
          localField: "patient.userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          $or: [
            { "user.fullName": { $regex: new RegExp(searchQuery || "", "i") } },
            { "user.phone": { $regex: new RegExp(searchQuery || "", "i") } },
          ],
        },
      },
      {
        $addFields: {
          firstLetter: {
            $substr: [{ $substrCP: [{ $toUpper: "$user.fullName" }, 0, 1] }, 0, 1],
          },
        },
      },
      {
        $project: {
          _id: { $ifNull: ["$patient._id", constants.NA] },
          patientName: { $ifNull: ["$user.fullName", constants.NA] },
          firstLetter: 1,
          profilePic: { $ifNull: ["$patient.profilePic", constants.NA] },
        },
      },
      {
        $group: {
          _id: "$firstLetter",
          documents: {
            $addToSet: {
              _id: "$_id",
              firstLetter: "$firstLetter",
              patientName: "$patientName",
              profilePic: "$profilePic",
            },
          },
        },
      },
      {
        $facet: {
          count: [{ $count: "total" }],
          data: [{ $sort: { _id: 1 } }, { $skip: offset }, { $limit: limit }],
        },
      },
      {
        $addFields: {
          count: {
            $cond: {
              if: { $eq: ["$count", []] },
              then: 0,
              else: {
                $cond: {
                  if: { $eq: ["$data", []] },
                  then: 0,
                  else: { $arrayElemAt: ["$count.total", 0] },
                },
              },
            },
          },
        },
      },
    ];

    const agg = await (Appointment as any).aggregate(pipeline).allowDiskUse(true);
    const result = agg && agg[0] ? agg[0] : { count: 0, data: [] };

    return {
      count: typeof result.count === "number" ? result.count : 0,
      data: Array.isArray(result.data) ? result.data : [],
    };
  } catch (err) {
    console.error("doctorService.getPatientList error:", err);
    return { count: 0, data: [] };
  }
}

/* -------------------------
   New functions added here
   ------------------------- */

/**
 * getDoctorProfile - aggregates user + doctor + hospital + establishment timing/master info
 * Returns array of aggregated documents or false on failure / empty.
 */
export const getDoctorProfile = async (condition: AnyObj) => {
  try {
    const data = await (User as any).aggregate([
      { $match: condition },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "userId",
          as: "doctor",
        },
      },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "hospitals",
          localField: "_id",
          foreignField: "userId",
          as: "hospital",
        },
      },
      { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "establishmenttimings",
          localField: "doctor._id",
          foreignField: "doctorId",
          as: "establishmentTiming",
        },
      },
      {
        $unwind: {
          path: "$establishmentTiming",
          preserveNullAndEmptyArrays: true,
        },
      },
      { $sort: { "establishmentTiming.createdAt": 1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: "establishmentmasters",
          localField: "establishmentTiming.establishmentId",
          foreignField: "_id",
          as: "establishmentMaster",
        },
      },
      {
        $unwind: {
          path: "$establishmentMaster",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "hospitals",
          localField: "establishmentMaster.hospitalId",
          foreignField: "_id",
          as: "hospitalData",
        },
      },
      {
        $unwind: {
          path: "$hospitalData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "statemasters",
          localField: "establishmentMaster.address.state",
          foreignField: "_id",
          as: "state",
        },
      },
      { $unwind: { path: "$state", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "hospitaltypes",
          localField: "establishmentMaster.hospitalTypeId",
          foreignField: "_id",
          as: "hospitalType",
        },
      },
      { $unwind: { path: "$hospitalType", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          sectionA: {
            basicDetails: {
              fullName: "$fullName",
              specialization: `$doctor.specialization`,
              gender: `$doctor.gender`,
              email: `$doctor.email`,
              city: `$doctor.city`,
            },
            medicalRegistration: `$doctor.medicalRegistration`,
            education: {
              education: `$doctor.education`,
              experience: `$doctor.experience`,
            },
            establishmentDetails: {
              name: `$establishmentMaster.name`,
              isOwner: `$doctor.isOwnEstablishment`,
              locality: `$establishmentMaster.address.locality`,
              city: `$establishmentMaster.address.city`,
              establishmentType: `$hospitalType.name`,
              hospitalTypeId: `$hospitalType._id`,
              hospitalId: `$establishmentMaster.hospitalId`,
            },
          },
          sectionB: {
            doctor: {
              identityProof: `$doctor.identityProof`,
              medicalProof: `$doctor.medicalProof`,
            },
            establishmentDetail: {
              establishmentProof: {
                $cond: {
                  if: { $eq: ["$doctor.isOwnEstablishment", true] },
                  then: `$establishmentMaster.establishmentProof`,
                  else: `$establishmentTiming.establishmentProof`,
                },
              },
              propertyStatus: `$establishmentMaster.propertyStatus`,
            },
          },
          sectionC: {
            establishmentTiming: `$establishmentTiming`,
            address: `$establishmentMaster.address`,
            location: `$establishmentMaster.location`,
            isLocationShared: "$establishmentMaster.isLocationShared",
            editAddress: {
              $cond: {
                if: {
                  $eq: [
                    "$hospitalData.isVerified",
                    constants.PROFILE_STATUS.APPROVE,
                  ],
                },
                then: false,
                else: {
                  $cond: {
                    if: {
                      $eq: ["$doctor.isOwnEstablishment", false],
                    },
                    then: false,
                    else: true,
                  },
                },
              },
            },
          },
          _id: 1,
          doctorId: `$doctor._id`,
          hospitalId: `$establishmentMaster.hospitalId`,
          establishmentMasterId: `$establishmentMaster._id`,
          establishmentMasterTimingId: `$establishmentTiming._id`,
          steps: `$doctor.steps`,
          approvalStatus: `$doctor.isVerified`,
          phoneNumber: `$phone`,
          profileScreen: `$doctor.profileScreen`,
          profileSlug: `$doctor.profileSlug`,
          isOwnEstablishment: `$doctor.isOwnEstablishment`,
          email: `$doctor.email`,
          fullName: 1,
        },
      },
    ]).exec();

    return data && data.length > 0 ? data : false;
  } catch (error) {
    console.error("getDoctorProfile:", error);
    return false;
  }
};

/**
 * generateDoctorSlug - helper to create a unique slug for the doctor's profile
 */
export const generateDoctorSlug = async (userId: string) => {
  try {
    const user = await (User as any).aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "userId",
          as: "doctor",
        },
      },
      {
        $unwind: {
          path: "$doctor",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "specializations",
          localField: "doctor.specialization",
          foreignField: "_id",
          as: "specializationMaster",
        },
      },
    ]).exec();

    const slugStr =
      (user[0]?.fullName || "") +
      " " +
      (user[0]?.specializationMaster?.[0]?.name || "");

    const baseSlug = slugify(slugStr, {
      lower: true,
      remove: undefined,
      strict: true,
    });

    let slug = baseSlug;
    let slugCount = 1;

    while (true) {
      const existingDoctor = await (Doctor as any).findOne({
        profileSlug: slug,
      }).lean().exec();

      if (!existingDoctor) return slug;

      slug = `${baseSlug}-${slugCount}`;
      slugCount++;
    }
  } catch (error) {
    console.error("generateDoctorSlug error:", error);
    return false;
  }
};

/**
 * updatesUser - prepare payload to update User model
 */
export const updatesUser = (basicDetails?: AnyObj) => {
  if (!basicDetails) return null;
  const { fullName } = basicDetails;
  if (fullName) return { fullName };
  return null;
};

/**
 * updatesDoctor - prepare payload to update Doctor model
 */
export const updatesDoctor = (
  basicDetails?: AnyObj,
  medicalRegistration?: AnyObj,
  education?: AnyObj
) => {
  const result: AnyObj = {};
  if (basicDetails) {
    const { gender, specialization, city, email } = basicDetails;
    if (typeof gender !== "undefined") result.gender = gender;
    if (specialization) {
      try {
        result.specialization = new mongoose.Types.ObjectId(specialization);
      } catch (err) {
        result.specialization = specialization;
      }
    }
    if (city) result.city = city;
    if (email) result.email = email;
  }
  if (medicalRegistration) result.medicalRegistration = [medicalRegistration];
  if (education) {
    const { experience } = education;
    result.education = [education];
    if (typeof experience !== "undefined") result.experience = experience;
  }
  return result;
};

/**
 * updatesEstablishmentMaster - heavy logic converted from your JS version.
 * returns: { establishmentId?, doctorId?, isOwner?, isVerified? } | false | null
 */
export const updatesEstablishmentMaster = async (
  establishmentDetails: AnyObj | undefined,
  parentDoctor: AnyObj,
  parentId: string
) => {
  try {
    const result: AnyObj = {};

    if (!establishmentDetails?.name) return false;

    const { name, isOwner, hospitalTypeId, hospitalId } = establishmentDetails;

    // If no hospitalId provided -> create new hospital path
    if (!hospitalId) {
      if (isOwner) {
        // mark user as doctor+hospital
        await common.updateByCondition(
          (User as any),
          { _id: new mongoose.Types.ObjectId(parentId) },
          {
            userType: [
              constants.USER_TYPES.DOCTOR,
              constants.USER_TYPES.HOSPITAL,
            ],
          }
        );

        // remove sessions if session model exists (we don't have session model here so pass null)
        await common.removeAllSessionByCondition(null, {
          userId: new mongoose.Types.ObjectId(parentId),
        });

        // mark doctor as owner
        await common.updateByCondition(
          (Doctor as any),
          { userId: new mongoose.Types.ObjectId(parentId) },
          { isOwnEstablishment: true },
          constants.USER_TYPES.DOCTOR
        );

        // create Hospital
        const establishmentHospital = await common.create(Hospital as any, {
          userId: new mongoose.Types.ObjectId(parentId),
          hospitalType: new mongoose.Types.ObjectId(hospitalTypeId),
          steps: constants.PROFILE_STEPS.SECTION_B,
          profileScreen: constants.HOSPITAL_SCREENS.ESTABLISHMENT_PROOF,
        });

        // create EstablishmentMaster
        const establishmentMaster = await common.create(EstablishmentMaster as any, {
          hospitalId: new mongoose.Types.ObjectId((establishmentHospital as any)?._id),
          name,
          hospitalTypeId: new mongoose.Types.ObjectId(hospitalTypeId),
        });

        // create EstablishmentTiming
        await common.create(EstablishmentTiming as any, {
          establishmentId: (establishmentMaster as any)._id,
          isOwner: true,
          isVerified: constants.PROFILE_STATUS.APPROVE,
        });

        result.establishmentId = (establishmentMaster as any)._id;
      } else {
        // not owner: create separate hospital user and related records

        // if doctor was owner earlier, remove those records and reset user type
        if (parentDoctor.isOwnEstablishment) {
          await common.removeById(EstablishmentMaster as any, parentDoctor.establishmentMasterId);
          await common.removeById(Hospital as any, parentDoctor.hospitalId);
          await common.updateById(User as any, parentId, { userType: [constants.USER_TYPES.DOCTOR] });
        }

        // create hospital user
        const hospitalUser = await common.create(User as any, {
          fullName: name,
          userType: constants.USER_TYPES.HOSPITAL,
          createdBy: new mongoose.Types.ObjectId(parentId),
        });

        const createHospital = await common.create(Hospital as any, {
          userId: new mongoose.Types.ObjectId((hospitalUser as any)._id),
          hospitalType: new mongoose.Types.ObjectId(hospitalTypeId),
          createdBy: new mongoose.Types.ObjectId(parentId),
        });

        const createEstablishment = await common.create(EstablishmentMaster as any, {
          hospitalId: new mongoose.Types.ObjectId((createHospital as any)?._id),
          name,
          hospitalTypeId,
          createdBy: new mongoose.Types.ObjectId(parentId),
        });

        await common.create(EstablishmentTiming as any, {
          establishmentId: (createEstablishment as any)._id,
          isOwner: true,
          isVerified: constants.PROFILE_STATUS.APPROVE,
          createdBy: new mongoose.Types.ObjectId(parentId),
        });

        result.establishmentId = (createEstablishment as any)._id;
      }
    } else if (isOwner) {
      // hospitalId provided and doctor set as owner -> update hospital & establishment master if not completed/approved
      const hospitalData = await common.getByCondition(Hospital as any, {
        _id: new mongoose.Types.ObjectId(hospitalId),
        steps: { $ne: constants.PROFILE_STEPS.COMPLETED },
        isVerified: { $ne: constants.PROFILE_STATUS.APPROVE },
      });

      if (hospitalData) {
        await common.updateById(Hospital as any, hospitalId, {
          hospitalType: new mongoose.Types.ObjectId(hospitalTypeId || (hospitalData as any).hospitalType),
        });

        const establishmentMasterData = await common.getByCondition(EstablishmentMaster as any, {
          hospitalId: new mongoose.Types.ObjectId((hospitalData as any)._id),
        });

        if (establishmentMasterData) {
          await common.updateById(EstablishmentMaster as any, (establishmentMasterData as any)._id, {
            name,
            hospitalTypeId: new mongoose.Types.ObjectId(hospitalTypeId || (hospitalData as any).hospitalType),
          });
        }
      }
    } else {
      // hospitalId provided & not owner -> link to existing hospital/establishment
      if (parentDoctor.isOwnEstablishment) {
        await common.removeById(EstablishmentMaster as any, parentDoctor.establishmentMasterId);
        await common.removeById(Hospital as any, parentDoctor.hospitalId);
        await common.updateById(User as any, parentId, { userType: [constants.USER_TYPES.DOCTOR] });
      }

      const hospitalData = await common.getByCondition(Hospital as any, { _id: new mongoose.Types.ObjectId(hospitalId) });
      const establishmentData = await common.getByCondition(EstablishmentMaster as any, { hospitalId: new mongoose.Types.ObjectId((hospitalData as any)?._id) });

      if (!hospitalData || !establishmentData) return null;

      await common.updateByCondition(Hospital as any, { _id: new mongoose.Types.ObjectId(hospitalId) }, {
        hospitalType: new mongoose.Types.ObjectId(hospitalTypeId || (hospitalData as any).hospitalType),
      });

      await common.updateByCondition(EstablishmentMaster as any, { hospitalId: new mongoose.Types.ObjectId(hospitalId) }, {
        name,
        hospitalTypeId: new mongoose.Types.ObjectId(hospitalTypeId || (establishmentData as any)?.hospitalTypeId),
      }, constants.USER_TYPES.HOSPITAL);

      await common.updateByCondition(Doctor as any, { userId: new mongoose.Types.ObjectId(parentId) }, { isOwnEstablishment: false }, constants.USER_TYPES.DOCTOR);
      result.establishmentId = (establishmentData as any)._id;
    }

    result.doctorId = parentDoctor.doctorId || parentDoctor._id;
    result.isOwner = isOwner;
    result.isVerified = isOwner ? constants.PROFILE_STATUS.APPROVE : constants.PROFILE_STATUS.PENDING;

    return result;
  } catch (error) {
    console.error("updatesEstablishmentMaster error:", error);
    return false;
  }
};



// ---  function ---
const calenderList = async (
  matchCondition: AnyObj,
  condition1: AnyObj
): Promise<AnyObj[] | false> => {
  try {
    const pipeline: PipelineStage[] = [
      { $match: matchCondition },
      { $match: condition1 },

      // Lookup Doctor
      {
        $lookup: {
          from: "doctors",
          localField: "doctorId",
          foreignField: "_id",
          as: "doctorTableDetails",
        },
      },
      {
        $unwind: {
          path: "$doctorTableDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Lookup Doctor User Details
      {
        $lookup: {
          from: "users",
          localField: "doctorTableDetails.userId",
          foreignField: "_id",
          as: "doctorDetails",
        },
      },
      { $unwind: { path: "$doctorDetails", preserveNullAndEmptyArrays: true } },

      // Lookup Patient
      {
        $lookup: {
          from: "patients",
          localField: "patientId",
          foreignField: "_id",
          as: "patientData",
        },
      },
      { $unwind: { path: "$patientData", preserveNullAndEmptyArrays: true } },

      // Lookup Patient’s User Details
      {
        $lookup: {
          from: "users",
          localField: "patientData.userId",
          foreignField: "_id",
          as: "patientDetails",
        },
      },
      { $unwind: { path: "$patientDetails", preserveNullAndEmptyArrays: true } },

      // Lookup Establishment Master
      {
        $lookup: {
          from: "establishmentmasters",
          let: { establishmentId: "$establishmentId" },
          pipeline: [
            {
              $match: {
                $expr: { $and: [{ $eq: ["$_id", "$$establishmentId"] }] },
              },
            },
          ],
          as: "establishmentMasterData",
        },
      },
      { $match: { "establishmentMasterData.doctorId": { $exists: false } } },
      {
        $unwind: {
          path: "$establishmentMasterData",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Project final structure
      {
        $project: {
          _id: 1,
          date: 1,
          reason: { $ifNull: [`$reason`, constants.NA] },
          status: { $ifNull: [`$status`, constants.NA] },
          fullName: { $ifNull: [`$fullName`, constants.NA] },
          consultationType: 1,
          /** Google Meet link – used by frontends to open the video call. */
          videoMeetingUrl: { $ifNull: ["$videoMeetingUrl", null] },
          /** Doctor's registered email – frontends append as ?authuser= */
          doctorEmail: { $ifNull: ["$doctorTableDetails.email", null] },
          /** Patient's registered email – patient-side frontends append as ?authuser= */
          patientEmail: { $ifNull: ["$patientDetails.email", null] },
          doctorDetails: {
            fullName: "$doctorDetails.fullName",
            phone: "$doctorDetails.phone",
          },
          patientDetails: {
            fullName: "$patientDetails.fullName",
            phone: "$patientDetails.phone",
            email: "$patientDetails.email",
            isVerified: "$patientData.isVerified",
            profilePic: "$patientData.profilePic",
          },
        },
      },

      { $sort: { date: -1 } },

      // Group by Date
      {
        $group: {
          _id: { $dateToString: { date: "$date" } },
          data: { $push: "$$ROOT" },
        },
      },

      { $sort: { _id: 1 } },
    ];

    const data = await Appointment.aggregate(pipeline);
    return data;
  } catch (error) {
    console.error("Error in calenderList:", error);
    return false;
  }
};


const getProfile = async (condition:any) => {
  try {
    const data = await User.aggregate([
      { $match: condition },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "userId",
          as: "doctor",
        },
      },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "specializations",
          localField: "doctor.specialization",
          foreignField: "_id",
          as: "doctor.specializations",
        },
      },
      {
        $addFields: {
          "doctor.specializations": {
            $map: {
              input: "$doctor.specializations",
              as: "spec",
              in: { _id: "$$spec._id", name: "$$spec.name" },
            },
          },
        },
      },
    ]);
    return data.length === 0 ? false : data;
  } catch (error) {
    return false;
  }
};

const establishmentListforPortal = async (
  condition: Record<string, any>,
  limit: number,
  skip: number
): Promise<any> => {
  try {
    const pipeline: PipelineStage[] = [
      { $match: { ...condition, isDeleted: { $ne: true } } },
      {
        $lookup: {
          from: "establishmentmasters",
          localField: "establishmentId",
          foreignField: "_id",
          as: "establishmentData",
        },
      },
      {
        $unwind: {
          path: "$establishmentData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "hospitaltypes",
          localField: "establishmentData.hospitalTypeId",
          foreignField: "_id",
          as: "hospitalTypeData",
        },
      },
      {
        $unwind: {
          path: "$hospitalTypeData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "hospitals",
          localField: "establishmentData.hospitalId",
          foreignField: "_id",
          as: "hospitalData",
        },
      },
      {
        $unwind: { path: "$hospitalData", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "users",
          localField: "hospitalData.userId",
          foreignField: "_id",
          as: "userData",
        },
      },
      {
        $unwind: { path: "$userData", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          establishmentId: 1,
          doctorId: 1,
          isOwner: 1,
          isVerified: {
            $cond: {
              if: { $eq: ["$isOwner", true] },
              then: "$hospitalData.isVerified",
              else: "$isVerified",
            },
          },
          isDeleted: 1,
          consultationFees: 1,
          videoConsultationFees: 1,
          mon: 1,
          tue: 1,
          wed: 1,
          thu: 1,
          fri: 1,
          sat: 1,
          sun: 1,
          isActive: 1,
          establishmentProof: 1,
          hospitalData: {
            address: "$hospitalData.address",
            location: "$hospitalData.location",
            name: "$establishmentData.name",
            hospitalId: "$establishmentData.hospitalId",
          },
          hospitalTypeId: { $ifNull: ["$establishmentData.hospitalTypeId", null] },
        },
      },
      {
        $facet: {
          count: [{ $count: "count" }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
      {
        $addFields: {
          count: { $arrayElemAt: ["$count.count", 0] },
        },
      },
    ];

    const data = await EstablishmentTiming.aggregate(pipeline);
    return data[0] || { data: [], count: 0 };
  } catch (error) {
    console.error("Error in establishmentListforPortal:", error);
    return false;
  }
};

interface DashboardSummary {
  doctor: {
    id: string;
    name: string;
    specialization: string;
    specializationName: string;
    profilePic: string;
  };
  profileCompletion: {
    percentage: number;
    isVerified: boolean;
  };
  appointments: {
    today: {
      total: number;
      completed: number;
      pending: number;
      cancelled: number;
    };
    weekly: {
      total: number;
      completed: number;
    };
    upcoming: number;
  };
  patients: {
    total: number;
    newThisMonth: number;
  };
  revenue: {
    today: number;
    weekly: number;
    monthly: number;
  };
  rating: {
    average: number;
    totalReviews: number;
  };
}

const calculateProfileCompletion = (doctor: any, user: any): number => {
  const fields = [
    user?.fullName,
    doctor?.specialization,
    doctor?.email,
    doctor?.city,
    doctor?.experience,
    doctor?.education?.length > 0,
    doctor?.medicalRegistration?.registrationNumber,
    doctor?.profilePic,
    doctor?.about,
    doctor?.gender
  ];
  const filledFields = fields.filter(f => f && f !== '').length;
  return Math.round((filledFields / fields.length) * 100);
};

const getDashboardSummary = async (userId: string): Promise<DashboardSummary | null> => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    const user = await User.findById(userObjectId).lean();
    if (!user) return null;

    // Use aggregation to get doctor with specialization names
    const doctorData = await Doctor.aggregate([
      { $match: { userId: userObjectId } },
      {
        $lookup: {
          from: "specializations",
          localField: "specialization",
          foreignField: "_id",
          as: "specializationDetails"
        }
      }
    ]);

    if (!doctorData || doctorData.length === 0) return null;
    const doctor = doctorData[0];

    const doctorObjectId = new mongoose.Types.ObjectId((doctor as any)._id);
    const now = new Date();
    
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayStats,
      weeklyStats,
      upcomingCount,
      totalPatients,
      newPatientsThisMonth,
      revenueStats
    ] = await Promise.all([
      Appointment.aggregate([
        {
          $match: {
            doctorId: doctorObjectId,
            isDeleted: false,
            date: { $gte: startOfToday, $lte: endOfToday }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", constants.BOOKING_STATUS.COMPLETED] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", constants.BOOKING_STATUS.BOOKED] }, 1, 0] }
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ["$status", constants.BOOKING_STATUS.CANCELLED] }, 1, 0] }
            }
          }
        }
      ]),
      
      Appointment.aggregate([
        {
          $match: {
            doctorId: doctorObjectId,
            isDeleted: false,
            date: { $gte: startOfWeek, $lte: endOfToday }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", constants.BOOKING_STATUS.COMPLETED] }, 1, 0] }
            }
          }
        }
      ]),
      
      Appointment.countDocuments({
        doctorId: doctorObjectId,
        isDeleted: false,
        status: constants.BOOKING_STATUS.BOOKED,
        date: { $gte: now }
      }),
      
      Appointment.distinct("patientId", {
        doctorId: doctorObjectId,
        isDeleted: false,
        patientId: { $ne: null }
      }).then((ids: any[]) => ids.length),
      
      Appointment.aggregate([
        {
          $match: {
            doctorId: doctorObjectId,
            isDeleted: false,
            patientId: { $ne: null },
            createdAt: { $gte: startOfMonth }
          }
        },
        {
          $group: {
            _id: "$patientId"
          }
        },
        {
          $count: "count"
        }
      ]),
      
      Appointment.aggregate([
        {
          $match: {
            doctorId: doctorObjectId,
            isDeleted: false,
            status: constants.BOOKING_STATUS.COMPLETED,
            consultationFees: { $gt: 0 }
          }
        },
        {
          $facet: {
            today: [
              { $match: { date: { $gte: startOfToday, $lte: endOfToday } } },
              { $group: { _id: null, total: { $sum: "$consultationFees" } } }
            ],
            weekly: [
              { $match: { date: { $gte: startOfWeek, $lte: endOfToday } } },
              { $group: { _id: null, total: { $sum: "$consultationFees" } } }
            ],
            monthly: [
              { $match: { date: { $gte: startOfMonth, $lte: endOfToday } } },
              { $group: { _id: null, total: { $sum: "$consultationFees" } } }
            ]
          }
        }
      ])
    ]);

    const todayData = todayStats[0] || { total: 0, completed: 0, pending: 0, cancelled: 0 };
    const weeklyData = weeklyStats[0] || { total: 0, completed: 0 };
    const newPatients = newPatientsThisMonth[0]?.count || 0;
    const revenueData = revenueStats[0] || { today: [], weekly: [], monthly: [] };

    // Extract specialization names from the lookup
    const specializationNames = (doctor as any).specializationDetails?.map((spec: any) => spec.name).join(', ') || '';

    return {
      doctor: {
        id: String((doctor as any)._id),
        name: (user as any).fullName || '',
        specialization: (doctor as any).specialization || '',
        specializationName: specializationNames,
        profilePic: (doctor as any).profilePic || '',
      },
      profileCompletion: {
        percentage: calculateProfileCompletion(doctor, user),
        isVerified: (doctor as any).isVerified === constants.PROFILE_STATUS.APPROVE
      },
      appointments: {
        today: {
          total: todayData.total,
          completed: todayData.completed,
          pending: todayData.pending,
          cancelled: todayData.cancelled
        },
        weekly: {
          total: weeklyData.total,
          completed: weeklyData.completed
        },
        upcoming: upcomingCount
      },
      patients: {
        total: totalPatients,
        newThisMonth: newPatients
      },
      revenue: {
        today: revenueData.today[0]?.total || 0,
        weekly: revenueData.weekly[0]?.total || 0,
        monthly: revenueData.monthly[0]?.total || 0
      },
      rating: {
        average: (doctor as any).rating || 0,
        totalReviews: (doctor as any).totalreviews || 0
      }
    };
  } catch (error) {
    console.error("doctorService.getDashboardSummary error:", error);
    return null;
  }
};

const getDashboardProfile = async (userId: string) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    const user = await User.findById(userObjectId).select('fullName phone').lean();
    if (!user) return null;

    const doctor = await Doctor.findOne({ userId: userObjectId }).select('profileSlug profilePic city').lean();
    if (!doctor) return null;

    const profileSlug = (doctor as any).profileSlug || 
      slugify((user as any).fullName || 'doctor', { lower: true, strict: true });
    const redirectCity = ((doctor as any).city ? slugify((doctor as any).city, { lower: true, strict: true }) : 'india');

    return {
      user: {
        id: String((user as any)._id),
        fullName: (user as any).fullName || '',
        phone: (user as any).phone || ''
      },
      doctor: {
        id: String((doctor as any)._id),
        profilePic: (doctor as any).profilePic || '',
        profileSlug,
        redirectCity
      }
    };
  } catch (error) {
    console.error("doctorService.getDashboardProfile error:", error);
    return null;
  }
};

interface AnalyticsData {
  appointmentTrends: {
    date: string;
    total: number;
    completed: number;
    cancelled: number;
  }[];
  revenueTrends: {
    date: string;
    amount: number;
  }[];
  consultationTypeBreakdown: {
    video: number;
    inClinic: number;
  };
}

const getAnalytics = async (userId: string, days: number = 30): Promise<AnalyticsData | null> => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    const doctor = await Doctor.findOne({ userId: userObjectId }).lean();
    if (!doctor) return null;

    const doctorObjectId = new mongoose.Types.ObjectId((doctor as any)._id);
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const [appointmentTrends, revenueTrends, consultationTypes] = await Promise.all([
      Appointment.aggregate([
        {
          $match: {
            doctorId: doctorObjectId,
            isDeleted: false,
            date: { $gte: startDate, $lte: now }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", constants.BOOKING_STATUS.COMPLETED] }, 1, 0] }
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ["$status", constants.BOOKING_STATUS.CANCELLED] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      Appointment.aggregate([
        {
          $match: {
            doctorId: doctorObjectId,
            isDeleted: false,
            status: constants.BOOKING_STATUS.COMPLETED,
            consultationFees: { $gt: 0 },
            date: { $gte: startDate, $lte: now }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            amount: { $sum: "$consultationFees" }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      Appointment.aggregate([
        {
          $match: {
            doctorId: doctorObjectId,
            isDeleted: false,
            date: { $gte: startDate, $lte: now }
          }
        },
        {
          $group: {
            _id: "$consultationType",
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const consultationBreakdown = { video: 0, inClinic: 0 };
    consultationTypes.forEach((item: any) => {
      if (item._id === constants.CONSULTATION_TYPES.VIDEO) {
        consultationBreakdown.video = item.count;
      } else if (item._id === constants.CONSULTATION_TYPES.IN_CLINIC) {
        consultationBreakdown.inClinic = item.count;
      }
    });

    return {
      appointmentTrends: appointmentTrends.map((item: any) => ({
        date: item._id,
        total: item.total,
        completed: item.completed,
        cancelled: item.cancelled
      })),
      revenueTrends: revenueTrends.map((item: any) => ({
        date: item._id,
        amount: item.amount
      })),
      consultationTypeBreakdown: consultationBreakdown
    };
  } catch (error) {
    console.error("doctorService.getAnalytics error:", error);
    return null;
  }
};

/**
 * getForSetting - aggregate social media entries with their lookup data
 */
const getForSetting = async (model: any, condition: Record<string, any>) => {
  try {
    const data = await model.aggregate([
      { $match: condition },
      { $project: { _id: 0, social: 1 } },
      { $unwind: { path: "$social", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "socialmedias",
          localField: "social.socialMediaId",
          foreignField: "_id",
          as: "socialMedia",
        },
      },
      { $unwind: { path: "$socialMedia", preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: "$social._id",
          socialMediaId: "$socialMedia._id",
          name: "$socialMedia.name",
          socialMediaLogo: "$socialMedia.logo",
          url: "$social.url",
        },
      },
    ]);
    return data.length === 0 ? false : data;
  } catch (error) {
    console.error("getForSetting error:", error);
    return false;
  }
};

export default {
  getPatientList,
  getDoctorProfile,
  calenderList,
  generateDoctorSlug,
  updatesUser,
  updatesDoctor,
  updatesEstablishmentMaster,
  getProfile,
  establishmentListforPortal,
  getDashboardSummary,
  getDashboardProfile,
  getAnalytics,
  getForSetting
};
