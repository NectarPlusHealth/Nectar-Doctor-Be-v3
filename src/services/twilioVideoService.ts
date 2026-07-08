// src/services/twilioVideoService.ts
/**
 * Twilio Video — Access Token minting for in-app video consultations.
 *
 * A single Twilio "Video Room" is identified by its `roomName`. Both doctor
 * and patient obtain their own Access Token (JWT) that carries a VideoGrant
 * bound to the SAME room name; they simply connect and appear in each
 * other's participants list.
 *
 * Rooms are auto-created on first connect (Twilio default room type = Group).
 *
 * Docs: https://www.twilio.com/docs/video/tutorials/user-identity-access-tokens
 */
import twilio from "twilio";
import { config } from "../config/environment";

const { AccessToken } = twilio.jwt;
const VideoGrant = AccessToken.VideoGrant;

export interface TwilioTokenInput {
  /** Unique room identifier — must be identical for all participants. */
  roomName: string;
  /**
   * Stable participant identifier shown in the participants list.
   * e.g. `doctor-<userId>` or `patient-<userId>`.
   */
  identity: string;
  /** Optional TTL override in seconds. Defaults to config.twilio.tokenTtlSec. */
  ttlSec?: number;
}

/**
 * Derive a deterministic room name from an appointment id, so both the
 * doctor backend and patient backend generate the same room without needing
 * to store anything extra on the appointment document.
 */
export function buildRoomName(appointmentId: string): string {
  const prefix = config.twilio.roomPrefix || "nectar-consult";
  return `${prefix}-${appointmentId}`;
}

/**
 * Build a Twilio AccessToken JWT with a VideoGrant.
 * Throws if Twilio isn't configured — callers should fall back to another
 * provider (e.g. Google Meet) or surface the misconfiguration.
 */
export function generateTwilioVideoToken(input: TwilioTokenInput): string {
  const { accountSid, apiKeySid, apiKeySecret, tokenTtlSec } = config.twilio;
  if (!accountSid || !apiKeySid || !apiKeySecret) {
    throw new Error(
      "Twilio Video is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET."
    );
  }
  if (!input.roomName || !input.identity) {
    throw new Error("roomName and identity are required.");
  }

  const ttl = Number(input.ttlSec) > 0 ? Number(input.ttlSec) : tokenTtlSec;

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity: input.identity,
    ttl,
  });
  token.addGrant(new VideoGrant({ room: input.roomName }));
  return token.toJwt();
}

export default {
  buildRoomName,
  generateTwilioVideoToken,
};
