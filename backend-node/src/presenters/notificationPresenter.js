import ApiError from "../utils/apiError.js";
import { logActivity } from "../services/activityLogService.js";
import {
  getOrCreateSettings,
  listForUser,
  markAllRead,
  markRead,
  softDelete,
  unreadCount,
  updateSettings,
} from "../services/notificationService.js";

export const listNotifications = async (req, res) => {
  const result = await listForUser(req.user._id, req.query);
  res.json(result);
};

export const getUnreadCount = async (req, res) => {
  res.json({ unreadCount: await unreadCount(req.user._id) });
};

export const markNotificationRead = async (req, res) => {
  const notification = await markRead(req.user._id, req.params.id);
  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }
  res.json(notification);
};

export const markAllNotificationsRead = async (req, res) => {
  const result = await markAllRead(req.user._id);
  res.json({ modifiedCount: result.modifiedCount || 0 });
};

export const deleteNotification = async (req, res) => {
  const result = await softDelete(req.user._id, req.params.id);
  if (!result.modifiedCount) {
    throw new ApiError(404, "Notification not found");
  }
  res.status(204).send();
};

export const getNotificationSettings = async (req, res) => {
  const settings = await getOrCreateSettings(req.user._id);
  res.json(settings);
};

export const patchNotificationSettings = async (req, res) => {
  const settings = await updateSettings(req.user._id, req.body);
  await logActivity({
    actorId: req.user._id,
    actorType: "user",
    action: "notification.settings_updated",
    entityType: "notification_settings",
    entityId: settings?._id || req.user._id,
    targetUserId: req.user._id,
    metadata: {
      changedFields: Object.keys(req.body || {}),
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || null,
  });
  res.json(settings);
};
