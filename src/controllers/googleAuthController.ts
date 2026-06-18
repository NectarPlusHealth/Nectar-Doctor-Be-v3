// src/controllers/googleAuthController.ts
//
// POST /api/v1/auth/google
//   Body: { idToken: string, userType?: number, deviceId?: string, deviceType?: string }
//
// Flow:
//   1. Verify the Google ID token with Google's tokeninfo endpoint
//   2. Look up the doctor user by email
//   3. Return a JWT (same shape as password login)
//   4. Google Sign-In is login-only — if the doctor account doesn't exist yet,
//      they must register via the normal registration flow first.
//
import { Request, Response } from 'express';
import https from 'https';
import { User } from '../models/User';
import Doctor from '../models/Doctor';
import Session from '../models/Session';
import { generateAuthJwt } from '../utils/auth';
import response from '../utils/response';
import httpStatus from '../utils/httpStatus';
import constants from '../utils/constant';
import { config } from '../config/environment';

/** Verify Google ID token using Google's tokeninfo endpoint. */
async function verifyGoogleIdToken(idToken: string): Promise<{
  email: string;
  name: string;
  sub: string; // Google user ID
  picture?: string;
  email_verified: boolean;
} | null> {
  return new Promise((resolve) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error || !parsed.email) {
            resolve(null);
            return;
          }
          // Optionally verify audience matches our client ID
          const expectedAud = process.env.GOOGLE_OAUTH_CLIENT_ID;
          if (expectedAud && parsed.aud !== expectedAud) {
            console.warn('[googleAuth] token audience mismatch', { aud: parsed.aud, expected: expectedAud });
            resolve(null);
            return;
          }
          resolve({
            email: parsed.email,
            name: parsed.name || '',
            sub: parsed.sub,
            picture: parsed.picture,
            email_verified: parsed.email_verified === 'true' || parsed.email_verified === true,
          });
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/** POST /api/v1/auth/google */
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      idToken,
      userType = constants.USER_TYPES.DOCTOR,
      deviceId = null,
      deviceType = null,
      deviceToken = null,
    } = req.body || {};

    if (!idToken || typeof idToken !== 'string') {
      response.error({ msgCode: 'INVALID_INPUT', message: 'idToken is required' }, res, httpStatus.BAD_REQUEST);
      return;
    }

    // 1. Verify the Google token
    const googleUser = await verifyGoogleIdToken(idToken);
    if (!googleUser) {
      response.error({ msgCode: 'INVALID_TOKEN', message: 'Google ID token verification failed' }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    const { email, name } = googleUser;

    // 2. Find doctor by email
    const doctorDoc = await Doctor.findOne({ email: email.toLowerCase() }).exec();
    if (!doctorDoc) {
      // Doctor not registered — cannot create account via Google Sign-In
      response.error(
        {
          msgCode: 'USER_NOT_FOUND',
          message: 'No doctor account found for this Google email. Please register first.',
        },
        res,
        httpStatus.NOT_FOUND
      );
      return;
    }

    // 3. Get the linked user record
    const userId = (doctorDoc as any).userId;
    const user = await User.findById(userId).exec();
    if (!user) {
      response.error({ msgCode: 'USER_NOT_FOUND' }, res, httpStatus.NOT_FOUND);
      return;
    }

    // 4. Check user is active
    if ((user as any).isDeleted === true) {
      response.error({ msgCode: 'INVALID_CREDENTIALS' }, res, httpStatus.UNAUTHORIZED);
      return;
    }

    // 5. Generate JWT
    const jwtExpiresIn = (config as any).jwtExpiresIn || (config as any).expireIn || undefined;
    const rawUserType = (user as any).userType;
    const storedUserType = Number(
      Array.isArray(rawUserType) ? rawUserType[0] : rawUserType
    );

    const jwtPayload: Record<string, any> = {
      userId: (user as any)._id.toString(),
      userType: storedUserType,
      fullName: (user as any).fullName || name,
      doctorId: (doctorDoc as any)._id?.toString() ?? null,
      deviceId,
      deviceType,
      deviceToken,
      tokenType: constants.TOKEN_TYPE.LOGIN,
    };

    const token = generateAuthJwt(jwtPayload as any, jwtExpiresIn as any);

    // 6. Create session (non-blocking)
    try {
      await Session.create({
        jwt: token,
        userId: (user as any)._id,
        deviceId,
        deviceType,
        deviceToken,
        tokenType: constants.TOKEN_TYPE.LOGIN,
      } as any);
    } catch (sessErr) {
      console.warn('[googleAuth] session create failed:', sessErr);
    }

    const userObj = (user as any).toObject ? (user as any).toObject() : (user as any);

    const result = {
      token,
      user: {
        _id: userObj._id?.toString?.() ?? userObj._id,
        fullName: userObj.fullName || name,
        phone: userObj.phone,
        countryCode: userObj.countryCode ?? '+91',
        userType: Array.isArray(userObj.userType) ? userObj.userType : [userObj.userType],
        isDeleted: userObj.isDeleted ?? false,
        status: userObj.status ?? 2,
        doctorId: (doctorDoc as any)._id?.toString() ?? null,
        createdAt: userObj.createdAt ? new Date(userObj.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: userObj.updatedAt ? new Date(userObj.updatedAt).toISOString() : new Date().toISOString(),
      },
      steps: 2,
      profileScreen: 1,
      doctorId: (doctorDoc as any)._id?.toString?.() ?? null,
      userType: storedUserType,
    };

    res.status(200).json({
      success: true,
      status_code: 200,
      message: 'Google login successful.',
      result,
      time: Date.now(),
    });
  } catch (err) {
    console.error('[googleAuth] error:', err);
    response.error({ msgCode: 'INTERNAL_SERVER_ERROR' }, res, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

export default { googleLogin };
