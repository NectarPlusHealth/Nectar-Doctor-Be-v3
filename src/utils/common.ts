// src/utils/common.ts
/**
 * Common database helper utilities.
 * Wraps Mongoose model operations into small helpers.
 */
import mongoose, { Model, FilterQuery, Types  } from "mongoose";
// import mongoose from "mongoose";
import { randomUUID } from "crypto";
type AnyObj = { [k: string]: any };
/**
 * Pagination helper.
 * Accepts page and size (string or number) and returns { limit, offset }.
 */
export function getPagination(page: number | string = 1, size: number | string = 20) {
  const p = Number(page) || 1;
  const s = Number(size) || 20;
  const limit = Math.max(1, Math.floor(s));
  const offset = (Math.max(1, Math.floor(p)) - 1) * limit;
  return { limit, offset };
}

/**
 * Generate a random UUID string.
 */
export function genUUID(): string {
  return randomUUID();
}

/**
 * Database helpers (keep structure similar to your previous object for backward compatibility).
 */
export async function create<T>(Model: any, payload: Partial<T>): Promise<T> {
  const doc = new Model(payload);
  return doc.save();
}

export async function findOne<T>(Model: any, filter: any): Promise<T | null> {
  return Model.findOne(filter).lean();
}

export async function updateOne<T>(Model: any, filter: any, update: any): Promise<T | null> {
  return Model.findOneAndUpdate(filter, update, { new: true }).lean();
}

export async function getByCondition<T>(Model: any, filter: any): Promise<T | null> {
  return Model.findOne(filter).lean();
}

export async function removeById<T>(Model: any, id: any): Promise<T | null> {
  return Model.findByIdAndDelete(id).lean();
}

export async function findById<T>(Model: any, id: any): Promise<T | null> {
  return Model.findById(id).lean();
}

// export async function updateByCondition(
//   Model: mongoose.Model<any>,
//   condition: any,
//   content: any,
//   userType?: number
// ): Promise<any> {
//   try {
//     const data = await Model.updateOne(condition, { $set: content }, { new: true }).exec();
//     return data;
//   } catch (error) {
//     console.error("updateByCondition error:", error);
//     return false;
//   }
// }
export async function updateByCondition(
  Model: mongoose.Model<any>,
  condition: any,
  content: any,
  userType?: number
): Promise<any> {
  try {
    // Defensive copy
    const updateContent = { ...content };

    // If trying to update userType, check model's schema type
    if (Object.prototype.hasOwnProperty.call(updateContent, "userType")) {
      const schemaPath = (Model as any).schema?.path?.("userType");
      const inst = schemaPath?.instance; // e.g. "Number", "Array", "String"

      // If schema expects Number but content.userType is an array
      if (inst === "Number" && Array.isArray(updateContent.userType)) {
        if (updateContent.userType.length === 0) {
          // nothing to set -> remove it
          delete updateContent.userType;
        } else if (updateContent.userType.length === 1) {
          // coerce single-element array -> number
          const val = Number(updateContent.userType[0]);
          if (Number.isNaN(val)) {
            throw new Error("Invalid userType value");
          }
          updateContent.userType = val;
        } else {
          // multiple entries but schema expects Number -> ambiguous
          // choose behavior: either take first, or throw.
          // I'll throw so you make a conscious decision
          throw new Error(
            "Attempting to set multiple userType values but schema expects single Number. Convert schema to array or send single value."
          );
          // OR to auto-pick first: updateContent.userType = Number(updateContent.userType[0]);
        }
      }

      // If schema expects Array and you passed a single number -> wrap it
      if (inst === "Array" && !Array.isArray(updateContent.userType)) {
        updateContent.userType = [updateContent.userType];
      }
    }

    const data = await Model.updateOne(condition, { $set: updateContent }).exec();
    return data;
  } catch (error) {
    console.error("updateByCondition error:", error);
    return false;
  }
}
export async function updateById(
  Model: mongoose.Model<any>,
  id: any,
  update: any
): Promise<any | null> {
  try {
    const doc = await Model.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    return doc;
  } catch (error) {
    console.error("updateById error:", error);
    return null;
  }
}

/**
 * Placeholder: removeAllSessionByCondition if Session model exists in your project.
 * If you have a session model, import it and implement – otherwise it's a no-op.
 */
const removeAllSessionByCondition = async (Model: mongoose.Model<any> | null, condition: AnyObj) => {
  try {
    if (!Model) return true;
    await Model.deleteMany(condition);
    return true;
  } catch (error) {
    console.error("removeAllSessionByCondition error:", error);
    return false;
  }
};

export const findAll = async <T>(
  Model: Model<T>,
  condition: FilterQuery<T>,
  sortCondition: AnyObj = { createdAt: 1 }
): Promise<T[]> => {
  try {
    const data = await Model.find(condition).sort(sortCondition);
    return data;
  } catch (error) {
    console.error("Error in findAll:", error);
    return []; // ✅ Always return an array
  }
};

export const getById = async <T>(
  Model: Model<T>,
  id: string | Types.ObjectId
): Promise<T | null | false> => {
  try {
    const data = await Model.findById(id);
    return data;
  } catch (error) {
    console.error("Error in getById:", error);
    return false;
  }
};

export const getManyByCondition = async <T>(
    Model: Model<T>,
    condition: FilterQuery<T>
): Promise<T[]> => {
    try {
        const data = await Model.find(condition).lean();
        return data as T[];
    } catch (error) {
        console.error("Error in getManyByCondition:", error);
        return [];
    }
};
// default export (backward compatibility)
const common = {
  create,
  findOne,
  updateOne,
  getByCondition,
  removeById,
  findById,
  getPagination,
  genUUID,
  updateByCondition,
  updateById,
  removeAllSessionByCondition,
  findAll,getById,
  getManyByCondition

};

export default common;
