// src/routes/videoConsultation.ts
import { Router } from "express";
import { verifyAuthToken } from "../utils/auth";
import controller from "../controllers/videoConsultationController";

const router = Router();

// ── Google OAuth (per-doctor) ────────────────────────────────────────────────
router.get("/google/oauth/start", verifyAuthToken, controller.oauthStart);
router.get("/google/oauth/status", verifyAuthToken, controller.oauthStatus);
router.post("/google/oauth/disconnect", verifyAuthToken, controller.oauthDisconnect);
// Public callback Google redirects to (no auth header — uses signed `state`).
router.get("/google/oauth/callback", controller.oauthCallback);

// ── Appointment video room ───────────────────────────────────────────────────C:\Users\User6\Desktop\amritjames_V21\backend

router.get("/appointments/:id/video-link", verifyAuthToken, controller.getVideoLink);
router.post(
  "/appointments/:id/end-consultation",
  verifyAuthToken,
  controller.endConsultation
);

export default router;
