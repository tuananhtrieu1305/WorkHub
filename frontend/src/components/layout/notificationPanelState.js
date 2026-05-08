const toComparableId = (value) => {
  if (value == null) return "";
  return String(value);
};

export const getNotificationId = (notification) =>
  toComparableId(notification?.id || notification?._id);

export const isNotificationUnread = (notification) => {
  if (!notification) return false;
  if (notification.readAt) return false;
  return notification.isRead !== true;
};

export const filterNotificationsByTab = (notifications, tab) => {
  if (tab === "unread") {
    return notifications.filter(isNotificationUnread);
  }

  if (tab === "mentions") {
    return notifications.filter((notification) => {
      const haystack = [
        notification?.type,
        notification?.title,
        notification?.message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes("mention") || haystack.includes("@");
    });
  }

  return notifications;
};

export const markNotificationsReadLocally = (
  notifications,
  readAt = new Date().toISOString(),
) => {
  return notifications.map((notification) => ({
    ...notification,
    isRead: true,
    readAt: notification.readAt || readAt,
  }));
};

export const markNotificationReadLocally = (
  notifications,
  notificationId,
  readAt = new Date().toISOString(),
) => {
  const readNotificationId = toComparableId(notificationId);

  return notifications.map((notification) =>
    getNotificationId(notification) === readNotificationId
      ? {
          ...notification,
          isRead: true,
          readAt: notification.readAt || readAt,
        }
      : notification,
  );
};

export const removeNotificationById = (notifications, notificationId) => {
  const removedNotificationId = toComparableId(notificationId);
  if (!removedNotificationId) return notifications;

  return notifications.filter(
    (notification) => getNotificationId(notification) !== removedNotificationId,
  );
};

export const buildMeetingPath = (meeting) => {
  const meetingId = toComparableId(meeting?.id || meeting?._id);
  return meetingId ? `/meetings/${meetingId}` : "/meetings";
};

export const formatMeetingDateTime = (
  dateStr,
  locale = "vi-VN",
  timeZone = "Asia/Bangkok",
) => {
  if (!dateStr) return "Đang hoạt động";

  const parts = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  })
    .formatToParts(new Date(dateStr))
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return `${parts.day}/${parts.month}/${parts.year}, ${parts.hour}:${parts.minute}`;
};
