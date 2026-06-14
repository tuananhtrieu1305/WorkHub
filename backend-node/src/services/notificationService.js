import Notification from "../models/Notification.js";
import NotificationSettings from "../models/NotificationSettings.js";
import { redactSensitiveMetadata } from "./activityLogService.js";

const DEFAULT_SETTINGS = {
  inAppEnabled: true,
  emailEnabled: false,
  pushEnabled: false,
  taskAssigned: true,
  taskUpdated: true,
  taskDueSoon: true,
  documentShared: true,
  documentVersionAdded: true,
  adminActions: true,
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parsePage = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE;
};

const parseLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const settingKeyByType = {
  task_assigned: "taskAssigned",
  task_updated: "taskUpdated",
  task_due_soon: "taskDueSoon",
  document_shared: "documentShared",
  document_version_added: "documentVersionAdded",
  admin_action: "adminActions",
};

export const getOrCreateSettings = async (userId) => {
  return NotificationSettings.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, ...DEFAULT_SETTINGS } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

export const updateSettings = async (userId, payload) => {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const update = {};
  allowed.forEach((key) => {
    if (payload[key] !== undefined) {
      update[key] = Boolean(payload[key]);
    }
  });

  return NotificationSettings.findOneAndUpdate(
    { userId },
    {
      $set: update,
      $setOnInsert: { userId, ...DEFAULT_SETTINGS },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
};

export const createNotification = async (payload) => {
  const settings = await getOrCreateSettings(payload.userId);
  const typeSetting = settingKeyByType[payload.type];

  if (settings && settings.inAppEnabled === false) return null;
  if (typeSetting && settings && settings[typeSetting] === false) return null;

  return Notification.create({
    userId: payload.userId,
    organizationId: payload.organizationId || null,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    entityType: payload.entityType || null,
    entityId: payload.entityId || null,
    actorId: payload.actorId || null,
    data: redactSensitiveMetadata(payload.data || {}),
  });
};

export const notifyUsers = async (userIds, payload) => {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean).map((id) => id.toString()))];
  const notifications = [];

  for (const userId of uniqueUserIds) {
    const notification = await createNotification({
      ...payload,
      userId,
    });
    if (notification) notifications.push(notification);
  }

  return notifications;
};

export const listForUser = async (userId, filters = {}) => {
  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit || filters.size);
  const query = {
    userId,
    deletedAt: null,
  };

  if (filters.organizationId) {
    query.organizationId = filters.organizationId;
  } else if (filters.organizationId === null) {
    query._id = { $exists: false };
  }

  if (filters.unreadOnly === true || filters.unreadOnly === "true") {
    query.readAt = null;
  }

  if (filters.type) {
    query.type = filters.type;
  }

  const [content, totalElements, unread] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(query),
    unreadCount(userId, filters.organizationId),
  ]);

  return {
    content,
    totalElements,
    unreadCount: unread,
  };
};

export const unreadCount = async (userId, organizationId = undefined) => {
  const query = {
    userId,
    readAt: null,
    deletedAt: null,
  };
  if (organizationId) query.organizationId = organizationId;
  if (organizationId === null) query._id = { $exists: false };
  return Notification.countDocuments(query);
};

export const markRead = async (userId, notificationId, organizationId = undefined) => {
  const query = { _id: notificationId, userId, deletedAt: null };
  if (organizationId) query.organizationId = organizationId;
  return Notification.findOneAndUpdate(
    query,
    { readAt: new Date() },
    { new: true },
  );
};

export const markAllRead = async (userId, organizationId = undefined) => {
  const query = { userId, readAt: null, deletedAt: null };
  if (organizationId) query.organizationId = organizationId;
  return Notification.updateMany(
    query,
    { readAt: new Date() },
  );
};

export const softDelete = async (userId, notificationId, organizationId = undefined) => {
  const query = { _id: notificationId, userId, deletedAt: null };
  if (organizationId) query.organizationId = organizationId;
  return Notification.updateOne(
    query,
    { deletedAt: new Date() },
  );
};

export default {
  createNotification,
  notifyUsers,
  listForUser,
  unreadCount,
  markRead,
  markAllRead,
  softDelete,
  getOrCreateSettings,
  updateSettings,
};
