// src/controllers/videoConsultationController.ts
import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import jwt from "jsonwebtoken";
import https from "https";
import http from "http";
import response from "../utils/response";
import constants from "../utils/constant";
import { config } from "../config/environment";
import googleMeet from "../services/googleMeetService";
import twilioVideo, { buildRoomName } from "../services/twilioVideoService";
import DoctorGoogleAccountModel from "../models/DoctorGoogleAccount";
import AppointmentModel from "../models/Appointment";
import DoctorModel from "../models/Doctor";
import PatientModel from "../models/Patient";

interface CustomRequest extends Request {
  data?: { userId?: string; userType?: number; fullName?: string };
}

const isValidId = (v?: string) => !!v && /^[a-fA-F0-9]{24}$/.test(v);
const toObjectId = (v: string) => new Types.ObjectId(v);

/** Window during which a video appointment may be joined. */
const toMs = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const JOIN_EARLY_MS = toMs(process.env.VIDEO_JOIN_EARLY_MS, 10 * 60 * 1000);
const JOIN_LATE_MS  = toMs(process.env.VIDEO_JOIN_LATE_MS,  30 * 60 * 1000);

/** Build the appointment slot start time from `date` + `slot`. */
function resolveAppointmentStart(appt: any): Date | null {
  if (appt?.startTime) return new Date(appt.startTime);
  if (appt?.date) return new Date(appt.date);
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// google-meet-scheduler microservice proxy
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Delegate Meet link creation to the google-meet-scheduler service (port 5000).
 * Returns the meetingUrl on success, throws on failure.
 */
async function delegateVideoLinkToScheduler(appointmentId: string): Promise<string> {
  const baseUrl = process.env.MEET_SCHEDULER_URL || "http://localhost:5000";
  const apiKey  = process.env.MEET_SCHEDULER_INTERNAL_KEY || "";
  const url     = `${baseUrl}/api/meetings/video-link/${appointmentId}`;

  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith("https");
    const lib     = isHttps ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        headers: {
          "x-internal-key": apiKey,
          "Content-Type":   "application/json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(body);
            if (json?.result?.meetingUrl) {
              resolve(json.result.meetingUrl);
            } else {
              reject(new Error(json?.message || "google-meet-scheduler returned no meetingUrl"));
            }
          } catch {
            reject(new Error("Invalid response from google-meet-scheduler"));
          }
        });
      }
    );
    req.on("error", (err) => reject(new Error(`google-meet-scheduler unreachable: ${err.message}`)));
    req.end();
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// OAuth flow
// ──────────────────────────────────────────────────────────────────────────────

/** Doctor clicks "Connect Google" → returns Google consent URL. */
const oauthStart = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const userType = Number(req.data?.userType ?? 0);
    if (!userId) return void response.error({ message: "Unauthorized" }, res, 401);
    if (userType !== constants.USER_TYPES.DOCTOR) {
      return void response.error({ message: "Forbidden" }, res, 403);
    }
    if (!config.google.clientId || !config.google.clientSecret) {
      return void response.error(
        { message: "Google OAuth is not configured on this server." },
        res,
        503
      );
    }
    // Sign a short-lived state JWT so the callback can identify the doctor.
    const state = jwt.sign({ userId, t: "google_oauth" }, config.jwtSecret as string, {
      expiresIn: "10m",
    });
    const url = googleMeet.buildAuthUrl(state);
    response.success({ message: "Google OAuth URL", result: { url } }, res);
  } catch (err: any) {
    console.error("video.oauthStart error:", err);
    response.error({ message: err?.message || "Failed to start Google OAuth" }, res, 500);
  }
};

/** Public callback Google redirects to with `code` + `state`. */
const oauthCallback = async (req: Request, res: Response): Promise<void> => {
  const fail = (msg: string) => {
    const u = new URL(config.google.frontendReturnUrl);
    u.searchParams.set("googleConnected", "0");
    u.searchParams.set("error", msg);
    res.redirect(u.toString());
  };
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state) return fail("missing_code");

    let payload: any;
    try {
      payload = jwt.verify(state, config.jwtSecret as string);
    } catch {
      return fail("bad_state");
    }
    const userId = payload?.userId;
    if (!userId || !isValidId(userId)) return fail("bad_state");

    const { tokens, email } = await googleMeet.exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Happens if the user previously consented and Google didn't re-issue a refresh token.
      return fail("no_refresh_token");
    }

    await DoctorGoogleAccountModel.findOneAndUpdate(
      { userId: toObjectId(userId) },
      {
        $set: {
          email,
          refreshToken: tokens.refresh_token,
          accessToken: tokens.access_token || null,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          scope: tokens.scope || null,
          connectedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    const u = new URL(config.google.frontendReturnUrl);
    u.searchParams.set("googleConnected", "1");
    if (email) u.searchParams.set("email", email);
    res.redirect(u.toString());
  } catch (err: any) {
    console.error("video.oauthCallback error:", err);
    fail("server_error");
  }
};

const oauthStatus = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const userType = Number(req.data?.userType ?? 0);
    if (!userId) return void response.error({ message: "Unauthorized" }, res, 401);
    if (userType !== constants.USER_TYPES.DOCTOR) {
      return void response.error({ message: "Forbidden" }, res, 403);
    }
    const acct = await DoctorGoogleAccountModel.findOne({ userId: toObjectId(userId) })
      .select("email connectedAt")
      .lean();
    response.success(
      {
        message: "Google account status",
        result: {
          connected: !!acct,
          email: acct?.email || null,
          connectedAt: acct?.connectedAt || null,
        },
      },
      res
    );
  } catch (err: any) {
    console.error("video.oauthStatus error:", err);
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

const oauthDisconnect = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const userType = Number(req.data?.userType ?? 0);
    if (!userId) return void response.error({ message: "Unauthorized" }, res, 401);
    if (userType !== constants.USER_TYPES.DOCTOR) {
      return void response.error({ message: "Forbidden" }, res, 403);
    }
    await DoctorGoogleAccountModel.deleteOne({ userId: toObjectId(userId) });
    response.success({ message: "Google account disconnected", result: { connected: false } }, res);
  } catch (err: any) {
    console.error("video.oauthDisconnect error:", err);
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Appointment video endpoints
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /appointments/:id/video-link
 * - Doctor: lazily creates the Meet link if missing; returns it.
 * - Patient: returns the existing link only (doctor must create first).
 * - Both: enforces "video" consultation type, ownership, and join window.
 * - First successful join sets status -> in-progress (here we record startedAt, not status,
 *   to avoid colliding with existing BOOKING_STATUS numeric scheme).
 */
const getVideoLink = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const userType = Number(req.data?.userType ?? 0);
    if (!userId) return void response.error({ message: "Unauthorized" }, res, 401);

    const apptId = String(req.params.id || "");
    if (!isValidId(apptId)) {
      return void response.error({ message: "Invalid appointment id" }, res, 400);
    }

    const appt = await AppointmentModel.findById(apptId);
    if (!appt || appt.isDeleted) {
      return void response.error({ message: "Appointment not found" }, res, 404);
    }
    if (appt.consultationType !== constants.CONSULTATION_TYPES.VIDEO) {
      return void response.error(
        { message: "This is not a video consultation appointment." },
        res,
        400
      );
    }
    if (appt.status === constants.BOOKING_STATUS.CANCELLED) {
      return void response.error({ message: "This appointment was cancelled." }, res, 400);
    }

    // Resolve doctor user id (to check ownership / find OAuth account)
    const doctor = appt.doctorId
      ? await DoctorModel.findById(appt.doctorId).select("userId").lean()
      : null;
    if (!doctor?.userId) {
      return void response.error({ message: "Doctor not found for appointment" }, res, 404);
    }
    const doctorUserId = String(doctor.userId);

    // Authorisation
    const isDoctor =
      userType === constants.USER_TYPES.DOCTOR && doctorUserId === String(userId);
    let isPatient = false;
    if (userType === constants.USER_TYPES.PATIENT && appt.patientId) {
      const patient = await PatientModel.findOne({ userId: toObjectId(String(userId)) })
        .select("_id")
        .lean();
      if (patient && String(patient._id) === String(appt.patientId)) {
        isPatient = true;
      }
    }
    if (!isDoctor && !isPatient) {
      return void response.error({ message: "Forbidden" }, res, 403);
    }

    // Join window
    const start = resolveAppointmentStart(appt);
    if (!start) {
      return void response.error({ message: "Appointment has no scheduled time." }, res, 400);
    }
    const now = Date.now();
    const earliest = start.getTime() - JOIN_EARLY_MS;
    const latest = start.getTime() + JOIN_LATE_MS;
    const tooEarly = now < earliest;
    // If the meeting link already exists, never block with tooLate/tooEarly —
    // both doctor and patient can always rejoin an already-created session.
    // Doctors are also never blocked by tooLate so they can create a link
    // even for rescheduled / delayed appointments.
    const tooLate =
      now > latest &&
      !appt.videoConsultationStartedAt &&
      !appt.videoMeetingUrl &&
      !isDoctor;

    if (tooEarly && !appt.videoMeetingUrl) {
      return void response.error(
        {
          message: "The video room opens 10 minutes before the scheduled time.",
          result: {
            opensAt: new Date(earliest).toISOString(),
            scheduledAt: start.toISOString(),
          },
        },
        res,
        409
      );
    }
    if (tooLate) {
      return void response.error(
        { message: "The join window for this appointment has closed." },
        res,
        410
      );
    }

    // ── Twilio Video branch ────────────────────────────────────────────────
    // When VIDEO_PROVIDER=twilio, we mint an Access Token bound to a
    // deterministic room name (nectar-consult-<appointmentId>). Twilio auto-
    // creates the room the first time either participant connects.
    if (config.videoProvider === "twilio") {
      let token: string;
      const roomName = buildRoomName(apptId);
      const identity = `doctor-${doctorUserId}`;
      try {
        token = twilioVideo.generateTwilioVideoToken({
          roomName,
          identity,
        });
      } catch (err: any) {
        console.error("video.getVideoLink Twilio token error:", err);
        return void response.error(
          {
            message:
              err?.message || "Could not generate Twilio video token.",
          },
          res,
          500
        );
      }

      // Record provider + first-join time on the appointment so both sides
      // stay in sync and the UI can show "In progress".
      if (!appt.videoMeetingProvider || appt.videoMeetingProvider !== "twilio") {
        appt.videoMeetingProvider = "twilio";
      }
      if (!appt.videoConsultationStartedAt) {
        appt.videoConsultationStartedAt = new Date();
      }
      await appt.save();

      return void response.success(
        {
          message: "Video link",
          result: {
            appointmentId: String(appt._id),
            provider: "twilio",
            roomName,
            token,
            identity,
            role: "doctor",
            scheduledAt: start.toISOString(),
            startedAt: appt.videoConsultationStartedAt,
            endedAt: appt.videoConsultationEndedAt || null,
          },
        },
        res
      );
    }

    // ── Google Meet branch (default fallback) ──────────────────────────────
    // Create the Meet link if missing — delegate to google-meet-scheduler.
    if (!appt.videoMeetingUrl) {
      if (!isDoctor) {
        return void response.error(
          {
            message:
              "The doctor hasn't started this video consultation yet. Please wait a moment and refresh.",
          },
          res,
          409
        );
      }
      try {
        // google-meet-scheduler creates the link, saves it on the appointment,
        // and fires email + WhatsApp notifications.
        const meetingUrl = await delegateVideoLinkToScheduler(apptId);
        // Reload the appointment so we have the updated fields saved by the scheduler
        const refreshed = await AppointmentModel.findById(apptId);
        if (refreshed?.videoMeetingUrl) {
          appt.videoMeetingUrl      = refreshed.videoMeetingUrl;
          appt.videoMeetingProvider = refreshed.videoMeetingProvider || "google_meet";
          if (refreshed.videoConsultationStartedAt) {
            appt.videoConsultationStartedAt = refreshed.videoConsultationStartedAt;
          }
        } else {
          // Fallback: set directly if reload didn't catch it yet
          appt.videoMeetingUrl      = meetingUrl;
          appt.videoMeetingProvider = "google_meet";
        }
      } catch (err: any) {
        console.error("video.getVideoLink Meet create error:", err);
        return void response.error(
          { message: "Could not create the Meet link. Please try again." },
          res,
          502
        );
      }
    }

    // Mark first-join time
    if (!appt.videoConsultationStartedAt) {
      appt.videoConsultationStartedAt = new Date();
    }
    await appt.save();

    response.success(
      {
        message: "Video link",
        result: {
          appointmentId: String(appt._id),
          meetingUrl: appt.videoMeetingUrl,
          provider: appt.videoMeetingProvider,
          scheduledAt: start.toISOString(),
          startedAt: appt.videoConsultationStartedAt,
          endedAt: appt.videoConsultationEndedAt || null,
        },
      },
      res
    );
  } catch (err: any) {
    console.error("video.getVideoLink error:", err);
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

/**
 * POST /appointments/:id/end-consultation
 * Doctor only. Sets status -> COMPLETED, stamps endedAt, optionally saves notes.
 */
const endConsultation = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const userType = Number(req.data?.userType ?? 0);
    if (!userId) return void response.error({ message: "Unauthorized" }, res, 401);
    if (userType !== constants.USER_TYPES.DOCTOR) {
      return void response.error({ message: "Only doctors can end the consultation." }, res, 403);
    }

    const apptId = String(req.params.id || "");
    if (!isValidId(apptId)) {
      return void response.error({ message: "Invalid appointment id" }, res, 400);
    }

    const appt = await AppointmentModel.findById(apptId);
    if (!appt || appt.isDeleted) {
      return void response.error({ message: "Appointment not found" }, res, 404);
    }
    if (appt.consultationType !== constants.CONSULTATION_TYPES.VIDEO) {
      return void response.error(
        { message: "Not a video consultation." },
        res,
        400
      );
    }

    const doctor = appt.doctorId
      ? await DoctorModel.findById(appt.doctorId).select("userId").lean()
      : null;
    if (!doctor?.userId || String(doctor.userId) !== String(userId)) {
      return void response.error({ message: "Forbidden" }, res, 403);
    }

    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
    if (notes) appt.consultationNotes = notes.slice(0, 4000);
    appt.videoConsultationEndedAt = new Date();
    appt.status = constants.BOOKING_STATUS.COMPLETED;
    appt.modifiedBy = new mongoose.Types.ObjectId(userId);
    await appt.save();

    response.success(
      {
        message: "Consultation ended",
        result: {
          appointmentId: String(appt._id),
          status: appt.status,
          endedAt: appt.videoConsultationEndedAt,
          consultationNotes: appt.consultationNotes,
        },
      },
      res
    );
  } catch (err: any) {
    console.error("video.endConsultation error:", err);
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

export default {
  oauthStart,
  oauthCallback,
  oauthStatus,
  oauthDisconnect,
  getVideoLink,
  endConsultation,
};
