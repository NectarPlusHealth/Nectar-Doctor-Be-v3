// src/services/googleMeetService.ts
import { google, calendar_v3 } from "googleapis";
import { OAuth2Client, Credentials } from "google-auth-library";
import { config } from "../config/environment";
import DoctorGoogleAccountModel from "../models/DoctorGoogleAccount";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
];

function getOAuthClient(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = config.google;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET."
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Build the Google consent URL the doctor will be redirected to. */
export function buildAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token even on re-auth
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

/** Exchange `code` for tokens and resolve the connected Google email. */
export async function exchangeCodeForTokens(code: string): Promise<{
  tokens: Credentials;
  email: string | null;
}> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let email: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    email = me.data?.email ?? null;
  } catch (err: any) {
    console.warn("googleMeet.userinfo failed:", err?.message || err);
  }
  return { tokens, email };
}

/**
 * Returns an authenticated OAuth2 client for the given doctor.
 * Auto-refreshes the access token using the stored refresh_token if needed.
 */
async function getClientForDoctor(userId: string): Promise<OAuth2Client> {
  const account = await DoctorGoogleAccountModel.findOne({ userId }).lean();
  if (!account || !account.refreshToken) {
    throw new Error("DOCTOR_GOOGLE_NOT_CONNECTED");
  }
  const client = getOAuthClient();
  client.setCredentials({
    refresh_token: account.refreshToken,
    access_token: account.accessToken || undefined,
    expiry_date: account.expiresAt ? new Date(account.expiresAt).getTime() : undefined,
  });

  // Persist refreshed tokens
  client.on("tokens", async (tokens) => {
    try {
      const update: Record<string, any> = {};
      if (tokens.access_token) update.accessToken = tokens.access_token;
      if (tokens.expiry_date) update.expiresAt = new Date(tokens.expiry_date);
      if (tokens.refresh_token) update.refreshToken = tokens.refresh_token;
      if (Object.keys(update).length) {
        await DoctorGoogleAccountModel.updateOne({ userId }, { $set: update });
      }
    } catch (err: any) {
      console.warn("googleMeet token refresh persist failed:", err?.message || err);
    }
  });

  return client;
}

export interface MeetCreateInput {
  doctorUserId: string;
  summary: string;
  description?: string;
  /** Appointment start (ISO). */
  startISO: string;
  /** Slot duration in minutes (defaults to 30). */
  durationMinutes?: number;
  /** Optional patient email to add as attendee. */
  patientEmail?: string | null;
  /** Stable id we can match later in calendar (placed in event id-friendly suffix). */
  appointmentId?: string;
}

export interface MeetCreateResult {
  meetingUrl: string;
  eventId: string;
}

/**
 * Creates a Google Calendar event with a Meet conference for the given appointment.
 * Returns the Meet URL + Calendar event id (for cleanup).
 */
export async function createMeetForAppointment(
  input: MeetCreateInput
): Promise<MeetCreateResult> {
  const client = await getClientForDoctor(input.doctorUserId);
  const calendar = google.calendar({ version: "v3", auth: client });

  const start = new Date(input.startISO);
  const durationMs = (input.durationMinutes ?? 30) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  const requestId = `nectar-${input.appointmentId || Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const requestBody: calendar_v3.Schema$Event = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
  if (input.patientEmail) {
    requestBody.attendees = [{ email: input.patientEmail }];
  }

  const res = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    sendUpdates: input.patientEmail ? "all" : "none",
    requestBody,
  });

  const event = res.data;
  const meetingUrl =
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    null;

  if (!meetingUrl) {
    throw new Error("MEET_LINK_NOT_RETURNED");
  }
  if (!event.id) {
    throw new Error("CALENDAR_EVENT_ID_MISSING");
  }

  return { meetingUrl, eventId: event.id };
}

export default {
  buildAuthUrl,
  exchangeCodeForTokens,
  createMeetForAppointment,
  getClientForDoctor,
};
