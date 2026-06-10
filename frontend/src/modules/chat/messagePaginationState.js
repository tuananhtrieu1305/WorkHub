import { upsertMessageById } from "./realtimeMessageState.js";

export const MESSAGE_PAGE_SIZE = 50;

export const DEFAULT_MESSAGE_PAGE_STATE = Object.freeze({
  hasOlder: false,
  isLoadingOlder: false,
});

const toComparableId = (value) => {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || "");
  }
  return String(value);
};

const getMessageId = (message) => toComparableId(message?.id || message?._id);

const normalizeMessage = (message) => {
  const messageId = getMessageId(message);
  return messageId && !message?.id ? { ...message, id: messageId } : message;
};

const getMessageTime = (message) => {
  const time = new Date(message?.createdAt || 0).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
};

export const createMessagePageState = (state = {}) => ({
  hasOlder: Boolean(state?.hasOlder),
  isLoadingOlder: Boolean(state?.isLoadingOlder),
});

export const getCachedMessagePageState = (cache, conversationId) => {
  const targetConversationId = toComparableId(conversationId);
  if (!targetConversationId) return null;

  const cachedState = cache.get(targetConversationId);
  return cachedState ? createMessagePageState(cachedState) : null;
};

export const setCachedMessagePageState = (cache, conversationId, state = {}) => {
  const targetConversationId = toComparableId(conversationId);
  if (!targetConversationId) return cache;

  cache.set(targetConversationId, {
    hasOlder: Boolean(state?.hasOlder),
  });
  return cache;
};

export const getOldestMessageCursor = (messages = []) => {
  const oldestMessage = messages.reduce((oldest, message) => {
    const messageTime = getMessageTime(message);
    if (!Number.isFinite(messageTime)) return oldest;
    if (!oldest || messageTime < oldest.time) {
      return { message, time: messageTime };
    }
    return oldest;
  }, null);

  return oldestMessage?.message?.createdAt || "";
};

export const mergeMessagePage = (currentMessages = [], pageMessages = []) => {
  return pageMessages
    .filter(Boolean)
    .map(normalizeMessage)
    .reduce(
      (nextMessages, message) => upsertMessageById(nextMessages, message),
      currentMessages,
    );
};
