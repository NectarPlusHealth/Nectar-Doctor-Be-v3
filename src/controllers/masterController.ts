// src/controllers/masterController.ts
import { Request, Response } from "express";
import Specialization from "../models/Specialization";
import SocialMedia from "../models/SocialMedia";
import response from "../utils/response";
import httpStatus from "../utils/httpStatus";
import constants from "../utils/constant";
import { getPagination } from "../utils/common";

const MASTER_DATA_MODELS: Record<string, any> = {
  specialization: Specialization,
  "social-media": SocialMedia,
};

/**
 * GET /api/v1/master/specialization
 * Returns all specializations sorted by name ascending.
 */
const getAllMasterData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, sort, page, size, sortOrder } = req.query as Record<string, string>;

    // Extract model key from URL path: "/specialization?..." → "specialization"
    const modelKey = req.path.split("/")[1]?.split("?")[0];
    const model = MASTER_DATA_MODELS[modelKey];

    if (!model) {
      response.error({ msgCode: "MODEL_NOT_FOUND" }, res, httpStatus.BAD_REQUEST);
      return;
    }

    const { limit, offset } = getPagination(page, size);

    const sortCondition: Record<string, number> =
      modelKey === "specialization"
        ? { name: constants.LIST.ORDER.ASC }
        : { [sort || "name"]: constants.LIST.ORDER[sortOrder as keyof typeof constants.LIST.ORDER] || 1 };

    const searchCondition = search
      ? { name: { $regex: new RegExp(search, "i") } }
      : {};

    const condition: Record<string, any> = {
      ...searchCondition,
      isDeleted: { $ne: true },
    };

    const projection: Record<string, number> =
      modelKey === "social-media" ? { _id: 1, name: 1, logo: 1 } : { _id: 1, name: 1 };

    const data = await model
      .find(condition, projection)
      .sort(sortCondition)
      .skip(offset)
      .limit(limit)
      .lean();

    response.success({ msgCode: "MASTER_LIST", result: { data } }, res, httpStatus.OK);
  } catch (error) {
    console.error("Error fetching master data:", error);
    response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

export default { getAllMasterData };
