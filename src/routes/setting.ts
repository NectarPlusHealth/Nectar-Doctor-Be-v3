// src/routes/setting.ts
import { Router } from "express";
import { verifyAuthToken } from "../utils/auth";
import settingController from "../controllers/settingController";

const router = Router();

// GET /api/v1/setting/profile
router.get("/profile", verifyAuthToken, settingController.getDoctorProfile);

// GET /api/v1/setting/list?type=5
router.get("/list", verifyAuthToken, settingController.getDoctorSettingsList);

// PUT /api/v1/setting/list  (add / update / delete a doctor settings record)
router.put("/list", verifyAuthToken, settingController.addDoctorSettings);

// PUT /api/v1/setting/profile  (update doctor's basic profile info)
router.put("/profile", verifyAuthToken, settingController.updateDoctorProfile);

export default router;
