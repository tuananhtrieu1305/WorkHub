const MAX_REMINDER_TITLE_LENGTH = 500;
export const REMINDER_RECURRENCE_NONE = "none";
export const REMINDER_RECURRENCE_DAILY = "daily";
export const REMINDER_RECURRENCE_WEEKLY = "weekly";
export const REMINDER_RECURRENCE_MONTHLY = "monthly";
export const REMINDER_STATUS_ACTIVE = "active";
export const REMINDER_STATUS_COMPLETED = "completed";
export const REMINDER_STATUS_CANCELLED = "cancelled";
export const REMINDER_RESPONSE_ACCEPTED = "accepted";
export const REMINDER_RESPONSE_DECLINED = "declined";

export const REMINDER_RECURRENCES = new Set([
  REMINDER_RECURRENCE_NONE,
  REMINDER_RECURRENCE_DAILY,
  REMINDER_RECURRENCE_WEEKLY,
  REMINDER_RECURRENCE_MONTHLY,
]);

export const REMINDER_RESPONSE_STATUSES = new Set([
  REMINDER_RESPONSE_ACCEPTED,
  REMINDER_RESPONSE_DECLINED,
]);

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

const normalizeString = (value, maxLength) => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
};

const normalizeReminderDate = (value, now = new Date()) => {
  const scheduledAt = new Date(value);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Reminder time is invalid");
  }

  if (scheduledAt.getTime() < now.getTime()) {
    throw new Error("Reminder time must not be in the past");
  }

  return scheduledAt;
};

const normalizeRecurrence = (value) => {
  const recurrence = String(value || REMINDER_RECURRENCE_NONE);
  if (!REMINDER_RECURRENCES.has(recurrence)) {
    throw new Error("Reminder recurrence is invalid");
  }

  return recurrence;
};

const cloneDate = (date) => new Date(date.getTime());

const addMonthsClamped = (date, monthCount = 1) => {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + monthCount);
  const lastDayOfTargetMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return next;
};

export const getNextReminderOccurrence = (
  currentDate,
  recurrence,
  { after = new Date() } = {},
) => {
  if (!currentDate || recurrence === REMINDER_RECURRENCE_NONE) return null;

  let nextDate = new Date(currentDate);
  if (Number.isNaN(nextDate.getTime())) return null;

  const afterTime = new Date(after).getTime();
  if (!Number.isFinite(afterTime)) return null;

  const maxIterations = 1000;
  for (let index = 0; index < maxIterations && nextDate.getTime() <= afterTime; index += 1) {
    if (recurrence === REMINDER_RECURRENCE_DAILY) {
      nextDate = new Date(nextDate.getTime() + 24 * 60 * 60 * 1000);
    } else if (recurrence === REMINDER_RECURRENCE_WEEKLY) {
      nextDate = new Date(nextDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (recurrence === REMINDER_RECURRENCE_MONTHLY) {
      nextDate = addMonthsClamped(nextDate, 1);
    } else {
      return null;
    }
  }

  return nextDate.getTime() > afterTime ? nextDate : null;
};

export const normalizeReminderPayload = (
  payload = {},
  { creatorId, now = new Date() } = {},
) => {
  const title = normalizeString(
    payload.title || payload.content,
    MAX_REMINDER_TITLE_LENGTH,
  );

  if (!title) {
    throw new Error("Reminder content is required");
  }

  const scheduledAt = normalizeReminderDate(
    payload.scheduledAt || payload.remindAt || payload.nextTriggerAt,
    now,
  );
  const recurrence = normalizeRecurrence(payload.recurrence);

  return {
    title,
    scheduledAt,
    nextTriggerAt: cloneDate(scheduledAt),
    recurrence,
    status: REMINDER_STATUS_ACTIVE,
    responses: creatorId
      ? [
          {
            userId: creatorId,
            status: REMINDER_RESPONSE_ACCEPTED,
            respondedAt: now,
          },
        ]
      : [],
    triggerCount: 0,
    lastTriggeredAt: null,
    cancelledAt: null,
    cancelledBy: null,
  };
};

export const getCurrentUserReminderStatus = (reminder, userId) => {
  const currentUserId = toComparableId(userId);
  if (!reminder || !currentUserId) return "";

  const response = (reminder.responses || []).find(
    (item) => toComparableId(item.userId) === currentUserId,
  );
  return response?.status || "";
};

export const applyReminderResponse = (
  reminder,
  status,
  { userId, now = new Date() } = {},
) => {
  if (!reminder) {
    throw new Error("Reminder not found");
  }

  if (reminder.status === REMINDER_STATUS_CANCELLED) {
    throw new Error("Reminder is cancelled");
  }

  const normalizedStatus = String(status || "");
  if (!REMINDER_RESPONSE_STATUSES.has(normalizedStatus)) {
    throw new Error("Reminder response is invalid");
  }

  const currentUserId = toComparableId(userId);
  if (!currentUserId) {
    throw new Error("User is required");
  }

  const responses = (reminder.responses || []).filter(
    (item) => toComparableId(item.userId) !== currentUserId,
  );
  responses.push({
    userId,
    status: normalizedStatus,
    respondedAt: now,
  });
  reminder.responses = responses;

  return reminder;
};

export const cancelReminder = (
  reminder,
  { userId, now = new Date() } = {},
) => {
  if (!reminder) {
    throw new Error("Reminder not found");
  }

  if (reminder.status === REMINDER_STATUS_CANCELLED) {
    throw new Error("Reminder is already cancelled");
  }

  reminder.status = REMINDER_STATUS_CANCELLED;
  reminder.cancelledAt = now;
  reminder.cancelledBy = userId || null;
  reminder.nextTriggerAt = null;
  return reminder;
};

export const markReminderTriggered = (
  reminder,
  { now = new Date() } = {},
) => {
  if (!reminder) {
    throw new Error("Reminder not found");
  }

  const recurrence = normalizeRecurrence(reminder.recurrence);
  reminder.lastTriggeredAt = now;
  reminder.triggerCount = Number(reminder.triggerCount || 0) + 1;

  const nextTriggerAt = getNextReminderOccurrence(reminder.nextTriggerAt || now, recurrence, {
    after: now,
  });
  reminder.nextTriggerAt = nextTriggerAt;
  if (!nextTriggerAt) {
    reminder.status = REMINDER_STATUS_COMPLETED;
  }

  return reminder;
};
