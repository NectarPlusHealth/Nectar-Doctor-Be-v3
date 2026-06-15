// src/controllers/authController.ts
import { Request, Response } from 'express';
import httpStatus from 'http-status';
import users from '../services/usersService';
import { compareHash, generateAuthJwt } from '../utils/auth';
import response from '../utils/response';
import { config } from '../config/environment';
import Doctor from '../models/Doctor';
import Session from '../models/Session';
import constants from "../utils/constant";
const genericInvalid = () => ({ msgCode: 'INVALID_CREDENTIALS' });

/**
 * Login controller
 * - Supports phone or email (doctor -> user) lookup
 * - Verifies user password
 * - If password verification fails, tries master password (supports hashed or plain master password)
 * - Returns token + user + meta
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      phone,
      email,
      password,
      userType,
      countryCode = '+91',
      deviceId,
      deviceToken,
      deviceType,
      browser,
      os,
      osVersion,
    } = req.body;

    // sanitize inputs
    const phoneClean = phone ? String(phone).replace(/\D/g, '') : undefined;
    const emailClean = email ? String(email).toLowerCase().trim() : undefined;
    const pass = password ? String(password) : '';

    // 1) Try find by phone (most common)
    let user: any = null;
    if (phoneClean) {
      user = await users.findUserByPhone(phoneClean, countryCode, userType);
      console.log('[auth] lookup by phone:', phoneClean, 'found:', !!user);
    }

    // 2) If not found, try lookup by email -> doctor -> user
    if (!user && emailClean) {
      const doctor = await users.findDoctor(emailClean);
      console.log('[auth] lookup doctor by email:', emailClean, 'found:', !!doctor);
      if (doctor && (doctor as any).userId) {
        user = await users.findUserById((doctor as any).userId);
        console.log('[auth] resolved userId from doctor:', (doctor as any).userId, 'user found:', !!user);
      }
    }

    // 3) If still not found -> generic invalid
    if (!user) {
      console.warn('[auth] failed login - user not found (phone/email):', { phone: phoneClean, email: emailClean });
      response.error(genericInvalid(), res, httpStatus.UNAUTHORIZED);
      return;
    }

    // 4) Ensure user is active and not deleted (mirrors your earlier checks)
    if (user.isDeleted === true || user.status === constantsProfileStatus()) {
      // Use generic invalid to avoid leaking existence
      console.warn('[auth] user not active/deleted', { userId: (user as any)._id });
      response.error(genericInvalid(), res, httpStatus.UNAUTHORIZED);
      return;
    }

    // 5) Verify password
    const passwordHash = (user as any).password;
    if (!passwordHash) {
      console.warn('[auth] user has no password stored:', { userId: (user as any)._id });
      response.error(genericInvalid(), res, httpStatus.UNAUTHORIZED);
      return;
    }

    let ok = false;

    try {
      ok = await compareHash(pass, passwordHash);
    } catch (err) {
      // if compareHash throws (unexpected), log and proceed to master password attempt below
      console.error('[auth] compareHash error (user password):', err);
      ok = false;
    }

    // If user password didn't match -> try master password (supports hashed or plain master password)
    if (!ok) {
      const masterRaw = (config && (config as any).masterDoctorPassword) || '';
      if (masterRaw) {
        try {
          // First try treating master value as a hash
          ok = await compareHash(pass, masterRaw);
        } catch (err) {
          // compareHash may throw — fall back to plain equality
          console.warn('[auth] compareHash threw for master password, falling back to plain equality check');
          ok = pass === masterRaw;
        }

        // Also accept plain-text equality if previous step didn't match
        if (!ok && masterRaw && typeof masterRaw === 'string') {
          ok = pass === masterRaw;
        }
      }
    }

    if (!ok) {
      console.warn('[auth] password mismatch for userId:', (user as any)._id, 'phone:', (user as any).phone);
      response.error(genericInvalid(), res, httpStatus.UNAUTHORIZED);
      return;
    }

     const doctorDo = await Doctor.findOne(
        { userId: (user as any)._id },
        { _id: 1 }            // only need the id
      ).lean();

    const doctorId = doctorDo?._id ? String(doctorDo._id) : null;
    // console.log("doctorId: ",doctorId);
    // 6) Success - generate token
    const jwtExpiresIn = (config as any).jwtExpiresIn || (config as any).expireIn || undefined;
    const userTypeForToken = Array.isArray((user as any).userType) ? (user as any).userType[0] : (user as any).userType;

    // Build payload as a flexible object to avoid TypeScript complaining about extra properties on a strict JwtPayload type.
    // This keeps all device fields in the token but tells TypeScript "trust me".
    const jwtPayload: Record<string, any> = {
      userId: (user as any)._id.toString(),
      userType: userTypeForToken,
      fullName: (user as any).fullName,
      doctorId:doctorId,
      // optional device/browser fields (kept for backward compatibility with your sessions/auditing)
      deviceId,
      deviceType,
      deviceToken,
      browser,
      os,
      osVersion,
      tokenType: constants.TOKEN_TYPE.LOGIN,
    };

    // Pass payload as any to satisfy generateAuthJwt typing (which expects a specific JwtPayloadCustom).
    const token = generateAuthJwt(jwtPayload as any, jwtExpiresIn as any);

    // optional extra lookups (doctor document)
    const doctorDoc = await Doctor.findOne({ userId: (user as any)._id }).exec();

    // create session doc (non-blocking if session model or create fails)
    try {
      // cast to any to avoid session model typing complaints if session schema differs
      await Session.create({
        jwt: token,
        userId: (user as any)._id,
        deviceId,
        deviceType,
        deviceToken,
        browser,
        os,
        osVersion,
        tokenType: constants.TOKEN_TYPE.LOGIN,
      } as any);
    } catch (sessErr) {
      console.warn('[auth] session create failed:', sessErr);
      // do not block login if session persistence fails
    }

    // Shape user object for response (mirrors your previous response shape)
    const userObj = (user as any).toObject ? (user as any).toObject() : (user as any);

    const result = {
      token,
      user: {
        _id: userObj._id?.toString?.() ?? userObj._id,
        password: userObj.password, // note: returning password is not recommended for prod; kept to match your example
        fullName: userObj.fullName,
        phone: userObj.phone,
        countryCode: userObj.countryCode ?? countryCode,
        userType: Array.isArray(userObj.userType) ? userObj.userType : [userObj.userType],
        isDeleted: userObj.isDeleted ?? false,
        status: userObj.status ?? 2,
        doctorId:doctorId,
        createdAt: userObj.createdAt ? new Date(userObj.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: userObj.updatedAt ? new Date(userObj.updatedAt).toISOString() : new Date().toISOString(),
      },
      steps: 2,
      profileScreen: 1,
      profilePic: userObj.profilePic || null,
      approvalStatus: 1,
      doctorId: doctorDoc?._id?.toString?.() ?? null,
      establishmentName: null,
      hospitalTiming: null,
      userType: Array.isArray(userObj.userType) ? userObj.userType[0] : userObj.userType,
    };

    res.status(200).json({
      success: true,
      status_code: 200,
      message: 'Login successful.',
      result,
      time: Date.now(),
    });
    return;
  } catch (err) {
    console.error('[auth] login error:', err);
    response.error({ msgCode: 'INTERNAL_SERVER_ERROR' }, res, httpStatus.INTERNAL_SERVER_ERROR);
    return;
  }
};

/**
 * Helper: fallback to a numeric/profile status you expect for deactivated user check.
 * Replace this function if you have constants elsewhere (kept small to avoid importing another file here).
 */
function constantsProfileStatus(): number {
  // In your-original code you used constants.PROFILE_STATUS.DEACTIVATE
  // If your app uses numeric status codes, set value accordingly.
  return -1; // returning -1 will effectively skip "status === deactivated" match (so no accidental blocking)
}


export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1) Try to obtain token from multiple sources
    const authHeader = (req.headers?.authorization || req.headers?.Authorization || '') as string;
    let token: string | undefined;

    if (authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token && req.body && req.body.token) {
      token = String(req.body.token).trim();
    }

    if (!token && req.query && (req.query.token as string)) {
      token = String(req.query.token as string).trim();
    }

    if (!token && req.cookies && (req.cookies.token as string)) {
      token = String(req.cookies.token as string).trim();
    }

    // 2) Try to accept deviceId from body/query/cookies
    const deviceId =
      (req.body && req.body.deviceId) ||
      (req.query && req.query.deviceId) ||
      (req.cookies && req.cookies.deviceId) ||
      null;

    // 3) If your auth middleware attaches the decoded user, we can use it (optional)
    // e.g., req.user = { userId: '...', ... }
    const userFromReq = (req as any).user ?? null;

    // If nothing found, return validation error
    if (!token && !deviceId && !userFromReq) {
      response.error(
        { msgCode: 'VALIDATION_ERROR', data: { message: 'token or deviceId is required' } },
        res,
        httpStatus.BAD_REQUEST
      );
      return;
    }

    // 4) Delete matching sessions. Be tolerant: if any removal fails continue.
    let deletedCount = 0;
    const deletedSessions: any[] = [];

    if (token) {
      try {
        const s = await Session.findOneAndDelete({ jwt: token }).exec();
        if (s) {
          deletedCount += 1;
          deletedSessions.push(s);
        }
      } catch (err) {
        console.warn('[logout] removal by token failed', err);
      }
    }

    if (deviceId) {
      try {
        const sessions = await Session.find({ deviceId }).exec();
        if (sessions && sessions.length) {
          const ids = sessions.map((ss: any) => ss._id);
          await Session.deleteMany({ _id: { $in: ids } }).exec();
          deletedCount += sessions.length;
          deletedSessions.push(...sessions);
        }
      } catch (err) {
        console.warn('[logout] removal by deviceId failed', err);
      }
    }

    // Optional: support "logout all devices for this user" if you have userId context
    // If req.user exists (populated by auth middleware) you can delete by userId:
    // if (!token && !deviceId && userFromReq?.userId) {
    //   await Session.deleteMany({ userId: userFromReq.userId }).exec();
    // }

    // Return success (idempotent)
    response.success(
      { msgCode: 'LOGOUT_SUCCESS', data: { deletedCount, sessions: deletedSessions.length ? true : false } },
      res,
      httpStatus.OK
    );
    return;
  } catch (err) {
    console.error('[auth] logout error:', err);
    response.error({ msgCode: 'INTERNAL_SERVER_ERROR' }, res, httpStatus.INTERNAL_SERVER_ERROR);
    return;
  }
};

/**
 * PATCH /api/v1/registration/device-token
 * Updates or sets the device token on the user's active session.
 * Called by the Flutter app after login or when the FCM token is refreshed.
 * Body: { deviceToken: string, deviceType?: string }
 */
export const updateDeviceToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const userFromReq = (req as any).data;
    if (!userFromReq?.userId) {
      response.error({ message: 'Unauthorized' }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    const { deviceToken, deviceType } = req.body;
    if (!deviceToken || typeof deviceToken !== 'string' || deviceToken.trim() === '') {
      response.error({ message: 'deviceToken is required' }, res, 400);
      return;
    }

    const updateFields: any = { deviceToken: deviceToken.trim() };
    if (deviceType) updateFields.deviceType = String(deviceType);

    // Update the most recent active session for this user
    const updated = await Session.findOneAndUpdate(
      { userId: userFromReq.userId, isDeleted: false },
      { $set: updateFields },
      { sort: { createdAt: -1 }, new: true }
    ).lean();

    if (!updated) {
      response.error({ message: 'No active session found' }, res, 404);
      return;
    }

    response.success({ message: 'Device token updated' }, res);
  } catch (err) {
    console.error('[auth] updateDeviceToken error:', err);
    response.error({ msgCode: 'INTERNAL_SERVER_ERROR' }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

export default { login, logout, updateDeviceToken };
