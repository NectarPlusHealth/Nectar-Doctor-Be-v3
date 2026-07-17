/**
 * Twilio Video — Access Token minting for the DOCTOR backend.
 *
 * The Patient Backend mints tokens with identity `patient-<userId>`; this file
 * mints tokens with identity `doctor-<userId>` so both participants land in
 * the SAME Twilio room (name derived from the appointment id).
 *
 * Docs: https://www.twilio.com/docs/video/tutorials/user-identity-access-tokens
 */
import twilio from "twilio";

const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

const ROOM_PREFIX = process.env.TWILIO_ROOM_PREFIX || "nectar-consult";
const TOKEN_TTL_SEC = (() => {
  const n = Number(process.env.TWILIO_TOKEN_TTL_SEC);
  return Number.isFinite(n) && n > 0 ? n : 60 * 60 * 2; // 2h default
})();

/**
 * Derive a deterministic room name from an appointment id. Must match the
 * patient backend exactly.
 */
export const buildRoomName = (appointmentId: string): string =>
  `${ROOM_PREFIX}-${appointmentId}`;

/**
 * Build a Twilio AccessToken JWT with a VideoGrant.
 *
 * @param opts.roomName - Twilio Video room name.
 * @param opts.identity - Stable participant identifier.
 * @param opts.ttlSec - Override token lifetime (seconds).
 * @returns Signed JWT string
 */
export const generateTwilioVideoToken = ({
  roomName,
  identity,
  ttlSec,
}: {
  roomName: string;
  identity: string;
  ttlSec?: number;
}): string => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  const apiKey = process.env.TWILIO_API_KEY || "";
  const apiSecret = process.env.TWILIO_API_SECRET || "";

  if (!accountSid || !apiKey || !apiSecret) {
    throw new Error(
      "Twilio Video is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET."
    );
  }
  if (!roomName || !identity) {
    throw new Error("roomName and identity are required.");
  }

  const ttl = Number(ttlSec) > 0 ? Number(ttlSec) : TOKEN_TTL_SEC;

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity,
    ttl,
  });
  token.addGrant(new VideoGrant({ room: roomName }));
  return token.toJwt();
};
