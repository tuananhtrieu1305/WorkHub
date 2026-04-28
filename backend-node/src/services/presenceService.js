const activeSocketsByUser = new Map();

export const activityStatuses = new Set(["online", "idle", "dnd", "invisible"]);

export const normalizeActivityStatus = (status) => {
  return activityStatuses.has(status) ? status : "online";
};

export const serializeActivityStatusExpiresAt = (expiresAt) => {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export const markUserConnected = (userId, socketId) => {
  const key = userId.toString();
  const existingSockets = activeSocketsByUser.get(key) || new Set();
  const wasOnline = existingSockets.size > 0;

  existingSockets.add(socketId);
  activeSocketsByUser.set(key, existingSockets);

  return !wasOnline;
};

export const markUserDisconnected = (userId, socketId) => {
  const key = userId.toString();
  const existingSockets = activeSocketsByUser.get(key);
  if (!existingSockets) return false;

  existingSockets.delete(socketId);

  if (existingSockets.size > 0) {
    activeSocketsByUser.set(key, existingSockets);
    return false;
  }

  activeSocketsByUser.delete(key);
  return true;
};

export const isUserOnline = (userId) => {
  if (!userId) return false;
  return Boolean(activeSocketsByUser.get(userId.toString())?.size);
};

export const getPresenceFields = (user) => ({
  activityStatus: normalizeActivityStatus(user?.activityStatus),
  activityStatusExpiresAt: serializeActivityStatusExpiresAt(
    user?.activityStatusExpiresAt,
  ),
  isOnline: isUserOnline(user?._id || user?.id),
});

export const buildPresencePayload = (user) => ({
  userId: user._id,
  fullName: user.fullName,
  avatar: user.avatar,
  ...getPresenceFields(user),
});
