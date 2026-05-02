// src/services/usersService.ts
import { Types } from 'mongoose';
import { IUser, User } from '../models/User';
import { IDoctor, Doctor } from '../models/Doctor';
import { compareHash } from '../utils/auth';

/**
 * User & Doctor service helpers (typed).
 * - Uses .exec() to return mongoose Documents typed as IUser/IDoctor.
 * - Provides creation helpers and simple authentication helpers.
 */

export const users = {
  // ---------- Finders ----------

  /**
   * Find a user by phone + countryCode + userType
   */
  findUser: async (phone: string, countryCode: string, userType: number): Promise<IUser | null> => {
    return User.findOne({ phone, countryCode, userType }).exec();
  },

  /**
   * Find a user by phone only (optionally include countryCode/userType in filter)
   */
  findUserByPhone: async (phone: string, countryCode?: string, userType?: number): Promise<IUser | null> => {
    const filter: any = { phone };
    if (countryCode) filter.countryCode = countryCode;
    if (typeof userType === 'number') filter.userType = userType;
    return User.findOne(filter).exec();
  },

  /**
   * Find user by _id
   */
  findUserById: async (id: string | Types.ObjectId): Promise<IUser | null> => {
    return User.findById(id).exec();
  },

  /**
   * Find doctor by email
   */
  findDoctor: async (email: string): Promise<IDoctor | null> => {
    return Doctor.findOne({ email }).exec();
  },

  /**
   * Find doctor by userId
   */
  findDoctorByUserId: async (userId: string | Types.ObjectId): Promise<IDoctor | null> => {
    return Doctor.findOne({ userId }).exec();
  },

  // ---------- Creators (used in registration) ----------

  /**
   * Create a user document
   */
  createUser: async (payload: Partial<IUser>): Promise<IUser> => {
    const doc = new User(payload);
    return doc.save();
  },

  /**
   * Create a doctor document
   */
  createDoctor: async (payload: Partial<IDoctor>): Promise<IDoctor> => {
    const doc = new Doctor(payload);
    return doc.save();
  },

  // ---------- Authentication helpers (simple) ----------

  /**
   * Authenticate by phone. Returns IUser if success, otherwise null.
   * Compares the provided plaintext password vs stored hash using compareHash.
   */
  authenticateByPhone: async (
    phone: string,
    countryCode: string,
    userType: number,
    plainPassword: string
  ): Promise<IUser | null> => {
    const user = await User.findOne({ phone, countryCode, userType }).exec();
    if (!user) return null;
    const ok = await compareHash(plainPassword, (user as any).password);
    return ok ? (user as IUser) : null;
  },

  /**
   * Authenticate by email (doctor -> user). Returns IUser if success, otherwise null.
   * Looks up doctor by email, then loads user by doctor.userId and compares password.
   */
  authenticateByEmail: async (email: string, plainPassword: string): Promise<IUser | null> => {
    const doctor = await Doctor.findOne({ email }).exec();
    if (!doctor || !(doctor as any).userId) return null;
    const user = await User.findById((doctor as any).userId).exec();
    if (!user) return null;
    const ok = await compareHash(plainPassword, (user as any).password);
    return ok ? (user as IUser) : null;
  },
};

export default users;
