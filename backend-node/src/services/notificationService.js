import Notification from "../models/Notification.js";
import NotificationSettings from "../models/NotificationSettings.js";
import { redactSensitiveMetadata } from "./activityLogService.js";
import {
  buildAggregatedNotificationCopy,
  isMentionNotificationType,
  uniqueIdList,
} from "../utils/notificationPolicy.js";

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
  socialInteractions: true,
  mentions: true,
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const ACTOR_SELECT = "_id fullName email avatar position";

let notificationIoInstance = null;

export const setNotificationIo = (io) => {
  notificationIoInstance = io;
};

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

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
  post_reaction: "socialInteractions",
  post_comment: "socialInteractions",
  comment_reaction: "socialInteractions",
  comment_reply: "socialInteractions",
  post_mention: "mentions",
  chat_mention: "mentions",
};

const formatActor = (actor) => {
  if (!actor) return null;
  return {
    _id: actor._id,
    id: actor._id,
    fullName: actor.fullName,
    email: actor.email,
    avatar: actor.avatar,
    position: actor.position,
  };
};

export const serializeNotification = (notification) => {
  if (!notification) return null;
  const plain =
    typeof notification.toObject === "function"
      ? notification.toObject()
      : notification;
  const actor = formatActor(plain.actorId);
  const actorIds = Array.isArray(plain.actorIds) ? plain.actorIds : [];

  return {
    ...plain,
    id: plain._id,
    actor,
    sender: actor,
    actors: actorIds.map(formatActor).filter(Boolean),
    isRead: Boolean(plain.readAt || plain.isRead),
    isMention:
      Boolean(plain.isMention) || isMentionNotificationType(plain.type),
    lastInteractedAt: plain.lastInteractedAt || plain.createdAt,
  };
};

const hydrateNotification = async (notification) => {
  if (!notification) return null;
  await notification.populate([
    { path: "actorId", select: ACTOR_SELECT },
    { path: "actorIds", select: ACTOR_SELECT },
  ]);
  return serializeNotification(notification);
};

const emitNotificationCreated = async (notification) => {
  if (!notificationIoInstance || !notification) return;
  const payload =
    notification.actor || notification.sender
      ? notification
      : await hydrateNotification(notification);
  if (!payload?.userId) return;
  notificationIoInstance
    .to(`user:${toComparableId(payload.userId)}`)
    .emit("notification_created", payload);
};

const emitNotificationRead = (userId, notification) => {
  if (!notificationIoInstance || !notification) return;
  notificationIoInstance
    .to(`user:${toComparableId(userId)}`)
    .emit("notification_read", notification);
};

const emitNotificationsReadAll = (userId, organizationId) => {
  if (!notificationIoInstance) return;
  notificationIoInstance
    .to(`user:${toComparableId(userId)}`)
    .emit("notifications_read_all", {
      organizationId: organizationId || null,
      unreadCount: 0,
    });
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

const shouldCreateInAppNotification = async (payload) => {
  const settings = await getOrCreateSettings(payload.userId);
  const typeSetting = settingKeyByType[payload.type];

  if (settings && settings.inAppEnabled === false) return false;
  if (typeSetting && settings && settings[typeSetting] === false) return false;
  return true;
};

const buildCreatePayload = (payload, extra = {}) => {
  const actorIds = uniqueIdList(
    payload.actorIds || (payload.actorId ? [payload.actorId] : []),
  );
  return {
    userId: payload.userId,
    organizationId: payload.organizationId || null,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    content: payload.content || "",
    entityType: payload.entityType || null,
    entityId: payload.entityId || null,
    actorId: payload.actorId || actorIds.at(0) || null,
    actorIds,
    actorCount: Number(payload.actorCount) || actorIds.length || 0,
    eventCount: Number(payload.eventCount) || 1,
    aggregationKey: payload.aggregationKey || null,
    isMention:
      payload.isMention !== undefined
        ? Boolean(payload.isMention)
        : isMentionNotificationType(payload.type),
    lastInteractedAt: payload.lastInteractedAt || new Date(),
    data: redactSensitiveMetadata(payload.data || {}),
    ...extra,
  };
};

export const createNotification = async (payload) => {
  if (!(await shouldCreateInAppNotification(payload))) return null;

  const notification = await Notification.create(buildCreatePayload(payload));
  const serialized = await hydrateNotification(notification);
  await emitNotificationCreated(serialized);
  return serialized;
};

export const upsertAggregatedNotification = async (payload) => {
  if (!payload?.aggregationKey) {
    return createNotification(payload);
  }
  if (!(await shouldCreateInAppNotification(payload))) return null;

  const now = new Date();
  const existing = await Notification.findOne({
    userId: payload.userId,
    aggregationKey: payload.aggregationKey,
    deletedAt: null,
  });

  if (!existing) {
    return createNotification({
      ...payload,
      actorIds: payload.actorId ? [payload.actorId] : payload.actorIds,
      actorCount:
        Number(payload.actorCount) ||
        uniqueIdList(payload.actorIds || [payload.actorId]).length ||
        1,
      eventCount: Number(payload.eventCount) || 1,
      lastInteractedAt: now,
    });
  }

  const actorIds = uniqueIdList([
    ...(existing.actorIds || []),
    ...(payload.actorIds || []),
    payload.actorId,
  ]);
  const actorCount = actorIds.length || existing.actorCount || 1;
  const eventCount = (Number(existing.eventCount) || 1) + 1;
  const actorName =
    payload.actorName ||
    payload.actor?.fullName ||
    payload.data?.actorName ||
    "Ai đó";
  const copy =
    typeof payload.buildCopy === "function"
      ? payload.buildCopy({
          actorName,
          actorCount,
          eventCount,
          data: payload.data || {},
        })
      : buildAggregatedNotificationCopy({
          type: payload.type || existing.type,
          actorName,
          actorCount,
          data: payload.data || existing.data || {},
        });

  existing.type = payload.type || existing.type;
  existing.title = copy.title || payload.title || existing.title;
  existing.message = copy.message || payload.message || existing.message;
  existing.content = payload.content ?? existing.content ?? "";
  existing.entityType = payload.entityType || existing.entityType;
  existing.entityId = payload.entityId || existing.entityId;
  existing.actorId = payload.actorId || existing.actorId;
  existing.actorIds = actorIds;
  existing.actorCount = actorCount;
  existing.eventCount = eventCount;
  existing.organizationId = payload.organizationId || existing.organizationId;
  existing.isMention =
    payload.isMention !== undefined
      ? Boolean(payload.isMention)
      : existing.isMention || isMentionNotificationType(existing.type);
  existing.lastInteractedAt = now;
  existing.readAt = null;
  existing.isRead = false;
  existing.data = redactSensitiveMetadata({
    ...(existing.data || {}),
    ...(payload.data || {}),
    actorCount,
    eventCount,
  });

  await existing.save();
  const serialized = await hydrateNotification(existing);
  await emitNotificationCreated(serialized);
  return serialized;
};

export const notifyUsers = async (userIds, payload) => {
  const uniqueUserIds = uniqueIdList(userIds);
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

export const notifyUsersAggregated = async (userIds, payload) => {
  const uniqueUserIds = uniqueIdList(userIds);
  const notifications = [];

  for (const userId of uniqueUserIds) {
    const aggregationKey =
      typeof payload.aggregationKey === "function"
        ? payload.aggregationKey(userId)
        : payload.aggregationKey;
    const notification = await upsertAggregatedNotification({
      ...payload,
      userId,
      aggregationKey,
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

  if (filters.category === "mentions" || filters.tab === "mentions") {
    query.isMention = true;
  }

  const [notifications, totalElements, unread] = await Promise.all([
    Notification.find(query)
      .populate("actorId", ACTOR_SELECT)
      .populate("actorIds", ACTOR_SELECT)
      .sort({ lastInteractedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(query),
    unreadCount(userId, filters.organizationId),
  ]);

  return {
    content: notifications.map(serializeNotification),
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
  const notification = await Notification.findOneAndUpdate(
    query,
    { readAt: new Date(), isRead: true },
    { new: true },
  )
    .populate("actorId", ACTOR_SELECT)
    .populate("actorIds", ACTOR_SELECT);
  const serialized = serializeNotification(notification);
  emitNotificationRead(userId, serialized);
  return serialized;
};

export const markAllRead = async (userId, organizationId = undefined) => {
  const query = { userId, readAt: null, deletedAt: null };
  if (organizationId) query.organizationId = organizationId;
  const result = await Notification.updateMany(
    query,
    { readAt: new Date(), isRead: true },
  );
  emitNotificationsReadAll(userId, organizationId);
  return result;
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
  upsertAggregatedNotification,
  notifyUsers,
  notifyUsersAggregated,
  listForUser,
  unreadCount,
  markRead,
  markAllRead,
  softDelete,
  getOrCreateSettings,
  updateSettings,
  setNotificationIo,
};
