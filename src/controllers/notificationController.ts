// src/controllers/notificationController.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import NotificationModel from "../models/Notification";
import response from "../utils/response";

interface CustomRequest extends Request {
  data?: { userId: string; userType?: number };
}

const toObjectId = (id: string) => new Types.ObjectId(id);

/** GET /api/v1/notification/list?page=&limit=&filter=all|unread */
const list = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    if (!userId) {
      response.error({ message: "Unauthorized" }, res, 401);
      return;
    }

    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));
    const filter = (req.query.filter as string) || "all";

    const baseFilter: any = {
      receiverId: toObjectId(userId),
      isDeleted: { $ne: true },
    };
    if (filter === "unread") baseFilter.isRead = { $ne: true };

    const [items, total, unreadCount] = await Promise.all([
      NotificationModel.find(baseFilter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      NotificationModel.countDocuments(baseFilter),
      NotificationModel.countDocuments({
        receiverId: toObjectId(userId),
        isDeleted: { $ne: true },
        isRead: { $ne: true },
      }),
    ]);

    response.success(
      {
        message: "Notifications fetched",
        result: {
          items,
          total,
          unreadCount,
          page,
          limit,
          hasMore: page * limit < total,
        },
      },
      res
    );
  } catch (err: any) {
    console.error("notification.list error:", err);
    response.error({ message: err?.message || "Failed to fetch notifications" }, res, 500);
  }
};

/** GET /api/v1/notification/unread-count */
const unreadCount = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    if (!userId) {
      response.error({ message: "Unauthorized" }, res, 401);
      return;
    }
    const count = await NotificationModel.countDocuments({
      receiverId: toObjectId(userId),
      isDeleted: { $ne: true },
      isRead: { $ne: true },
    });
    response.success({ message: "Unread count", result: { count } }, res);
  } catch (err: any) {
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

/** PUT /api/v1/notification/mark-read/:id */
const markRead = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const id = req.params.id;
    if (!userId || !id || !Types.ObjectId.isValid(id)) {
      response.error({ message: "Invalid request" }, res, 400);
      return;
    }
    const updated = await NotificationModel.findOneAndUpdate(
      { _id: toObjectId(id), receiverId: toObjectId(userId) },
      { $set: { isRead: true } },
      { new: true }
    ).lean();
    if (!updated) {
      response.error({ message: "Notification not found" }, res, 404);
      return;
    }
    response.success({ message: "Marked as read", result: updated }, res);
  } catch (err: any) {
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

/** PUT /api/v1/notification/mark-all-read */
const markAllRead = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    if (!userId) {
      response.error({ message: "Unauthorized" }, res, 401);
      return;
    }
    const result = await NotificationModel.updateMany(
      { receiverId: toObjectId(userId), isRead: { $ne: true }, isDeleted: { $ne: true } },
      { $set: { isRead: true } }
    );
    response.success(
      { message: "All notifications marked as read", result: { modified: result.modifiedCount } },
      res
    );
  } catch (err: any) {
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

/** DELETE /api/v1/notification/:id  (hard delete) */
const remove = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    const id = req.params.id;
    if (!userId || !id || !Types.ObjectId.isValid(id)) {
      response.error({ message: "Invalid request" }, res, 400);
      return;
    }
    const deleted = await NotificationModel.findOneAndDelete({
      _id: toObjectId(id),
      receiverId: toObjectId(userId),
    }).lean();
    if (!deleted) {
      response.error({ message: "Notification not found" }, res, 404);
      return;
    }
    response.success({ message: "Notification deleted" }, res);
  } catch (err: any) {
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

/** DELETE /api/v1/notification/clear-all  (hard delete all for this user) */
const clearAll = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.data?.userId;
    if (!userId) {
      response.error({ message: "Unauthorized" }, res, 401);
      return;
    }
    const result = await NotificationModel.deleteMany({
      receiverId: toObjectId(userId),
    });
    response.success(
      { message: "All notifications cleared", result: { deleted: result.deletedCount } },
      res
    );
  } catch (err: any) {
    response.error({ message: err?.message || "Failed" }, res, 500);
  }
};

export default { list, unreadCount, markRead, markAllRead, remove, clearAll };
