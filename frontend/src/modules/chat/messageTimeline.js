const TIGHT_MESSAGE_GAP_MS = 2 * 60 * 1000;
const TIME_SEPARATOR_GAP_MS = 20 * 60 * 1000;

const getComparableId = (value) => {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || "");
  }
  return String(value);
};

const getMessageId = (message, index) => {
  return getComparableId(message?.id || message?._id) || `message-${index}`;
};

const getMessageSenderId = (message) => {
  return getComparableId(
    message?.sender?._id || message?.sender?.id || message?.senderId,
  );
};

const toValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isSameCalendarDay = (date, otherDate) => {
  return (
    date.getFullYear() === otherDate.getFullYear() &&
    date.getMonth() === otherDate.getMonth() &&
    date.getDate() === otherDate.getDate()
  );
};

const formatClockTime = (date) => {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
};

export const getHoverTimestampPlacement = (isMine) =>
  isMine ? "right" : "left";

export const formatMessageTimestamp = (dateValue, { now = new Date() } = {}) => {
  const date = toValidDate(dateValue);
  const referenceDate = toValidDate(now) || new Date();
  if (!date) return "";

  const time = formatClockTime(date);
  if (isSameCalendarDay(date, referenceDate)) {
    return time;
  }

  return `${time} ${date.getDate()} Tháng ${date.getMonth() + 1}, ${date.getFullYear()}`;
};

const formatTimeSeparatorLabel = (
  dateValue,
  { now = new Date() } = {},
) => formatMessageTimestamp(dateValue, { now });

export const buildMessageTimeline = (messages = [], { now = new Date() } = {}) => {
  const timeline = [];

  messages.forEach((message, index) => {
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const messageDate = toValidDate(message?.createdAt);
    const previousDate = toValidDate(previousMessage?.createdAt);
    const nextDate = toValidDate(nextMessage?.createdAt);
    const elapsedMs =
      messageDate && previousDate ? messageDate.getTime() - previousDate.getTime() : null;
    const nextElapsedMs =
      messageDate && nextDate ? nextDate.getTime() - messageDate.getTime() : null;
    const isSystemMessage = message?.type === "system";
    const isPreviousSystemMessage = previousMessage?.type === "system";
    const isNextSystemMessage = nextMessage?.type === "system";
    const hasTimeSeparator =
      !previousMessage ||
      elapsedMs == null ||
      elapsedMs < 0 ||
      elapsedMs >= TIME_SEPARATOR_GAP_MS;
    const nextHasTimeSeparator =
      !nextMessage ||
      nextElapsedMs == null ||
      nextElapsedMs < 0 ||
      nextElapsedMs >= TIME_SEPARATOR_GAP_MS;
    const isSameSender =
      previousMessage &&
      !isPreviousSystemMessage &&
      !isSystemMessage &&
      getMessageSenderId(previousMessage) === getMessageSenderId(message);
    const isSameNextSender =
      nextMessage &&
      !isNextSystemMessage &&
      !isSystemMessage &&
      getMessageSenderId(nextMessage) === getMessageSenderId(message);
    const isTightGroup =
      !hasTimeSeparator &&
      isSameSender &&
      elapsedMs >= 0 &&
      elapsedMs <= TIGHT_MESSAGE_GAP_MS;
    const hasTightNext =
      !nextHasTimeSeparator &&
      isSameNextSender &&
      nextElapsedMs >= 0 &&
      nextElapsedMs <= TIGHT_MESSAGE_GAP_MS;
    const spacing =
      hasTimeSeparator
        ? "after-separator"
        : isSameSender
          ? isTightGroup
            ? "tight"
            : "relaxed"
          : "default";
    const messageId = getMessageId(message, index);
    const timestampLabel = formatMessageTimestamp(message?.createdAt, { now });

    if (hasTimeSeparator) {
      timeline.push({
        type: "separator",
        id: `separator-${messageId}`,
        label: formatTimeSeparatorLabel(message?.createdAt, { now }),
      });
    }

    timeline.push({
      type: "message",
      id: messageId,
      message,
      spacing,
      showSenderHeader: hasTimeSeparator || !isSameSender,
      showAvatar: !nextMessage || nextHasTimeSeparator || !isSameNextSender,
      hasTightNext,
      timestampLabel,
    });
  });

  return timeline;
};
