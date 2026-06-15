// src/services/fcmService.ts
import admin from '../config/firebase';
import { isFirebaseInitialized } from '../config/firebase';
import { Types } from 'mongoose';
import Session from '../models/Session';

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface SendResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

/**
 * Send a push notification to a single device token.
 */
export async function sendToDevice(
  token: string,
  payload: FcmPayload
): Promise<boolean> {
  if (!isFirebaseInitialized()) {
    console.warn('[FCM] Firebase not initialized — skipping push notification');
    return false;
  }
  try {
    await admin.messaging().send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      data: payload.data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'nectar_push_channel',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            ...(payload.imageUrl ? { mutableContent: true } : {}),
          },
        },
        ...(payload.imageUrl ? { fcmOptions: { imageUrl: payload.imageUrl } } : {}),
      },
    });
    return true;
  } catch (err: any) {
    console.error('[FCM] sendToDevice error:', err?.message);
    // Remove invalid/unregistered tokens from session
    if (
      err?.errorInfo?.code === 'messaging/invalid-registration-token' ||
      err?.errorInfo?.code === 'messaging/registration-token-not-registered'
    ) {
      await _removeInvalidToken(token);
    }
    return false;
  }
}

/**
 * Send to multiple device tokens using FCM multicast.
 */
export async function sendToMultipleDevices(
  tokens: string[],
  payload: FcmPayload
): Promise<SendResult> {
  if (!isFirebaseInitialized()) {
    console.warn('[FCM] Firebase not initialized — skipping push notification');
    return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
  }
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const invalidTokens: string[] = [];

  // FCM multicast supports up to 500 tokens per request
  const chunks = _chunkArray(tokens, 500);
  let successCount = 0;
  let failureCount = 0;

  for (const chunk of chunks) {
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'nectar_push_channel',
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              ...(payload.imageUrl ? { mutableContent: true } : {}),
            },
          },
          ...(payload.imageUrl ? { fcmOptions: { imageUrl: payload.imageUrl } } : {}),
        },
      });

      successCount += response.successCount;
      failureCount += response.failureCount;

      // Log first failure error code to diagnose issues
      const firstFailure = response.responses.find((r) => !r.success);
      if (firstFailure) {
        console.error('[FCM] First failure error code:', firstFailure.error?.code, firstFailure.error?.message);
      }

      // Collect invalid tokens for cleanup
      response.responses.forEach((res, idx) => {
        if (
          !res.success &&
          (res.error?.code === 'messaging/invalid-registration-token' ||
            res.error?.code === 'messaging/registration-token-not-registered')
        ) {
          invalidTokens.push(chunk[idx]);
        }
      });
    } catch (err: any) {
      console.error('[FCM] sendToMultipleDevices chunk error:', err?.message);
      failureCount += chunk.length;
    }
  }

  // Clean up invalid tokens from DB
  if (invalidTokens.length > 0) {
    await _removeInvalidTokens(invalidTokens);
  }

  console.log(`[FCM] Multicast result — success: ${successCount}, failure: ${failureCount}`);
  return { successCount, failureCount, invalidTokens };
}

/**
 * Query device tokens for specified users (or all users) from Session model,
 * then send a push notification to each.
 *
 * @param userIds - Optional array of userId strings. If empty, sends to ALL users.
 * @param userType - Optional user type filter (e.g., 1=PATIENT, 2=DOCTOR).
 * @param payload - Notification title/body/data.
 */
export async function sendByUserQuery(
  payload: FcmPayload,
  options: {
    userIds?: string[];
    userType?: number;
    deviceType?: string;
  } = {}
): Promise<SendResult> {
  if (!isFirebaseInitialized()) {
    console.warn('[FCM] Firebase not initialized — skipping push notification');
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const query: any = {
    isDeleted: false,
    deviceToken: { $exists: true, $ne: '' },
  };

  if (options.userIds && options.userIds.length > 0) {
    // Cast string IDs to ObjectId so Mongoose query matches correctly
    query.userId = { $in: options.userIds.map((id) => new Types.ObjectId(id)) };
  }
  if (options.deviceType) {
    query.deviceType = options.deviceType;
  }

  const sessions = await Session.find(query).select('deviceToken').lean();
  const tokens = sessions
    .map((s: any) => s.deviceToken as string)
    .filter(Boolean);

  if (tokens.length === 0) {
    console.log('[FCM] No device tokens found for query:', options);
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  console.log(`[FCM] Sending to ${tokens.length} device(s)`);
  return sendToMultipleDevices(tokens, payload);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function _removeInvalidToken(token: string): Promise<void> {
  try {
    await Session.updateMany(
      { deviceToken: token },
      { $unset: { deviceToken: '' } }
    );
  } catch (err) {
    console.error('[FCM] Failed to remove invalid token from DB:', err);
  }
}

async function _removeInvalidTokens(tokens: string[]): Promise<void> {
  try {
    await Session.updateMany(
      { deviceToken: { $in: tokens } },
      { $unset: { deviceToken: '' } }
    );
    console.log(`[FCM] Removed ${tokens.length} invalid token(s) from DB`);
  } catch (err) {
    console.error('[FCM] Failed to remove invalid tokens from DB:', err);
  }
}

function _chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
