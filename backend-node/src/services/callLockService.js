const DEFAULT_LOCK_TTL_MS = 2 * 60 * 1000;

const activeCallLocks = new Map();

const toKey = (value) => String(value?._id || value || "");

export const cleanupExpiredLocks = (now = Date.now()) => {
  for (const [userId, lock] of activeCallLocks.entries()) {
    if (!lock?.expiresAt || lock.expiresAt <= now) {
      activeCallLocks.delete(userId);
    }
  }
};

export const acquireUserLock = (
  userId,
  callId,
  ttlMs = DEFAULT_LOCK_TTL_MS,
) => {
  cleanupExpiredLocks();

  const key = toKey(userId);
  if (!key) {
    return { ok: false, reason: "invalid_user" };
  }

  const existing = activeCallLocks.get(key);
  if (existing && toKey(existing.callId) !== toKey(callId)) {
    return {
      ok: false,
      reason: "busy",
      busyUserId: key,
      callId: existing.callId,
    };
  }

  activeCallLocks.set(key, {
    callId: toKey(callId),
    expiresAt: Date.now() + ttlMs,
  });

  return { ok: true };
};

export const acquireCallLocks = (callId, callerUserId, calleeUserId) => {
  const caller = acquireUserLock(callerUserId, callId);
  if (!caller.ok) return caller;

  const callee = acquireUserLock(calleeUserId, callId);
  if (!callee.ok) {
    releaseUserLock(callerUserId, callId);
    return callee;
  }

  return { ok: true };
};

export const releaseUserLock = (userId, callId = null) => {
  const key = toKey(userId);
  const existing = activeCallLocks.get(key);
  if (!existing) return;

  if (callId && toKey(existing.callId) !== toKey(callId)) return;
  activeCallLocks.delete(key);
};

export const releaseCallLocks = (callId) => {
  const targetCallId = toKey(callId);
  for (const [userId, lock] of activeCallLocks.entries()) {
    if (toKey(lock.callId) === targetCallId) {
      activeCallLocks.delete(userId);
    }
  }
};

export const isUserBusy = (userId) => {
  cleanupExpiredLocks();
  return activeCallLocks.has(toKey(userId));
};

export const clearCallLocks = () => {
  activeCallLocks.clear();
};

const cleanupInterval = setInterval(cleanupExpiredLocks, 30000);
cleanupInterval.unref?.();
