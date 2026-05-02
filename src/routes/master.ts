// src/routes/master.ts
import { Router } from "express";
import masterController from "../controllers/masterController";

const router = Router();

// GET /api/v1/master/specialization
router.get("/specialization", masterController.getAllMasterData);

// GET /api/v1/master/social-media
router.get("/social-media", masterController.getAllMasterData);

export default router;
