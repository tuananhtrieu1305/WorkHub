const toComparableId = (value) => {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || "");
  }
  return String(value);
};

const getLastMessageId = (conversation) => {
  const lastMessage = conversation?.lastMessage || {};
  return toComparableId(lastMessage.id || lastMessage._id || lastMessage.messageId);
};

const getLastMessageSenderId = (conversation) => {
  const lastMessage = conversation?.lastMessage || {};
  return toComparableId(
    lastMessage.senderId || lastMessage.sender?.id || lastMessage.sender?._id,
  );
};

const getParticipantUserId = (participant) => {
  return toComparableId(
    participant?.userId || participant?.user?.id || participant?.user?._id,
  );
};

const getCurrentParticipant = (conversation, currentUserId) => {
  const currentId = toComparableId(currentUserId);
  if (!currentId) return null;

  return (conversation?.participants || []).find(
    (participant) => getParticipantUserId(participant) === currentId,
  );
};

export const conversationHasUnread = (conversation, currentUserId) => {
  if (!conversation) return false;
  if (typeof conversation.hasUnread === "boolean") return conversation.hasUnread;
  if (typeof conversation.unread === "boolean") return conversation.unread;

  const unreadCount = Number(conversation.unreadCount);
  if (Number.isFinite(unreadCount) && unreadCount > 0) return true;

  const lastMessageSenderId = getLastMessageSenderId(conversation);
  const currentId = toComparableId(currentUserId);
  if (!lastMessageSenderId || !currentId || lastMessageSenderId === currentId) {
    return false;
  }

  const lastMessageId = getLastMessageId(conversation);
  if (!lastMessageId) return false;

  const currentParticipant = getCurrentParticipant(conversation, currentUserId);
  const lastReadMessageId = toComparableId(currentParticipant?.lastReadMessageId);

  return lastReadMessageId !== lastMessageId;
};

export const getConversationTabItems = (
  conversations = [],
  activeTab = "all",
  currentUserId,
) => {
  if (activeTab === "groups") {
    return conversations.filter((conversation) => conversation.type === "group");
  }

  if (activeTab === "unread") {
    return conversations.filter((conversation) =>
      conversationHasUnread(conversation, currentUserId),
    );
  }

  return conversations;
};
