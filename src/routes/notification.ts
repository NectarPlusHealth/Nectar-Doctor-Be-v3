// src/routes/notification.ts
import { Router } from "express";
import { verifyAuthToken } from "../utils/auth";
import { internalAuth } from "../middlewares/internalAuth";
import notificationController from "../controllers/notificationController";

const router = Router();

// User-facing notification routes (requires user JWT)
router.get("/list", verifyAuthToken, notificationController.list);
router.get("/unread-count", verifyAuthToken, notificationController.unreadCount);
router.put("/mark-all-read", verifyAuthToken, notificationController.markAllRead);
router.put("/mark-read/:id", verifyAuthToken, notificationController.markRead);
router.delete("/clear-all", verifyAuthToken, notificationController.clearAll);
router.delete("/:id", verifyAuthToken, notificationController.remove);

// Internal route — called by Admin Backend only (secured by x-internal-key header)
router.post("/internal/send", internalAuth, notificationController.sendPushNotification);

export default router;
