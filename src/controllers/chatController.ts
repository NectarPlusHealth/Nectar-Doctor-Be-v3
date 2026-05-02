// src/controllers/chatController.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import ConversationModel from "../models/Conversation";
import ChatPaymentModel from "../models/ChatPayment";
import MessageModel from "../models/Message";
import UserModel from "../models/User";
import AppointmentModel from "../models/Appointment";
import DoctorModel from "../models/Doctor";
import PatientModel from "../models/Patient";
import EstablishmentTimingModel from "../models/EstablishmentTiming";
import response from "../utils/response";
import constants from "../utils/constant";
import { generateAuthJwt } from "../utils/auth";
import crypto from "crypto";
import Razorpay from "razorpay";
import { config } from "../config/environment";

let razorpayClient: Razorpay | null = null;
const getRazorpay = (): Razorpay | null => {
  if (!config.razorpayKeyId || !config.razorpayKeySecret) return null;
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: config.razorpayKeyId,
      key_secret: config.razorpayKeySecret,
    });
  }
  return razorpayClient;
};

interface CustomRequest extends Request {
  data?: { userId: string; userType?: number; fullName?: string };
}

const toObjectId = (id: string) => new Types.ObjectId(id);
const isValidId = (id: any) => typeof id === "string" && Types.ObjectId.isValid(id);

/**
 * Resolve the chat-extension amount (in INR) for a given doctor user. We use
 * the doctor's lowest non-zero consultationFees across their establishments;
 * if the doctor has no fee configured we fall back to the env default.
 */
async function getChatExtensionAmountForDoctor(
  doctorUserId: any
): Promise<number> {
  const fallback = config.chatExtensionAmountInr;
  try {
    if (!doctorUserId) return fallback;
    const doctor = await DoctorModel.findOne({ userId: doctorUserId })
      .select("_id")
      .lean();
    if (!doctor?._id) return fallback;
    const timings: any[] = await EstablishmentTimingModel.find({
      doctorId: doctor._id,
      isDeleted: { $ne: true },
      isActive: { $ne: false },
      consultationFees: { $gt: 0 },
    })
      .select("consultationFees")
      .lean();
    const fees = timings
      .map((t) => Number(t.consultationFees))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!fees.length) return fallback;
    return Math.min(...fees);
  } catch (err: any) {
    console.error(
      "chat.getChatExtensionAmountForDoctor failed:",
      err?.message || err
    );
    return fallback;
  }
}

const buildPairKey = (a: string, b: string) =>
  [a.toString(), b.toString()].sort().join("_");

/** 7 days in milliseconds — the free patient chat window length. */
const CHAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** True if `now` is past the conversation's free chat window. */
const isChatExpired = (convo: any): boolean => {
  const exp = convo?.chatExpiresAt ? new Date(convo.chatExpiresAt).getTime() : 0;
  return exp > 0 && Date.now() > exp;
};

/**
 * Return peer User._id strings reachable from `meUserId` via at least one
 * non-cancelled, non-deleted appointment. Walks:
 *   doctor user  -> doctors.userId  -> appointments.doctorId  -> appointments.patientId  -> patients.userId
 *   patient user -> patients.userId -> appointments.patientId -> appointments.doctorId  -> doctors.userId
 */
async function getAppointmentPeerUserIds(
  meUserId: string,
  meUserType: number,
  peerUserType: number
): Promise<string[]> {
  const PATIENT = constants.USER_TYPES.PATIENT;
  const DOCTOR = constants.USER_TYPES.DOCTOR;
  const apptFilter: any = {
    isDeleted: { $ne: true },
    status: { $ne: constants.BOOKING_STATUS.CANCELLED },
  };

  if (meUserType === DOCTOR && peerUserType === PATIENT) {
    const doctorDoc = await DoctorModel.findOne({ userId: toObjectId(meUserId) })
      .select("_id")
      .lean();
    if (!doctorDoc) return [];
    apptFilter.doctorId = doctorDoc._id;
    const patientIds: any[] = await AppointmentModel.distinct("patientId", apptFilter);
    if (!patientIds.length) return [];
    const patients: any[] = await PatientModel.find({ _id: { $in: patientIds } })
      .select("userId")
      .lean();
    return patients.map((p: any) => p.userId?.toString()).filter(Boolean);
  }

  if (meUserType === PATIENT && peerUserType === DOCTOR) {
    const patientDoc = await PatientModel.findOne({ userId: toObjectId(meUserId) })
      .select("_id")
      .lean();
    if (!patientDoc) return [];
    apptFilter.patientId = patientDoc._id;
    const doctorIds: any[] = await AppointmentModel.distinct("doctorId", apptFilter);
    if (!doctorIds.length) return [];
    const doctors: any[] = await DoctorModel.find({ _id: { $in: doctorIds } })
      .select("userId")
      .lean();
    return doctors.map((d: any) => d.userId?.toString()).filter(Boolean);
  }

  return [];
}

/** POST /api/v1/chat/conversation/start  body: { peerId, peerType } */
const startConversation = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const userType = req.data?.userType ?? constants.USER_TYPES.DOCTOR;
    const { peerId, peerType } = req.body || {};
    if (!userId || !isValidId(peerId) || !peerType) {
      response.error({ message: "Invalid request" }, res, 400);
      return;
    }
    if (peerId === userId) {
      response.error({ message: "Cannot chat with yourself" }, res, 400);
      return;
    }

    // Enforce: a NEW conversation is only allowed between users who share at
    // least one non-cancelled appointment. Existing conversations are not
    // re-checked, so old chats remain readable even if the appointment is
    // later cancelled or removed.
    const pairKeyPre = buildPairKey(userId, peerId);
    const existingConvo = await ConversationModel.findOne({
      pairKey: pairKeyPre,
      isDeleted: { $ne: true },
    })
      .select("_id")
      .lean();
    if (!existingConvo) {
      const allowedPeerIds = await getAppointmentPeerUserIds(
        userId,
        Number(userType),
        Number(peerType)
      );
      if (!allowedPeerIds.includes(peerId.toString())) {
        response.error(
          { message: "You can only chat with users you have an appointment with" },
          res,
          403
        );
        return;
      }
    }

    const peer = await UserModel.findOne({ _id: toObjectId(peerId), isDeleted: { $ne: true } })
      .select("_id fullName phone")
      .lean();
    if (!peer) {
      response.error({ message: "Peer user not found" }, res, 404);
      return;
    }

    const pairKey = buildPairKey(userId, peerId);
    let convo = await ConversationModel.findOne({ pairKey, isDeleted: { $ne: true } });

    if (!convo) {
      convo = await ConversationModel.create({
        participants: [
          { userId: toObjectId(userId), userType: Number(userType) },
          { userId: toObjectId(peerId), userType: Number(peerType) },
        ],
        pairKey,
        unread: new Map<string, number>(),
      });
    }

    response.success(
      {
        message: "Conversation ready",
        result: {
          _id: convo._id,
          peer: { _id: peer._id, fullName: peer.fullName ?? "", phone: peer.phone ?? "" },
          lastMessage: convo.lastMessage ?? null,
          unread: convo.unread?.get(userId) ?? 0,
          chatExpiresAt: convo.chatExpiresAt ?? null,
          requiresPayment: isChatExpired(convo),
          updatedAt: convo.updatedAt,
          createdAt: convo.createdAt,
        },
      },
      res
    );
  } catch (err: any) {
    console.error("chat.startConversation error:", err);
    response.error({ message: err?.message || "Failed to start conversation" }, res, 500);
  }
};

/** GET /api/v1/chat/conversations?page=&limit= */
const listConversations = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    if (!userId) {
      response.error({ message: "Unauthorized" }, res, 401);
      return;
    }
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));

    const filter = {
      "participants.userId": toObjectId(userId),
      isDeleted: { $ne: true },
    };

    const [convos, total] = await Promise.all([
      ConversationModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ConversationModel.countDocuments(filter),
    ]);

    // Resolve peer user info in one query
    const peerIds = convos
      .map((c) => c.participants.find((p) => p.userId.toString() !== userId)?.userId)
      .filter(Boolean) as Types.ObjectId[];
    const peers = peerIds.length
      ? await UserModel.find({ _id: { $in: peerIds } })
          .select("_id fullName phone")
          .lean()
      : [];
    const peerMap = new Map(peers.map((p: any) => [p._id.toString(), p]));

    const items = convos.map((c: any) => {
      const peerPart = c.participants.find((p: any) => p.userId.toString() !== userId);
      const peer = peerPart ? peerMap.get(peerPart.userId.toString()) : null;
      const unreadMap = c.unread || {};
      const unread =
        unreadMap instanceof Map ? unreadMap.get(userId) ?? 0 : unreadMap[userId] ?? 0;
      return {
        _id: c._id,
        peer: peer
          ? { _id: peer._id, fullName: peer.fullName ?? "", phone: peer.phone ?? "" }
          : { _id: peerPart?.userId, fullName: "", phone: "" },
        peerType: peerPart?.userType,
        lastMessage: c.lastMessage ?? null,
        unread,
        chatExpiresAt: c.chatExpiresAt ?? null,
        requiresPayment: isChatExpired(c),
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
      };
    });

    response.success(
      {
        message: "Conversations fetched",
        result: { items, total, page, limit, hasMore: page * limit < total },
      },
      res
    );
  } catch (err: any) {
    console.error("chat.listConversations error:", err);
    response.error({ message: err?.message || "Failed to fetch conversations" }, res, 500);
  }
};

/** GET /api/v1/chat/messages/:conversationId?page=&limit= */
const listMessages = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const conversationId = req.params.conversationId;
    if (!userId || !isValidId(conversationId)) {
      response.error({ message: "Invalid request" }, res, 400);
      return;
    }
    const convo = await ConversationModel.findOne({
      _id: toObjectId(conversationId),
      "participants.userId": toObjectId(userId),
      isDeleted: { $ne: true },
    }).lean();
    if (!convo) {
      response.error({ message: "Conversation not found" }, res, 404);
      return;
    }

    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "30", 10)));

    const baseFilter = {
      conversationId: toObjectId(conversationId),
      isDeleted: { $ne: true },
    };

    const [items, total] = await Promise.all([
      MessageModel.find(baseFilter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MessageModel.countDocuments(baseFilter),
    ]);

    response.success(
      {
        message: "Messages fetched",
        result: {
          items: items.reverse(), // chronological order for UI
          total,
          page,
          limit,
          hasMore: page * limit < total,
        },
      },
      res
    );
  } catch (err: any) {
    console.error("chat.listMessages error:", err);
    response.error({ message: err?.message || "Failed to fetch messages" }, res, 500);
  }
};

/** POST /api/v1/chat/messages  body: { conversationId, body } */
const sendMessage = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const userType = req.data?.userType ?? constants.USER_TYPES.DOCTOR;
    const { conversationId, body } = req.body || {};
    const text = typeof body === "string" ? body.trim() : "";
    if (!userId || !isValidId(conversationId) || !text) {
      response.error({ message: "Invalid request" }, res, 400);
      return;
    }
    if (text.length > 4000) {
      response.error({ message: "Message too long (max 4000 chars)" }, res, 400);
      return;
    }

    const convo = await ConversationModel.findOne({
      _id: toObjectId(conversationId),
      "participants.userId": toObjectId(userId),
      isDeleted: { $ne: true },
    });
    if (!convo) {
      response.error({ message: "Conversation not found" }, res, 404);
      return;
    }

    // Patient-only 7-day chat window. Once expired the patient must pay to
    // extend before sending more messages. Doctors are not blocked.
    if (Number(userType) === constants.USER_TYPES.PATIENT && isChatExpired(convo)) {
      response.error(
        {
          message:
            "Your 7-day chat window has ended. Please pay to continue chatting.",
          result: {
            requiresPayment: true,
            chatExpiresAt: convo.chatExpiresAt,
          },
        },
        res,
        402
      );
      return;
    }

    const message = await MessageModel.create({
      conversationId: convo._id,
      senderId: toObjectId(userId),
      senderType: Number(userType),
      body: text,
    });

    // Update conversation: lastMessage + bump unread for the other participant
    convo.lastMessage = {
      body: text,
      senderId: toObjectId(userId),
      createdAt: message.createdAt as Date,
    };
    const others = convo.participants.filter((p) => p.userId.toString() !== userId);
    for (const p of others) {
      const key = p.userId.toString();
      const current = convo.unread?.get(key) ?? 0;
      convo.unread.set(key, current + 1);
    }
    await convo.save();

    response.success({ message: "Message sent", result: message.toObject() }, res, 201);
  } catch (err: any) {
    console.error("chat.sendMessage error:", err);
    response.error({ message: err?.message || "Failed to send message" }, res, 500);
  }
};

/** PUT /api/v1/chat/conversation/:conversationId/read */
const markConversationRead = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const conversationId = req.params.conversationId;
    if (!userId || !isValidId(conversationId)) {
      response.error({ message: "Invalid request" }, res, 400);
      return;
    }
    const convo = await ConversationModel.findOne({
      _id: toObjectId(conversationId),
      "participants.userId": toObjectId(userId),
      isDeleted: { $ne: true },
    });
    if (!convo) {
      response.error({ message: "Conversation not found" }, res, 404);
      return;
    }

    // Mark all messages from the other side as read
    await MessageModel.updateMany(
      {
        conversationId: convo._id,
        senderId: { $ne: toObjectId(userId) },
        isRead: { $ne: true },
      },
      { $set: { isRead: true, readAt: new Date() } }
    );
    convo.unread.set(userId, 0);
    await convo.save();

    response.success({ message: "Conversation marked as read" }, res);
  } catch (err: any) {
    console.error("chat.markConversationRead error:", err);
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

/** GET /api/v1/chat/unread-count */
const unreadCount = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    if (!userId) {
      response.error({ message: "Unauthorized" }, res, 401);
      return;
    }
    const convos = await ConversationModel.find({
      "participants.userId": toObjectId(userId),
      isDeleted: { $ne: true },
    })
      .select("unread")
      .lean();

    let count = 0;
    for (const c of convos as any[]) {
      const u = c.unread;
      if (!u) continue;
      // .lean() returns Map as a plain object
      const v = u instanceof Map ? u.get(userId) : u[userId];
      if (typeof v === "number") count += v;
    }

    response.success({ message: "Chat unread count", result: { count } }, res);
  } catch (err: any) {
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

/**
 * GET /api/v1/chat/users/search?q=&userType=&limit=
 * Search users (typically patients for doctors, doctors for patients) to start a chat with.
 */
const searchUsers = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    if (!userId) {
      response.error({ message: "Unauthorized" }, res, 401);
      return;
    }
    const q = (req.query.q as string || "").trim();
    const userType = req.query.userType ? Number(req.query.userType) : undefined;
    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));

    const meType = Number(req.data?.userType ?? 0);
    // Restrict the finder to peers reachable through an appointment with the
    // current user. If the caller didn't specify userType we infer it as the
    // inverse of the caller's type, so a doctor can never search the whole
    // patient pool and a patient can never search the whole doctor pool.
    const inferredPeerType = userType
      ? userType
      : meType === constants.USER_TYPES.DOCTOR
      ? constants.USER_TYPES.PATIENT
      : meType === constants.USER_TYPES.PATIENT
      ? constants.USER_TYPES.DOCTOR
      : 0;

    const filter: any = {
      _id: { $ne: toObjectId(userId) },
      isDeleted: { $ne: true },
    };
    if (userType) filter.userType = userType;

    if (inferredPeerType) {
      const allowedPeerIds = await getAppointmentPeerUserIds(
        userId,
        meType,
        inferredPeerType
      );
      if (!allowedPeerIds.length) {
        response.success({ message: "Users fetched", result: { items: [] } }, res);
        return;
      }
      filter._id = {
        $ne: toObjectId(userId),
        $in: allowedPeerIds.map((id) => toObjectId(id)),
      };
    }

    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { fullName: { $regex: safe, $options: "i" } },
        { phone: { $regex: safe, $options: "i" } },
      ];
    }

    const items = await UserModel.find(filter)
      .select("_id fullName phone userType")
      .limit(limit)
      .lean();

    response.success(
      { message: "Users fetched", result: { items } },
      res
    );
  } catch (err: any) {
    console.error("chat.searchUsers error:", err);
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

/**
 * POST /api/v1/chat/auth/bridge  body: { phone, fullName?, countryCode?, userType? }
 * Dev convenience: find-or-create a user by phone (default userType: PATIENT)
 * and return a chat JWT. Lets a separately-hosted patient app obtain a chat
 * token without re-implementing the OTP login.
 */
const authBridge = async (req: Request, res: Response): Promise<void> => {
  try {
    const phoneRaw = (req.body?.phone || "").toString().trim();
    const phone = phoneRaw.replace(/\D/g, "").slice(-10);
    if (!phone || phone.length < 8) {
      response.error({ message: "Valid phone is required" }, res, 400);
      return;
    }
    const fullName = (req.body?.fullName || "").toString().trim() || undefined;
    const countryCode = (req.body?.countryCode || "+91").toString().trim();
    const userType = Number(req.body?.userType) || constants.USER_TYPES.PATIENT;

    let user = await UserModel.findOne({ phone, userType: userType }).exec();
    if (!user) {
      user = await UserModel.create({
        phone,
        countryCode,
        fullName: fullName ?? `User ${phone.slice(-4)}`,
        userType: [userType],
        status: 2,
        isDeleted: false,
      } as any);
    } else if (fullName && (!user.fullName || user.fullName.trim() === "")) {
      user.fullName = fullName;
      await user.save();
    }

    const token = generateAuthJwt({
      userId: user._id.toString(),
      userType,
      fullName: user.fullName ?? "",
    });

    response.success(
      {
        message: "Chat token issued",
        result: {
          token,
          userId: user._id,
          fullName: user.fullName ?? "",
          phone: user.phone ?? phone,
          userType,
        },
      },
      res
    );
  } catch (err: any) {
    console.error("chat.authBridge error:", err);
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

/**
 * POST /api/v1/chat/conversation/:conversationId/payment-order
 * Creates a Razorpay order the patient checkout will use to pay for a 7-day
 * chat extension. Patient-only.
 */
const createChatPaymentOrder = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const userType = Number(req.data?.userType ?? 0);
    const conversationId = req.params.conversationId;
    if (!userId || !isValidId(conversationId)) {
      response.error({ message: "Invalid request" }, res, 400);
      return;
    }
    if (userType !== constants.USER_TYPES.PATIENT) {
      response.error({ message: "Only patients can pay for chat extension" }, res, 403);
      return;
    }
    const convo = await ConversationModel.findOne({
      _id: toObjectId(conversationId),
      "participants.userId": toObjectId(userId),
      isDeleted: { $ne: true },
    }).lean();
    if (!convo) {
      response.error({ message: "Conversation not found" }, res, 404);
      return;
    }
    const rzp = getRazorpay();
    if (!rzp) {
      response.error({ message: "Payment gateway not configured" }, res, 503);
      return;
    }
    const doctorParticipantForOrder = (convo.participants || []).find(
      (p: any) => Number(p.userType) === constants.USER_TYPES.DOCTOR
    );
    const amountInr = await getChatExtensionAmountForDoctor(
      doctorParticipantForOrder?.userId
    );
    const amountPaise = Math.round(amountInr * 100);
    const order = await rzp.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `chat_${conversationId}_${Date.now()}`.slice(0, 40),
      notes: { conversationId, patientUserId: userId, purpose: "chat_extension_7d" },
    });
    response.success(
      {
        message: "Order created",
        result: {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          keyId: config.razorpayKeyId,
          conversationId,
        },
      },
      res
    );
  } catch (err: any) {
    console.error("chat.createChatPaymentOrder error:", err);
    response.error({ message: err?.message || "Failed to create order" }, res, 500);
  }
};

/**
 * POST /api/v1/chat/conversation/:conversationId/pay
 * Verifies the Razorpay signature returned by checkout, then extends the
 * patient chat window by 7 days from max(now, current chatExpiresAt).
 * Patient-only.
 */
const extendChatPayment = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const userType = Number(req.data?.userType ?? 0);
    const conversationId = req.params.conversationId;
    if (!userId || !isValidId(conversationId)) {
      response.error({ message: "Invalid request" }, res, 400);
      return;
    }
    if (userType !== constants.USER_TYPES.PATIENT) {
      response.error({ message: "Only patients can extend the chat window" }, res, 403);
      return;
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = (req.body || {}) as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };
    if (!config.razorpayKeySecret) {
      response.error({ message: "Payment gateway not configured" }, res, 503);
      return;
    }
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      response.error({ message: "Missing payment verification fields" }, res, 400);
      return;
    }
    const expected = crypto
      .createHmac("sha256", config.razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) {
      response.error({ message: "Invalid payment signature" }, res, 400);
      return;
    }
    const convo = await ConversationModel.findOne({
      _id: toObjectId(conversationId),
      "participants.userId": toObjectId(userId),
      isDeleted: { $ne: true },
    });
    if (!convo) {
      response.error({ message: "Conversation not found" }, res, 404);
      return;
    }
    const baseMs = convo.chatExpiresAt
      ? Math.max(Date.now(), new Date(convo.chatExpiresAt).getTime())
      : Date.now();
    convo.chatExpiresAt = new Date(baseMs + CHAT_WINDOW_MS);
    convo.preExpiryNotifiedAt = null;
    await convo.save();
    const doctorParticipant = (convo.participants || []).find(
      (p: any) => Number(p.userType) === constants.USER_TYPES.DOCTOR
    );
    const paidAmountInr = await getChatExtensionAmountForDoctor(
      doctorParticipant?.userId
    );
    try {
      await ChatPaymentModel.create({
        conversationId: convo._id,
        patientUserId: toObjectId(userId),
        doctorUserId: doctorParticipant?.userId || null,
        amount: paidAmountInr,
        currency: "INR",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        extendedTo: convo.chatExpiresAt,
        status: "success",
      });
    } catch (logErr: any) {
      // Duplicate paymentId or other history-write failure must not break the
      // user-visible extension. Just log it.
      console.error("chat.extendChatPayment history write failed:", logErr?.message || logErr);
    }
    response.success(
      {
        message: "Chat window extended",
        result: {
          chatExpiresAt: convo.chatExpiresAt,
          requiresPayment: false,
          razorpayPaymentId: razorpay_payment_id,
        },
      },
      res
    );
  } catch (err: any) {
    console.error("chat.extendChatPayment error:", err);
    response.error({ message: err?.message || "Failed to extend chat" }, res, 500);
  }
};

/**
 * GET /api/v1/chat/payments
 * Returns chat-extension payment history for the calling user.
 * Patient -> their own; Doctor -> payments on conversations where they are the doctor.
 * Optional ?conversationId=... filters to a single conversation (must include caller).
 * Pagination: ?page=1&limit=20
 */
const listChatPayments = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const userType = Number(req.data?.userType ?? 0);
    if (!userId) {
      response.error({ message: "Unauthorized" }, res, 401);
      return;
    }
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
    const filter: any = {};
    if (userType === constants.USER_TYPES.PATIENT) {
      filter.patientUserId = toObjectId(userId);
    } else if (userType === constants.USER_TYPES.DOCTOR) {
      filter.doctorUserId = toObjectId(userId);
    } else {
      response.error({ message: "Forbidden" }, res, 403);
      return;
    }
    const convoIdRaw = req.query.conversationId;
    if (typeof convoIdRaw === "string" && convoIdRaw) {
      if (!isValidId(convoIdRaw)) {
        response.error({ message: "Invalid conversationId" }, res, 400);
        return;
      }
      const convo = await ConversationModel.findOne({
        _id: toObjectId(convoIdRaw),
        "participants.userId": toObjectId(userId),
        isDeleted: { $ne: true },
      })
        .select("_id")
        .lean();
      if (!convo) {
        response.error({ message: "Conversation not found" }, res, 404);
        return;
      }
      filter.conversationId = convo._id;
    }
    const [items, total] = await Promise.all([
      ChatPaymentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ChatPaymentModel.countDocuments(filter),
    ]);
    response.success(
      {
        message: "Chat payment history",
        result: {
          items: items.map((p: any) => ({
            _id: p._id,
            conversationId: p.conversationId,
            amount: p.amount,
            currency: p.currency,
            razorpayOrderId: p.razorpayOrderId,
            razorpayPaymentId: p.razorpayPaymentId,
            extendedTo: p.extendedTo,
            status: p.status,
            createdAt: p.createdAt,
          })),
          total,
          page,
          limit,
        },
      },
      res
    );
  } catch (err: any) {
    console.error("chat.listChatPayments error:", err);
    response.error({ message: err?.message || "Failed to load payments" }, res, 500);
  }
};

export default {
  startConversation,
  listConversations,
  listMessages,
  sendMessage,
  markConversationRead,
  unreadCount,
  searchUsers,
  authBridge,
  createChatPaymentOrder,
  extendChatPayment,
  listChatPayments,
};
