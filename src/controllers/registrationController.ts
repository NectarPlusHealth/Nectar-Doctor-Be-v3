// src/controllers/registrationController.ts
import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { Types } from 'mongoose';
import { IUser, User } from '../models/User';
import { IDoctor, Doctor } from '../models/Doctor';
import { IOTP, OTP } from '../models/OTP';
import users from '../services/usersService';
import common from '../utils/common';
import response from '../utils/response';
import { generateHash, generateAuthJwt, compareHash } from '../utils/auth';
import sendSms from '../utils/sendSms';
import { config, environment } from '../config/environment';
import constants from '../utils/constant';

// Optional models — import if they exist in your project.
// If any of these files don't exist, TypeScript will error; in that case
// either create stub model files or remove the import lines and related logic below.
import Patient from '../models/Patient';
import Hospital from '../models/Hospital';
import EstablishmentMaster from '../models/EstablishmentMaster';
import EstablishmentTiming from '../models/EstablishmentTiming';
import Session from '../models/Session';

// small OTP helper (inlined)
const genOtp = (len: number) => {
  let s = '';
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
  return s;
};

export const createRegistration = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName,
      phone,
      specialization,
      education,
      userType,
      countryCode = '+91',
      experience,
      gender,
      city,
      state,
      email,
      password,
    } = req.body;

    const lowercaseEmail = (email || '').toLowerCase();

    // normalize phone
    const phoneClean = phone ? String(phone).replace(/[-\s]/g, '') : '';

    // check existing by phone
    const findUser = await users.findUser(phoneClean, countryCode, userType);
    if (findUser) {
      response.error({ msgCode: 'ALREADY_REGISTERED' }, res, httpStatus.FORBIDDEN);
      return;
    }

    // check existing by email in doctor collection
    const findExistingDoctor = await users.findDoctor(lowercaseEmail);
    if (findExistingDoctor) {
      response.error({ msgCode: 'ALREADY_REGISTERED_EMAIL' }, res, httpStatus.FORBIDDEN);
      return;
    }

    // hash password
    const hashedPassword = await generateHash(password);

    const profile = {
      fullName,
      phone: phoneClean,
      countryCode,
      userType,
      password: hashedPassword,
    };

    // create user (typed)
    const data = await common.create<IUser>(User, profile);

    // create doctor record (typed)
    const doctor = await common.create<IDoctor>(Doctor, {
      userId: new Types.ObjectId((data as any)._id),
      gender: gender === 'male' ? 1 : gender === 'female' ? 2 : 3,
      city,
      state,
      email: lowercaseEmail,
      experience,
      specialization,
      education,
    });

    if (!data) {
      response.error({ msgCode: 'FAILED_TO_ADD' }, res, httpStatus.FORBIDDEN);
      return;
    }

    // generate JWT
    const token = generateAuthJwt(
      {
        userId: (data as any)._id.toString(),
        userType,
        fullName,
      },
      config.jwtExpiresIn as any
    );

    // OTP generation and save
    const otp = environment ? genOtp(config.defaultOtpLength) : config.defaultOtp;
    const hashOtp = await generateHash(String(otp));
    console.log('Generated OTP (for testing purposes):', otp);
    console.log('Generated OTP (for testing purposes): environment ', environment);
    const savedOtp = await common.create<IOTP>(OTP, {
      otp: hashOtp,
      phone: phoneClean,
      userType,
    });

    if (!savedOtp) {
      response.error({ msgCode: 'FAILED_TO_CREATE_OTP' }, res, httpStatus.FORBIDDEN);
      return;
    }

    if (environment) {
      const sendResult = await sendSms.sendOtp(phoneClean, countryCode, { OTP: otp }, constants.SMS_TEMPLATES.OTP);
      if (!sendResult) {
        response.error({ msgCode: 'OTP_NOT_SENT', data: {} }, res, httpStatus.FORBIDDEN);
        return;
      }
    }

    // ---- Build response payload ----
    const userObj = (data as any).toObject ? (data as any).toObject() : (data as any);

    const resultUser = {
      password: userObj.password,
      fullName: userObj.fullName,
      phone: userObj.phone,
      countryCode: userObj.countryCode ?? '+91',
      userType: Array.isArray(userObj.userType) ? userObj.userType : [userObj.userType],
      isDeleted: typeof userObj.isDeleted === 'boolean' ? userObj.isDeleted : false,
      status: typeof userObj.status !== 'undefined' ? userObj.status : 2,
      _id: userObj._id?.toString ? userObj._id.toString() : userObj._id,
      createdAt: userObj.createdAt ? new Date(userObj.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: userObj.updatedAt ? new Date(userObj.updatedAt).toISOString() : new Date().toISOString(),
    };

    const finalResponse = {
      success: true,
      status_code: 201,
      message: "You've successfully signed up.",
      result: {
        token,
        data: resultUser,
      },
      time: Date.now(),
    };

    res.status(201).json(finalResponse);
    return;
  } catch (error) {
    console.error('[createRegistration] error:', error);
    response.error({ msgCode: 'INTERNAL_SERVER_ERROR' }, res, httpStatus.INTERNAL_SERVER_ERROR);
    return;
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      phone,
      otp,
      userType,
      countryCode = '+91',
      deviceId = null,
      deviceType = null,
      deviceToken = null,
      browser = null,
      os = null,
      osVersion = null,
    } = req.body;
    console.log("VerifyOtp1: ",req.body);

    const phoneClean = phone ? String(phone).replace(/[-\s]/g, '') : '';

    // find user and OTP
    const findUser = await users.findUser(phoneClean, countryCode, userType);
    const findUserOTP = await common.findOne(OTP, {
      phone: phoneClean,
      userType,
    });

    console.log("VerifyOtp2: ",findUserOTP);
    console.log("findUser: ",findUser);
    if (!findUser) {
      response.success({ msgCode: 'USER_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    if (!findUserOTP) {
      response.error({ msgCode: 'INVALID_OTP' }, res, httpStatus.FORBIDDEN);
      return;
    }

    // compare hashed OTP (compareHash uses bcrypt.compare(plain, hash))
    const check = await compareHash(String(otp), (findUserOTP as any).otp);
    console.log("check: ",check);

    if (!check) {
      response.error({ msgCode: 'INVALID_OTP' }, res, httpStatus.NOT_ACCEPTABLE);
      return;
    }

    if ((findUserOTP as any).expiresAt && new Date((findUserOTP as any).expiresAt).getTime() < Date.now()) {
      response.error({ msgCode: 'EXPIRED_OTP' }, res, httpStatus.NOT_ACCEPTABLE);
      return;
    }

    // resolve role-specific record (Patient / Doctor / Hospital) if models exist
    const modelMap: Record<number, any> = {
      [constants.USER_TYPES.PATIENT]: typeof Patient !== 'undefined' ? Patient : null,
      [constants.USER_TYPES.DOCTOR]: typeof Doctor !== 'undefined' ? Doctor : null,
      [constants.USER_TYPES.HOSPITAL]: typeof Hospital !== 'undefined' ? Hospital : null,
    };

    const roleModel = modelMap[userType] ?? null;
    let result: any = null;
    if (roleModel) {
      result = await common.getByCondition(roleModel, { userId: new Types.ObjectId((findUser as any)._id) });
    }

    // establishment / timings lookups (safe guards if models missing)
    let establishmentMasterData: any = null;
    let hospitalTiming: any = null;

    if (typeof EstablishmentMaster !== 'undefined' && result) {
      establishmentMasterData = await common.getByCondition(EstablishmentMaster, { hospitalId: new Types.ObjectId(result?._id) }) || null;
    }

    if (typeof EstablishmentTiming !== 'undefined' && establishmentMasterData) {
      hospitalTiming = await common.getByCondition(EstablishmentTiming, {
        establishmentId: new Types.ObjectId(establishmentMasterData._id),
        doctorId: { $exists: false },
      }) || null;
    }

    const { steps = null, isVerified = null, profileScreen = null, profilePic = null } = result || {};

    const name = establishmentMasterData?.name || null;
    (findUser as any).name = userType === constants.USER_TYPES.HOSPITAL ? name : (findUser as any).fullName;

    // token payload
    const tokenPayload: any = {
      userId: (findUser as any)._id?.toString?.() ?? (findUser as any)._id,
      userType,
      deviceId,
      deviceType,
      deviceToken,
      browser,
      os,
      osVersion,
      tokenType: constants.TOKEN_TYPE.LOGIN,
      fullName: (findUser as any).name,
    };

    const token = generateAuthJwt(tokenPayload, config.jwtExpiresIn as any);

    // create session if Session exists
    if (typeof Session !== 'undefined' && typeof common.create === 'function') {
      await common.create(Session, {
        jwt: token,
        userId: (findUser as any)._id,
        deviceId,
        deviceType,
        deviceToken,
        browser,
        os,
        osVersion,
        tokenType: constants.TOKEN_TYPE.LOGIN,
      });
    }

    // remove OTP
    if (typeof common.removeById === 'function') {
      await common.removeById(OTP, (findUserOTP as any)._id);
    } else {
      await OTP.findByIdAndDelete((findUserOTP as any)._id).exec();
    }

    (findUser as any).profilePic = profilePic;

    const responseData = {
      token,
      "user":findUser,
      steps,
      profileScreen,
      profilePic,
      approvalStatus: isVerified,
      doctorId: (result && result._id) || null,
      establishmentName: name,
      hospitalTiming,
      userType,
    };

    response.success({ msgCode: 'OTP_VERIFIED', "result": responseData }, res, httpStatus.ACCEPTED);
    return;
  } catch (error) {
    console.error('[verifyOtp] error:', error);
    response.error({ msgCode: 'INTERNAL_SERVER_ERROR' }, res, httpStatus.INTERNAL_SERVER_ERROR);
    return;
  }
};


export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    // const { userId } = (req as any).data;
    const { countryCode, phone, userType, email, isLogin } = req.body;
    // console.log("Req body: ",req.body);

    const updatedPhone = phone?.replace(/[-\s]/g, "") || "";

    // Check if user exists when logging in
    if (updatedPhone) {
      const findUser = await users.findUser(updatedPhone, countryCode, userType);

      if (!findUser && isLogin) {
         response.success(
          { msgCode: "USER_NOT_FOUND" },
          res,
          httpStatus.NOT_FOUND
        );
      }
    }

    // Generate OTP
    const otp = process.env.NODE_ENV === "production"
      ? genOtp(config.defaultOtpLength)
      : config.defaultOtp;
    // console.log("otp: ",otp);
    const hashOtp = await generateHash(otp);

    // Update OTP
    const updateOTP = await common.updateByCondition(
      OTP,
      { phone: updatedPhone },
      {
        otp: hashOtp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        userType,
        phone: updatedPhone,
      }
    );
    // console.log("updateOTP: ",updateOTP);

    if (!updateOTP) {
       response.error(
        { msgCode: "FAILED_TO_CREATE_OTP" },
        res,
        httpStatus.FORBIDDEN
      );
    }

    // Send OTP using your required signature
    if (process.env.NODE_ENV === "production") {
      const phoneClean = updatedPhone;

      const sendOtpResult = await sendSms.sendOtp(
        phoneClean,
        countryCode,
        { OTP: otp },
        constants.SMS_TEMPLATES.OTP
      );

      if (!sendOtpResult) {
         response.error(
          { msgCode: "OTP_NOT_SENT", data: {} },
          res,
          httpStatus.FORBIDDEN
        );
      }
    }

     response.success(
      { msgCode: "OTP_RESENT", data: {} },
      res,
      httpStatus.OK
    );

  } catch (error) {
    console.error(error);
     response.error(
      { msgCode: "INTERNAL_SERVER_ERROR" },
      res,
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
};
// export both handlers
export default { createRegistration, verifyOtp,resendOtp };
