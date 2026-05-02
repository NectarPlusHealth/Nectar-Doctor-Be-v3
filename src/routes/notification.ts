// src/routes/notification.ts
import { Router } from "express";
import { verifyAuthToken } from "../utils/auth";
import notificationController from "../controllers/notificationController";

const router = Router();

router.get("/list", verifyAuthToken, notificationController.list);
router.get("/unread-count", verifyAuthToken, notificationController.unreadCount);
router.put("/mark-all-read", verifyAuthToken, notificationController.markAllRead);
router.put("/mark-read/:id", verifyAuthToken, notificationController.markRead);
router.delete("/clear-all", verifyAuthToken, notificationController.clearAll);
router.delete("/:id", verifyAuthToken, notificationController.remove);

export default router;
