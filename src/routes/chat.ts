// src/routes/chat.ts
import { Router } from "express";
import { verifyAuthToken } from "../utils/auth";
import chatController from "../controllers/chatController";

const router = Router();

router.get("/conversations", verifyAuthToken, chatController.listConversations);
router.post("/conversation/start", verifyAuthToken, chatController.startConversation);
router.post("/conversation/:conversationId/payment-order", verifyAuthToken, chatController.createChatPaymentOrder);
router.post("/conversation/:conversationId/pay", verifyAuthToken, chatController.extendChatPayment);
router.get("/payments", verifyAuthToken, chatController.listChatPayments);
router.put("/conversation/:conversationId/read", verifyAuthToken, chatController.markConversationRead);
router.get("/messages/:conversationId", verifyAuthToken, chatController.listMessages);
router.post("/messages", verifyAuthToken, chatController.sendMessage);
router.get("/unread-count", verifyAuthToken, chatController.unreadCount);
router.get("/users/search", verifyAuthToken, chatController.searchUsers);
router.post("/auth/bridge", chatController.authBridge);

export default router;
