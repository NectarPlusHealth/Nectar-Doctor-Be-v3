// src/controllers/servicesController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import Specialization from "../models/Specialization";
import Service from "../models/Service";
import response from "../utils/response";
import httpStatus from "../utils/httpStatus";

/**
 * GET /api/v1/services/get-all-services
 * Accepts optional query param `specializationIds` (comma-separated ObjectIds)
 * to filter services server-side by doctor's specialization(s).
 * Returns services with specializationId and resolved specialization name.
 */
const getAllServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { specializationIds } = req.query;

    // Parse optional comma-separated specialization IDs for filtering
    let specIds: string[] = [];
    if (typeof specializationIds === "string" && specializationIds.trim()) {
      specIds = specializationIds
        .split(",")
        .map((s) => s.trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id));
    }

    // Fetch only relevant specializations if IDs provided
    const specFilter: Record<string, any> =
      specIds.length > 0
        ? { _id: { $in: specIds.map((id) => new mongoose.Types.ObjectId(id)) } }
        : {};
    const specializations = await Specialization.find(specFilter).lean();

    const specializationMap = specializations.reduce<Record<string, string>>(
      (map, spec) => {
        map[spec._id.toString()] = spec.name;
        return map;
      },
      {}
    );

    // Filter services by specialization if IDs provided
    const serviceFilter: Record<string, any> =
      specIds.length > 0
        ? { specializationId: { $in: specIds.map((id) => new mongoose.Types.ObjectId(id)) } }
        : {};
    const services = await Service.find(serviceFilter, "_id name specializationId").lean();

    const data = services.map((svc) => ({
      _id: svc._id,
      name: svc.name,
      specializationId: svc.specializationId?.toString() || "",
      specialization: svc.specializationId
        ? specializationMap[svc.specializationId.toString()] || "Other"
        : "Other",
    }));

    response.success({ msgCode: "ALL_SERVICES_FOUND", data }, res, httpStatus.OK);
  } catch (error) {
    console.error("getAllServices error:", error);
    response.error(
      { msgCode: "SOMETHING_WENT_WRONG" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

export default { getAllServices };
