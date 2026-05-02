import { Request, Response } from "express";
import { Types } from "mongoose";
import httpStatus from "http-status";
import constants from "../utils/constant";
import response from "../utils/response";

import Doctor from "../models/Doctor";
import FAQ from "../models/Faq";
import EstablishmentMaster from "../models/EstablishmentMaster";
import Hospital from "../models/Hospital";
import common from "../utils/common";

// Optional: Extend Request type if needed
interface CustomRequest extends Request {
  data?: {
    userId: string;
    isAdmin?: boolean;
  };
}

/**
 * Controller: Fetch all FAQs for Doctor, Establishment, Hospital, or User
 */
export const allFAQ = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    let faqList: any[] = [];

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
        findDoctor = await common.getByCondition(Doctor, { profileSlug: doctorProfileSlug });
      } else if (id) {
        findDoctor = await common.getById(Doctor, id);
      }

      if (findDoctor) {
        faqList = await FAQ.find({
          userId: { $in: [new Types.ObjectId(findDoctor.userId), new Types.ObjectId(findDoctor._id)] },
          userType: constants.USER_TYPES.DOCTOR,
          isDeleted: false,
        }).select('_id question answer createdAt').sort({ createdAt: 1 }).lean();
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
          faqList = await FAQ.find({
            userId: new Types.ObjectId(findEstablishmentUser.userId),
            userType: constants.USER_TYPES.HOSPITAL,
            isDeleted: false,
          }).select('_id question answer createdAt').sort({ createdAt: 1 }).lean();
        } else {
          console.warn("Hospital not found or missing userId for establishment");
        }
      }
    }

    // ===============================
    // CASE 3: Direct userId provided
    // ===============================
    else if (userId) {
      faqList = await FAQ.find({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
      }).select('_id question answer createdAt').sort({ createdAt: 1 }).lean();
    }

    // ===============================
    // CASE 4: Default (Patient FAQs)
    // ===============================
    else {
      faqList = await FAQ.find({
        userType: constants.USER_TYPES.PATIENT,
        isDeleted: false,
      }).select('_id question answer createdAt').sort({ createdAt: 1 }).lean();
    }

    // ===============================
    // SUCCESS RESPONSE
    // ===============================
    response.success(
      {
        message: "FAQ_LIST",
        result: { count: faqList?.length || 0, data: faqList },
        status_code:200
      },
      res,
      httpStatus.OK
    );
  } catch (error) {
    console.error("Error in allFAQ:", error);
    response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};
export const addFAQ = async (req: Request, res: Response): Promise<void> => {
  try {
    const content = req.body;

    const data = await common.create(FAQ, content);

    if (!data) {
      response.error(
        { msgCode: "FAQ_CREATION_FAILED" },
        res,
        httpStatus.BAD_REQUEST
      );
      return;
    }

    response.success(
      { msgCode: "FAQ_ADDED", result:data },
      res,
      httpStatus.OK
    );
  } catch (error) {
    console.error("Error in addFAQ:", error);
    response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

export const updateFAQ = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { question, answer, userType, userId } = req.body;

    const updated = await common.updateById(FAQ, id, { question, answer, userType, userId });

    if (!updated) {
      response.error(
        { msgCode: "FAQ_NOT_FOUND" },
        res,
        httpStatus.NOT_FOUND
      );
      return;
    }

    response.success(
      { msgCode: "FAQ_UPDATED", result: updated },
      res,
      httpStatus.OK
    );
  } catch (error) {
    console.error("Error in updateFAQ:", error);
    response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

export const deleteFAQ = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await common.removeById(FAQ, id); // Deleting the FAQ data
     response.success(
      { msgCode: "FAQ_DELETED", data: {} },
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