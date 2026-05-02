// src/config/environment.ts
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { SignOptions } from 'jsonwebtoken';

const env = process.env.NODE_ENV || 'development';

// Prefer .env.<env> at project root; fall back to .env if missing
const candidate = path.resolve(process.cwd(), `.env.${env}`);
const fallback = path.resolve(process.cwd(), '.env');
const envPath = fs.existsSync(candidate) ? candidate : fallback;

dotenv.config({ path: envPath });

function toNumber(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export const config = {
  nodeEnv: env,
  port: toNumber(process.env.PORT, 3000),
  mongoUri: process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  defaultOtp: process.env.DEFAULT_OTP || '1234',
  defaultOtpLength: toNumber(process.env.DEFAULT_OTP_LENGTH, 4),

  /** 🔑 New field for master doctor password (plain or hashed) */
  masterDoctorPassword: process.env.MASTER_DOCTOR_PASSWORD || '',

  /** Razorpay credentials for chat extension payments. */
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  /** Patient chat extension price in INR (rupees). */
  chatExtensionAmountInr: toNumber(process.env.CHAT_EXTENSION_AMOUNT_INR, 99),

  /** Google OAuth (per-doctor) for creating Google Meet links via Calendar API. */
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    /** Must exactly match a redirect URI whitelisted in Google Cloud Console. */
    redirectUri:
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      'http://localhost:3000/api/v1/google/oauth/callback',
    /** After OAuth callback we 302 the doctor back to this FE URL with ?status=ok|err. */
    frontendReturnUrl:
      process.env.GOOGLE_OAUTH_FRONTEND_RETURN_URL ||
      'http://localhost:4200/settings?googleConnected=1',
  },
};

// Helpful early validation
if (!config.mongoUri) {
  throw new Error(
    `MONGO_URI is missing. Looked for ${path.basename(envPath)} at project root.`
  );
}
if (
  config.mongoUri &&
  !config.mongoUri.startsWith('mongodb://') &&
  !config.mongoUri.startsWith('mongodb+srv://')
) {
  throw new Error(
    'Invalid MONGO_URI: must start with "mongodb://" or "mongodb+srv://".'
  );
}

export const environment = config.nodeEnv === 'production';
