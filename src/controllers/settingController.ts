// src/controllers/settingController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import Doctor from "../models/Doctor";
import User from "../models/User";
import response from "../utils/response";
import httpStatus from "../utils/httpStatus";
import constants from "../utils/constant";
import doctorService from "../services/doctorService";
import { getByCondition } from "../utils/common";

/**
 * GET /api/v1/setting/profile
 * Returns the doctor's full profile with specialization lookups.
 */
const getDoctorProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    let { userId, isAdmin } = (req as any).data;
    if (isAdmin) userId = req.query.userId;

    const condition = {
      _id: new ObjectId(userId),
      userType: constants.USER_TYPES.DOCTOR,
    };

    const userDetails = await doctorService.getProfile(condition);
    if (!userDetails) {
      response.error({ msgCode: "ACCOUNT_NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    response.success(
      { msgCode: "ACCOUNT_DATA", result: userDetails },
      res,
      httpStatus.OK
    );
  } catch (error) {
    console.error("getDoctorProfile error:", error);
    response.error({ msgCode: "SOMETHING_WENT_WRONG" }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * GET /api/v1/setting/list?type=5
 * Returns a specific section of the doctor's profile records (education, awards, services, social, etc.)
 */
const getDoctorSettingsList = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.query as Record<string, string>;
    let { userId, isAdmin } = (req as any).data;
    if (isAdmin) userId = req.query.userId;

    const typeNum = Number(type);
    const condition = { userId: new ObjectId(userId) };
    const recordKey = constants.DOCTOR_PROFILE_RECORD_KEY[`${typeNum}`];

    let userDetails: any;
    if (typeNum !== constants.DOCTOR_PROFILE.SOCIALS) {
      userDetails = await getByCondition(Doctor, condition);
    } else {
      userDetails = await doctorService.getForSetting(Doctor, condition);
    }

    const data =
      typeNum !== constants.DOCTOR_PROFILE.SOCIALS
        ? {
            count: userDetails?.[recordKey]?.length || 0,
            list: userDetails?.[recordKey]
              ? [...userDetails[recordKey]].reverse()
              : [],
          }
        : {
            count: userDetails?.length || 0,
            list: Array.isArray(userDetails) ? [...userDetails].reverse() : [],
          };

    response.success({ result: data }, res, httpStatus.OK);
  } catch (error) {
    console.error("Error in getDoctorSettingsList:", error);
    response.error(
      { msgCode: "SOMETHING_WENT_WRONG" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * PUT /api/v1/setting/list
 * Add, update, or delete a doctor's setting record (education, awards, services, social, etc.)
 */
const addDoctorSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, records, isDeleted, isEdit } = req.body;
    let { userId, isAdmin } = (req as any).data;
    if (isAdmin) userId = req.query.userId;

    const { recordId } = req.query as Record<string, string>;
    const typeNum = Number(type);
    const recordKey = constants.DOCTOR_PROFILE_RECORD_KEY[`${typeNum}`];

    const condition: Record<string, any> = { userId: new ObjectId(userId) };
    const isFlatArray = constants.FLAT_OBJECTID_FIELDS.includes(typeNum);
    const isNameBased = constants.NAME_BASED_SUBDOC_FIELDS.includes(typeNum);

    // Build the match condition based on field type
    if (recordId) {
      if (isFlatArray) {
        // Flat ObjectId array (e.g. procedure) — match by ObjectId value
        condition[recordKey] = new ObjectId(recordId);
      } else if (isNameBased) {
        // Sub-doc with {_id: false} (e.g. service) — match by name
        condition[`${recordKey}.name`] = recordId;
      } else {
        // Standard sub-doc with _id
        condition[`${recordKey}._id`] = new ObjectId(recordId);
      }
    }

    // Build projection
    const projectionKey: Record<string, number> = { _id: 1 };
    if (!isFlatArray && !isNameBased && condition[`${recordKey}._id`]) {
      projectionKey[`${recordKey}.$`] = 1;
    }
    if (isNameBased && condition[`${recordKey}.name`]) {
      projectionKey[`${recordKey}.$`] = 1;
    }

    const userDetails: any = await Doctor.findOne(condition, projectionKey).lean();

    if (!userDetails) {
      response.error({ msgCode: "NOT_FOUND" }, res, httpStatus.NOT_FOUND);
      return;
    }

    if (isEdit) {
      if (isDeleted) {
        // DELETE record
        const pullObj: Record<string, any> = {};
        if (isFlatArray) {
          pullObj[recordKey] = new ObjectId(recordId);
        } else if (isNameBased) {
          pullObj[recordKey] = { name: recordId };
        } else {
          pullObj[recordKey] = userDetails[recordKey][0];
        }
        await Doctor.findOneAndUpdate(
          { userId: new ObjectId(userId) },
          { $pull: pullObj },
          { multi: true } as any
        );
        response.success({ msgCode: "DELETE_SUCCESS" }, res, httpStatus.OK);
        return;
      } else {
        // UPDATE existing record
        if (isFlatArray) {
          response.error({ msgCode: "UPDATE_NOT_SUPPORTED" }, res, httpStatus.BAD_REQUEST);
          return;
        }
        const updates: Record<string, any> = {};
        updates[`${recordKey}.$`] = { ...userDetails[recordKey][0], ...records };
        await Doctor.updateOne(condition, { $set: updates });
        response.success({ msgCode: "UPDATE_SUCCESS" }, res, httpStatus.OK);
        return;
      }
    } else {
      // ADD new record
      const pushObj: Record<string, any> = {};
      pushObj[recordKey] = isFlatArray ? new ObjectId(records) : records;
      await Doctor.updateOne(
        { userId: new ObjectId(userId) },
        { $push: pushObj }
      );
      response.success({ msgCode: "DATA_ADDED", data: {} }, res, httpStatus.OK);
      return;
    }
  } catch (error) {
    console.error("addDoctorSettings error:", error);
    response.error({ msgCode: "SOMETHING_WENT_WRONG" }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/**
 * PUT /api/v1/setting/profile
 * Updates doctor's basic profile fields (name, gender, specialization, experience, email, about, profilePic).
 * Note: phone changes are handled via the OTP flow, not here.
 */
const updateDoctorProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    let { userId, isAdmin } = (req as any).data;
    if (isAdmin) userId = req.query.userId;

    const userObjectId = new ObjectId(userId);
    const {
      fullName,
      gender,
      specialization,
      experience,
      email,
      about,
      profilePic,
    } = req.body || {};

    // 1) Update User (only fullName lives on User)
    const userUpdate: Record<string, any> = {};
    if (typeof fullName === "string" && fullName.trim()) {
      userUpdate.fullName = fullName.trim();
    }
    if (Object.keys(userUpdate).length) {
      await User.updateOne({ _id: userObjectId }, { $set: userUpdate });
    }

    // 2) Update Doctor (gender, specialization, experience, email, about, profilePic)
    const doctorUpdate: Record<string, any> = {};

    if (typeof gender !== "undefined" && gender !== null && gender !== "") {
      doctorUpdate.gender = Number(gender);
    }

    if (typeof experience !== "undefined" && experience !== null && experience !== "") {
      doctorUpdate.experience = Number(experience);
    }

    if (typeof email === "string") doctorUpdate.email = email.trim();
    if (typeof about === "string") doctorUpdate.about = about;
    if (typeof profilePic === "string") doctorUpdate.profilePic = profilePic;

    if (typeof specialization !== "undefined" && specialization !== null) {
      const specArray = Array.isArray(specialization) ? specialization : [specialization];
      const specIds = specArray
        .filter((s: any) => !!s)
        .map((s: any) => {
          try {
            return new mongoose.Types.ObjectId(String(s));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      doctorUpdate.specialization = specIds;
    }

    if (Object.keys(doctorUpdate).length) {
      await Doctor.updateOne({ userId: userObjectId }, { $set: doctorUpdate });
    }

    // 3) Return the fresh profile so the frontend can refresh local state
    const condition = {
      _id: userObjectId,
      userType: constants.USER_TYPES.DOCTOR,
    };
    const updated = await doctorService.getProfile(condition);

    response.success(
      { msgCode: "UPDATE_SUCCESS", result: updated },
      res,
      httpStatus.OK
    );
  } catch (error) {
    console.error("updateDoctorProfile error:", error);
    response.error(
      { msgCode: "SOMETHING_WENT_WRONG" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

export default { getDoctorProfile, getDoctorSettingsList, addDoctorSettings, updateDoctorProfile };
