// src/jobs/chatExpiryNotifier.ts
//
// Scheduled job: once an hour, scan active conversations whose free
// 7-day patient chat window is about to expire in the next ~24h and
// insert a Notification for the patient participant. We record
// `preExpiryNotifiedAt` on the conversation to avoid duplicate dispatch;
// the flag is cleared whenever the window is extended via payment.

import ConversationModel from "../models/Conversation";
import NotificationModel from "../models/Notification";
import UserModel from "../models/User";
import constants from "../utils/constant";

const HOUR_MS = 60 * 60 * 1000;
const LOOKAHEAD_MS = 24 * HOUR_MS; // fire when expiry is within the next 24h

let started = false;
let timer: NodeJS.Timeout | null = null;

async function runOnce(): Promise<void> {
  const now = new Date();
  const threshold = new Date(now.getTime() + LOOKAHEAD_MS);

  // Not-yet-expired conversations whose window ends within the next 24h,
  // and which have not been notified yet (preExpiryNotifiedAt null).
  const due = await ConversationModel.find({
    isDeleted: { $ne: true },
    chatExpiresAt: { $gt: now, $lte: threshold },
    $or: [{ preExpiryNotifiedAt: null }, { preExpiryNotifiedAt: { $exists: false } }],
  })
    .select("_id participants chatExpiresAt")
    .lean();

  if (!due.length) return;

  for (const convo of due) {
    try {
      const participants = Array.isArray(convo.participants) ? convo.participants : [];
      const patient = participants.find(
        (p: any) => Number(p.userType) === constants.USER_TYPES.PATIENT
      );
      const doctor = participants.find(
        (p: any) => Number(p.userType) === constants.USER_TYPES.DOCTOR
      );
      if (!patient?.userId) continue;

      let doctorName = "your doctor";
      if (doctor?.userId) {
        const u = await UserModel.findOne({ _id: doctor.userId })
          .select("fullName")
          .lean();
        if (u?.fullName) doctorName = u.fullName;
      }

      const expiresAt = convo.chatExpiresAt ? new Date(convo.chatExpiresAt) : null;
      const body = expiresAt
        ? `Your free chat window with ${doctorName} ends on ${expiresAt.toDateString()}. Extend to keep chatting.`
        : `Your free chat window with ${doctorName} is ending soon. Extend to keep chatting.`;

      await NotificationModel.create({
        receiverId: [patient.userId],
        senderId: doctor?.userId ? [doctor.userId] : [],
        title: "Chat window ending soon",
        body,
        userType: constants.USER_TYPES.PATIENT,
        eventType: constants.NOTIFICATION_TYPE.CHAT_WINDOW_EXPIRING_SOON,
        eventId: convo._id,
      });

      await ConversationModel.updateOne(
        { _id: convo._id },
        { $set: { preExpiryNotifiedAt: new Date() } }
      );
    } catch (err: any) {
      console.error(
        "chatExpiryNotifier: failed for conversation",
        convo?._id?.toString?.(),
        err?.message || err
      );
    }
  }
}

export function startChatExpiryNotifier(intervalMs: number = HOUR_MS): void {
  if (started) return;
  started = true;
  // First run shortly after boot, then on a fixed cadence.
  setTimeout(() => {
    runOnce().catch((e) =>
      console.error("chatExpiryNotifier initial run failed:", e?.message || e)
    );
  }, 30 * 1000);
  timer = setInterval(() => {
    runOnce().catch((e) =>
      console.error("chatExpiryNotifier tick failed:", e?.message || e)
    );
  }, intervalMs);
  // Don't let the timer keep the event loop alive if the server is shutting down.
  if (timer && typeof timer.unref === "function") timer.unref();
  console.log(
    `[chatExpiryNotifier] started; scanning every ${Math.round(intervalMs / 60000)} min`
  );
}

export default startChatExpiryNotifier;
