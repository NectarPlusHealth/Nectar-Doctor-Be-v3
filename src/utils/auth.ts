// src/utils/auth.ts
import bcrypt from "bcrypt";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { config } from "../config/environment";
import { Request, Response, NextFunction } from "express";
import response from "./response"; // use your response util for consistent responses

export const generateHash = async (plain: string): Promise<string> => {
  const saltRounds = 10;
  return bcrypt.hash(plain, saltRounds);
};

export const compareHash = async (plain: string, hash: string): Promise<boolean> => {
  // return bcrypt.compare(plain, hash);
  return bcrypt.compareSync(plain, hash);
};

export interface JwtPayloadCustom {
  userId: string;
  userType?: number;
  fullName?: string;
}

/**
 * Generate JWT
 * - payload: small object with userId etc.
 * - expiresIn: optional override, if not provided we use the value from config
 */
export const generateAuthJwt = (
  payload: JwtPayloadCustom,
  expiresIn?: SignOptions["expiresIn"]
): string => {
  const tokenPayload = {
    userId: payload.userId,
    userType: payload.userType,
    fullName: payload.fullName,
  };

  const secret: Secret = (config.jwtSecret || "secret") as Secret;
  // console.log("config.jwtSecret: ",config.jwtSecret);

  const signOptions: SignOptions = {
    expiresIn: expiresIn ?? (config.jwtExpiresIn as SignOptions["expiresIn"]),
  };

  return jwt.sign(tokenPayload as Record<string, unknown>, secret, signOptions);
};

export const verifyAuthJwt = (token: string): JwtPayloadCustom | null => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret as Secret) as jwt.JwtPayload;
    return {
      userId: (decoded as any).userId,
      userType: (decoded as any).userType,
      fullName: (decoded as any).fullName,
    };
  } catch (err) {
    return null;
  }
};

/**
 * Express middleware: verifyAuthToken
 * - Expects `Authorization: Bearer <token>` header
 * - On success attaches `req.data = { userId, userType, fullName }`
 * - On failure responds 401 using response.error(...) and does not call next()
 */
export function verifyAuthToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = (req.headers.authorization || "") as string;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, 401);
      return;
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyAuthJwt(token);
    // console.log("verifyAuthToken payload:", payload);

    if (!payload || !payload.userId) {
      response.error({ msgCode: "UNAUTHORIZED" }, res, 401);
      return;
    }

    // attach user info to req.data for controllers to consume
    (req as any).data = {
      userId: payload.userId,
      userType: payload.userType,
      fullName: payload.fullName,
    };
    // console.log("about to call next");
    return next();
  } catch (err) {
    console.error("verifyAuthToken error:", err);
    response.error({ msgCode: "UNAUTHORIZED" }, res, 401);
    return;
  }
}

/**
 * Default export keeps legacy compatibility while also exporting named functions above.
 */
export default {
  generateHash,
  compareHash,
  generateAuthJwt,
  verifyAuthJwt,
  verifyAuthToken,
};
