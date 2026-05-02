// src/controllers/loginOtpController.ts
//
// Passwordless login OTP endpoints.
//   POST /api/v1/loginOtp/send    -> generate + persist OTP for an existing user
//   POST /api/v1/loginOtp/verify  -> verify OTP and issue session JWT
//
// Designed to play nicely with the existing OTP collection / sendSms / Session
// pipeline used by registrationController.
import { Request, Response } from 'express';
import { Types } from 'mongoose';

import { IOTP, OTP } from '../models/OTP';
import { User } from '../models/User';
import { Session } from '../models/Session';
import * as common from '../utils/common';
import { generateAuthJwt, generateHash, compareHash } from '../utils/auth';
import response from '../utils/response';
import httpStatus from '../utils/httpStatus';
import constants from '../utils/constant';
import { config } from '../config/environment';
import sendSms from '../utils/sendSms';
import { users } from '../services/usersService';

const isProd = process.env.NODE_ENV === 'production';

/** Generate an n-digit numeric OTP. */
const genOtp = (len: number): string => {
  let out = '';
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
};

/** Look up a user by phone (preferred) or email, scoped to userType. */
const findLoginUser = async (
  phoneClean: string | null,
  email: string | null,
  countryCode: string,
  userType: number
): Promise<any | null> => {
  if (phoneClean) {
    const u = await users.findUser(phoneClean, countryCode, userType);
    if (u) return u;
    // fallback: same phone but different country code stored for the user
    const byPhone = await User.findOne({ phone: phoneClean, userType }).exec();
    if (byPhone) return byPhone;
  }
  if (email) {
    return User.findOne({ email: email.toLowerCase(), userType }).exec();
  }
  return null;
};

/** POST /api/v1/loginOtp/send */
export const sendLoginOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      phone,
      email,
      countryCode = '+91',
      userType = constants.USER_TYPES.DOCTOR,
    } = req.body || {};

    const phoneClean = phone ? String(phone).replace(/[-\s]/g, '') : '';
    const emailClean = email ? String(email).trim().toLowerCase() : '';

    if (!phoneClean && !emailClean) {
      response.error({ msgCode: 'INVALID_INPUT' }, res, httpStatus.BAD_REQUEST);
      return;
    }

    const user = await findLoginUser(phoneClean || null, emailClean || null, countryCode, Number(userType));
    if (!user) {
      response.error({ msgCode: 'USER_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    // Frontend expects a 6-digit OTP.
    const OTP_LEN = 6;
    const otp = isProd ? genOtp(OTP_LEN) : (config.defaultOtp || '').padEnd(OTP_LEN, '0').slice(0, OTP_LEN) || '123456';
    const hashOtp = await generateHash(String(otp));

    // Resolve the canonical phone for storage (use user record so verify can match).
    const storedPhone = (user as any).phone || phoneClean;
    // OTP schema expects a single Number; user.userType may be an array (e.g. [2,3]).
    const rawUserType = (user as any).userType ?? userType;
    const storedUserType = Number(
      Array.isArray(rawUserType)
        ? (rawUserType.includes(Number(userType)) ? Number(userType) : rawUserType[0])
        : rawUserType
    );

    // Upsert OTP record (one per phone+userType).
    await OTP.findOneAndUpdate(
      { phone: storedPhone, userType: storedUserType },
      {
        $set: {
          otp: hashOtp,
          phone: storedPhone,
          userType: storedUserType,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    if (isProd) {
      const sent = await sendSms.sendOtp(
        storedPhone,
        (user as any).countryCode || countryCode,
        { OTP: otp },
        constants.SMS_TEMPLATES.OTP
      );
      if (!sent) {
        response.error({ msgCode: 'OTP_NOT_SENT', data: {} }, res, httpStatus.FORBIDDEN);
        return;
      }
    } else {
      // Dev-only convenience.
      console.log(`[loginOtp] OTP for ${storedPhone} (userType=${storedUserType}): ${otp}`);
    }

    response.success(
      {
        msgCode: 'OTP_SENT',
        result: {
          reference: (user as any)._id?.toString?.() ?? String((user as any)._id),
          userId: (user as any)._id?.toString?.() ?? String((user as any)._id),
          phone: storedPhone,
          userType: storedUserType,
          ...(isProd ? {} : { devOtp: otp }),
        },
      },
      res,
      httpStatus.OK
    );
  } catch (err) {
    console.error('[sendLoginOtp] error:', err);
    response.error({ msgCode: 'INTERNAL_SERVER_ERROR' }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

/** POST /api/v1/loginOtp/verify */
export const verifyLoginOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      phone,
      email,
      otp,
      countryCode = '+91',
      userType = constants.USER_TYPES.DOCTOR,
      deviceId = null,
      deviceType = null,
      deviceToken = null,
      browser = null,
      os = null,
      osVersion = null,
    } = req.body || {};

    if (!otp) {
      response.error({ msgCode: 'INVALID_OTP' }, res, httpStatus.BAD_REQUEST);
      return;
    }

    const phoneClean = phone ? String(phone).replace(/[-\s]/g, '') : '';
    const emailClean = email ? String(email).trim().toLowerCase() : '';

    const user = await findLoginUser(phoneClean || null, emailClean || null, countryCode, Number(userType));
    if (!user) {
      response.error({ msgCode: 'USER_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    const storedPhone = (user as any).phone || phoneClean;
    const rawUserType = (user as any).userType ?? userType;
    const storedUserType = Number(
      Array.isArray(rawUserType)
        ? (rawUserType.includes(Number(userType)) ? Number(userType) : rawUserType[0])
        : rawUserType
    );

    const otpDoc = await common.findOne(OTP, { phone: storedPhone, userType: storedUserType });
    if (!otpDoc) {
      response.error({ msgCode: 'INVALID_OTP' }, res, httpStatus.FORBIDDEN);
      return;
    }

    const ok = await compareHash(String(otp), (otpDoc as any).otp);
    if (!ok) {
      response.error({ msgCode: 'INVALID_OTP' }, res, httpStatus.FORBIDDEN);
      return;
    }

    if ((otpDoc as any).expiresAt && new Date((otpDoc as any).expiresAt).getTime() < Date.now()) {
      response.error({ msgCode: 'EXPIRED_OTP' }, res, httpStatus.FORBIDDEN);
      return;
    }

    const fullName = (user as any).fullName || (user as any).name || '';

    const tokenPayload: any = {
      userId: (user as any)._id?.toString?.() ?? String((user as any)._id),
      userType: storedUserType,
      deviceId,
      deviceType,
      deviceToken,
      browser,
      os,
      osVersion,
      tokenType: constants.TOKEN_TYPE.LOGIN,
      fullName,
    };
    const token = generateAuthJwt(tokenPayload, config.jwtExpiresIn as any);

    // Persist a session if available.
    try {
      if (typeof Session !== 'undefined') {
        await common.create(Session, {
          jwt: token,
          userId: (user as any)._id,
          deviceId,
          deviceType,
          deviceToken,
          browser,
          os,
          osVersion,
          tokenType: constants.TOKEN_TYPE.LOGIN,
        });
      }
    } catch (sErr) {
      console.warn('[verifyLoginOtp] session create failed:', (sErr as any)?.message || sErr);
    }

    // Burn the OTP.
    try {
      await OTP.findByIdAndDelete((otpDoc as any)._id).exec();
    } catch { /* ignore */ }

    const userObj = (user as any).toObject ? (user as any).toObject() : (user as any);
    delete userObj.password;

    response.success(
      {
        msgCode: 'OTP_VERIFIED',
        result: {
          token,
          user: userObj,
          userType: storedUserType,
        },
      },
      res,
      httpStatus.OK
    );
  } catch (err) {
    console.error('[verifyLoginOtp] error:', err);
    response.error({ msgCode: 'INTERNAL_SERVER_ERROR' }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

export default { sendLoginOtp, verifyLoginOtp };
