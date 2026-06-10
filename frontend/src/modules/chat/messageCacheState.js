const toComparableId = (value) => {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || "");
  }
  return String(value);
};

export const getCachedMessages = (cache, conversationId) => {
  const targetConversationId = toComparableId(conversationId);
  if (!targetConversationId) return null;

  const cachedMessages = cache.get(targetConversationId);
  return Array.isArray(cachedMessages) ? cachedMessages : null;
};

export const setCachedMessages = (cache, conversationId, messages = []) => {
  const targetConversationId = toComparableId(conversationId);
  if (!targetConversationId) return cache;

  cache.set(targetConversationId, [...messages]);
  return cache;
};

export const updateCachedMessages = (cache, conversationId, updater) => {
  const targetConversationId = toComparableId(conversationId);
  if (!targetConversationId || typeof updater !== "function") return cache;

  const cachedMessages = getCachedMessages(cache, targetConversationId);
  if (!cachedMessages) return cache;

  setCachedMessages(cache, targetConversationId, updater(cachedMessages));
  return cache;
};

export const areMessagesForConversation = (
  messagesConversationId,
  selectedConversationId,
) => {
  const ownerConversationId = toComparableId(messagesConversationId);
  const targetConversationId = toComparableId(selectedConversationId);

  return Boolean(targetConversationId) && ownerConversationId === targetConversationId;
};

export const getVisibleMessagesForConversation = (
  messages,
  messagesConversationId,
  selectedConversationId,
) => {
  return areMessagesForConversation(
    messagesConversationId,
    selectedConversationId,
  )
    ? messages
    : [];
};
