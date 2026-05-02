// src/jobs/chatExpiryDeleter.ts
//
// Scheduled job: once an hour, hard-delete any conversation whose patient
// chat window has fully expired (chatExpiresAt <= now and was not extended
// by payment). Both the conversation document and all its messages are
// removed from the database, for both the doctor and the patient side.

import ConversationModel from "../models/Conversation";
import MessageModel from "../models/Message";

const HOUR_MS = 60 * 60 * 1000;

let started = false;
let timer: NodeJS.Timeout | null = null;

async function runOnce(): Promise<void> {
  const now = new Date();

  // Conversations whose free window has already lapsed. We only consider
  // conversations that have a chatExpiresAt set; legacy rows without one
  // are left alone.
  const expired = await ConversationModel.find({
    chatExpiresAt: { $lte: now, $ne: null },
  })
    .select("_id")
    .lean();

  if (!expired.length) return;

  const ids = expired.map((c) => c._id);
  let deletedMessages = 0;
  try {
    const r = await MessageModel.deleteMany({ conversationId: { $in: ids } });
    deletedMessages = r?.deletedCount || 0;
  } catch (err: any) {
    console.error(
      "chatExpiryDeleter: message deletion failed:",
      err?.message || err
    );
  }

  let deletedConvos = 0;
  try {
    const r = await ConversationModel.deleteMany({ _id: { $in: ids } });
    deletedConvos = r?.deletedCount || 0;
  } catch (err: any) {
    console.error(
      "chatExpiryDeleter: conversation deletion failed:",
      err?.message || err
    );
  }

  if (deletedConvos || deletedMessages) {
    console.log(
      `[chatExpiryDeleter] removed ${deletedConvos} conversation(s) and ${deletedMessages} message(s)`
    );
  }
}

export function startChatExpiryDeleter(intervalMs: number = HOUR_MS): void {
  if (started) return;
  started = true;
  setTimeout(() => {
    runOnce().catch((e) =>
      console.error("chatExpiryDeleter initial run failed:", e?.message || e)
    );
  }, 45 * 1000);
  timer = setInterval(() => {
    runOnce().catch((e) =>
      console.error("chatExpiryDeleter tick failed:", e?.message || e)
    );
  }, intervalMs);
  if (timer && typeof timer.unref === "function") timer.unref();
  console.log(
    `[chatExpiryDeleter] started; scanning every ${Math.round(
      intervalMs / 60000
    )} min`
  );
}

export default startChatExpiryDeleter;
