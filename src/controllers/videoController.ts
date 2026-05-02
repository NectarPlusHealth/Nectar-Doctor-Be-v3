import { Request, Response,NextFunction  } from "express";
import { Types } from "mongoose";
import httpStatus from "http-status";
import constants from "../utils/constant";
import response from "../utils/response"; 

import Doctor from "../models/Doctor";
import Video from "../models/Video";
import EstablishmentMaster from "../models/EstablishmentMaster";
import Hospital from "../models/Hospital"; 
import common from "../utils/common";
// Optional: create an extended Request type if you add `req.data` elsewhere
interface CustomRequest extends Request {
  data?: {
    userId: string;
    isAdmin?: boolean;
  };
}

/**
 * Controller: Fetch all videos for Doctor, Establishment, or User
 */
export const allVideo = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    let videoList: any[] = [];

    const {
      id,
      establishmentId,
      doctorProfileSlug,
      establishmentProfileSlug,
      userId,
    } = req.query as {
      id?: string;
      establishmentId?: string;
      doctorProfileSlug?: string;
      establishmentProfileSlug?: string;
      userId?: string;
    };

    // ===============================
    // CASE 1: Doctor (by ID or slug)
    // ===============================
    if (id || doctorProfileSlug) {
      let findDoctor: any;

      if (doctorProfileSlug) {
        findDoctor = await common.getByCondition(Doctor, {
          profileSlug: doctorProfileSlug,
        });
      } else if (id) {
        findDoctor = await common.getById(Doctor, id);
      }

      if (findDoctor) {
        videoList = await Video.find({
          userId: new Types.ObjectId(findDoctor.userId),
          userType: constants.USER_TYPES.DOCTOR,
        }).select('_id title url userId createdAt').sort({ createdAt: 1 }).lean();
      }
    }

    // ===================================
    // CASE 2: Establishment (by ID/slug)
    // ===================================
    else if (establishmentId || establishmentProfileSlug) {
  let findEstablishment: any;

  if (establishmentProfileSlug) {
    findEstablishment = await common.getByCondition(EstablishmentMaster, {
      profileSlug: establishmentProfileSlug,
    });
  } else if (establishmentId) {
    findEstablishment = await common.getById(EstablishmentMaster, establishmentId);
  }

  if (findEstablishment) {
    const findEstablishmentUser = await common.getById(
      Hospital,
      findEstablishment.hospitalId
    );

    if (findEstablishmentUser && findEstablishmentUser.userId) {
      videoList = await Video.find({
        userId: new Types.ObjectId(findEstablishmentUser.userId),
        userType: constants.USER_TYPES.HOSPITAL,
      }).select('_id title url userId createdAt').sort({ createdAt: 1 }).lean();
    } else {
      console.warn("Hospital not found or missing userId for establishment");
    }
  }
}


    // ===============================
    // CASE 3: Direct userId provided
    // ===============================
    else if (userId) {
      videoList = await Video.find({
        userId: new Types.ObjectId(userId),
      }).select('_id title url userId createdAt').sort({ createdAt: 1 }).lean();
    }

    // ===============================
    // CASE 4: Fallback (empty result)
    // ===============================
    else {
      videoList = [];
    }

    // ===============================
    // SUCCESS RESPONSE
    // ===============================
    response.success(
      {
        "message": "VIDEO_LIST",
        result: { count: videoList?.length || 0, data: videoList },
      },
      res,
      httpStatus.OK
    );
  } catch (error) {
    console.error("Error in allVideo:", error);
    response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

export const addVideo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const content = req.body;
    const addVideo = await common.create(Video, content);

    response.success(
      { msgCode: "VIDEO_ADDED", data: addVideo },
      res,
      httpStatus.OK
    );
  } catch (error) {
    console.log(error);

    response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

export const deleteVideo = async (req:Request, res:Response,next: NextFunction) => {
  try {
    const { id } = req.query;
    await common.removeById(Video, id); // Deleting the Video data
     response.success(
      { msgCode: "VIDEO_DELETED", data: {} },
      res,
      httpStatus.OK
    );
  } catch (error) {
    console.log(error);
     response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

export const updateVideo = async (req:Request, res:Response, next: NextFunction) => {
  try {
    const { id } = req.query;
    const updates = req.body;
    const updateVideo = await common.updateById(Video, id, updates);
     response.success(
      { msgCode: "VIDEO_UPDATED", data: updateVideo },
      res,
      httpStatus.OK
    );
  } catch (error) {
    console.log(error);
     response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};