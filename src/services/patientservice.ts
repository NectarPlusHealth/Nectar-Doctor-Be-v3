// src/services/patient.service.ts
import Patient from "../models/Patient";
import Appointment from "../models/Appointment";
import constants from "../utils/constant";
import { Types } from "mongoose";
export type ListResult = { count: number; data: any[] };
/**
 * getPatientData
 * - Returns a single patient document enriched with the linked user and appointment list.
 * - Accepts a MongoDB condition (e.g. { _id: new ObjectId(patientId) }).
 *
 * Returns: the patient object or null if not found / on error.
 */
export async function getPatientData(condition: Record<string, any>): Promise<any | null> {
  try {
    if (!Patient || typeof (Patient as any).aggregate !== "function") {
      console.error("Patient model not available or invalid");
      return null;
    }

    // Defensive: if someone passed string id, try to convert to ObjectId for match
    const matchCondition = { ...condition };
    if (matchCondition._id && typeof matchCondition._id === "string") {
      try {
        matchCondition._id = new Types.ObjectId(matchCondition._id);
      } catch (err) {
        // keep original if conversion fails
      }
    }

    const pipeline: any[] = [
      { $match: matchCondition },

      // populate linked user (if patient.userId exists)
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

      // normalize / project fields returned to the caller
      {
        $project: {
          _id: 1,
          // patient name can be in patient doc or user.fullName
          patientName: {
            $ifNull: [
              "$patientName",
              "$name",
              { $ifNull: ["$user.fullName", constants.NA] },
            ],
          },
          phone: { $ifNull: ["$phone", "$user.phone", constants.NA] },
          gender: { $ifNull: ["$gender", constants.NA] },
          email: { $ifNull: ["$email", "$user.email", constants.NA] },
          dob: { $ifNull: ["$dob", null] },
          bloodGroup: { $ifNull: ["$bloodGroup", 0] },
        },
      },

      // ensure single result
      { $limit: 1 },
    ];

    const aggResult = await (Patient as any).aggregate(pipeline).allowDiskUse(true);
    const result = aggResult && aggResult[0] ? aggResult[0] : null;

    return result;
  } catch (err) {
    console.error("patientService.getPatientData error:", err);
    return null;
  }
}

export async function appointmentList(condition: Record<string, any>): Promise<ListResult | false> {
  try {
    if (!Appointment || typeof (Appointment as any).aggregate !== "function") {
      console.error("Appointment model not available or invalid");
      return { count: 0, data: [] };
    }

    // Defensive conversion: if doctorId/patientId passed as strings, convert to ObjectId
    const condCopy = { ...condition };
    if (condCopy.doctorId && typeof condCopy.doctorId === "string") {
      try {
        condCopy.doctorId = new Types.ObjectId(condCopy.doctorId);
      } catch {
        // ignore conversion error
      }
    }
    if (condCopy.patientId && typeof condCopy.patientId === "string") {
      try {
        condCopy.patientId = new Types.ObjectId(condCopy.patientId);
      } catch {
        // ignore conversion error
      }
    }

    const pipeline: any[] = [
      { $match: condCopy },
      {
        $lookup: {
          from: "doctors",
          localField: "doctorId",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "doctor.userId",
          foreignField: "_id",
          as: "doctorUser",
        },
      },
      { $unwind: { path: "$doctorUser", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          doctorName: { $ifNull: ["$doctorUser.fullName", constants.NA] },
          date: 1,
          slotTime: 1,
          createdAt: 1,
          consultationType: 1,
          status: 1,
        },
      },
      {
        $facet: {
          count: [{ $count: "total" }],
          // NOTE: original code used a hard limit of 10 and sorted ascending by date.
          data: [{ $sort: { date: 1 } }, { $limit: 10 }],
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
    console.error("patientService.appointmentList error:", err);
    return false;
  }
}

/**
 * appointmentList - fetches aggregated appointment list with optional pagination/search/export
 *
 * @param condition - mongo match condition
 * @param limit - number of records per page
 * @param skip - offset (number of records to skip)
 * @param search - optional search string (matches patient name or phone)
 * @param isExport - if true, do not apply pagination (return full data)
 *
 * @returns aggregated result object { count, data } or false on error
 */
export const getAppointmentList = async (
  condition: Record<string, any>,
  limit: number,
  skip: number,
  search?: string,
  isExport?: boolean
): Promise<any | false> => {
  try {
    const matchSearch: Record<string, any> = {};
    if (search && typeof search === "string" && search.trim()) {
      const s = search.trim();
      matchSearch.$or = [
        { "patientDetails.fullName": { $regex: s, $options: "i" } },
        { "patientDetails.phone": { $regex: s, $options: "i" } },
      ];
    }

    const facetObject: any = {
      count: [{ $count: "count" }],
      data: [],
    };

    if (!isExport) {
      facetObject.data.push({ $skip: Number(skip) || 0 });
      facetObject.data.push({ $limit: Number(limit) || 10 });
    }

    const pipeline: any[] = [
      { $match: condition },

      // Lookup doctor details
      {
        $lookup: {
          from: "doctors",
          let: { doctorId: "$doctorId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$doctorId"] } } },
            { $project: { id: "$_id", _id: 0, userId: 1 } },
          ],
          as: "doctorDetails",
        },
      },
      { $addFields: { doctorDetails: { $arrayElemAt: ["$doctorDetails", 0] } } },

      // Lookup doctor user details
      {
        $lookup: {
          from: "users",
          let: { userId: "$doctorDetails.userId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
            { $project: { id: "$_id", _id: 0, fullName: 1, phone: 1 } },
          ],
          as: "doctorDetailsFromUser",
        },
      },
      { $addFields: { doctorDetailsFromUser: { $arrayElemAt: ["$doctorDetailsFromUser", 0] } } },

      // Lookup patient
      {
        $lookup: {
          from: "patients",
          localField: "patientId",
          foreignField: "_id",
          as: "patientData",
        },
      },
      { $unwind: { path: "$patientData", preserveNullAndEmptyArrays: true } },

      // Lookup patient user details
      {
        $lookup: {
          from: "users",
          localField: "patientData.userId",
          foreignField: "_id",
          as: "patientDetails",
        },
      },

      // Apply search (after patientDetails lookup so fields exist)
      { $match: matchSearch },

      { $unwind: { path: "$patientDetails", preserveNullAndEmptyArrays: true } },

      // establishment & hospital lookups
      {
        $lookup: {
          from: "establishmentmasters",
          localField: "establishmentId",
          foreignField: "_id",
          as: "establishmentData",
        },
      },
      { $unwind: { path: "$establishmentData", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "hospitals",
          localField: "establishmentData.hospitalId",
          foreignField: "_id",
          as: "hospitalDetailsFromHospital",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "hospitalDetailsFromHospital.userId",
          foreignField: "_id",
          as: "hospitalDetailsFromUser",
        },
      },
      { $unwind: { path: "$hospitalDetailsFromUser", preserveNullAndEmptyArrays: true } },

      // Select fields to return the sate slotTime doctor name from doctorDetailsFromUser
      {
        $project: {
          date: 1,
          status: 1,
          slotTime: 1,
          consultationType: 1,
          doctorName: "$doctorDetailsFromUser.fullName",
        },
      },

      // sort by date ascending
      { $sort: { date: 1 } },

      // facet for pagination + count
      { $facet: facetObject },

      // add count field
      { $addFields: { count: { $arrayElemAt: ["$count.count", 0] } } },
    ];

    const data = await Appointment.aggregate(pipeline).allowDiskUse(true);
    // pipeline returns array with one element (because of facet). If no results, return object with empty fields
    if (!data || data.length === 0) {
      return { count: 0, data: [] };
    }

    return data[0];
  } catch (error) {
    console.error("Error in patientservice.appointmentList:", error);
    return false;
  }
};


export default {
  getPatientData,appointmentList,getAppointmentList
};
