// src/routes/services.ts
import { Router } from "express";
import { verifyAuthToken } from "../utils/auth";
import servicesController from "../controllers/servicesController";

const router = Router();

// GET /api/v1/services/get-all-services
router.get("/get-all-services", verifyAuthToken, servicesController.getAllServices);

export default router;
