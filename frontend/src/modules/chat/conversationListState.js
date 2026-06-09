import { getMessagePreviewText } from "./chatMessagePreview";

const toComparableId = (value) => {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || "");
  }
  return String(value);
};

const toTimestamp = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

export const getConversationActivityTime = (conversation) => {
  return (
    toTimestamp(conversation?.lastActivityAt) ||
    toTimestamp(conversation?.lastMessage?.createdAt) ||
    toTimestamp(conversation?.createdAt) ||
    toTimestamp(conversation?.updatedAt)
  );
};

export const sortConversationsByActivity = (conversations = []) => {
  return [...conversations].sort((a, b) => {
    const timeDiff =
      getConversationActivityTime(b) - getConversationActivityTime(a);
    if (timeDiff !== 0) return timeDiff;

    return toComparableId(b?.id || b?._id).localeCompare(
      toComparableId(a?.id || a?._id),
    );
  });
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

const getLastMessageDeletedById = (conversation) => {
  const lastMessage = conversation?.lastMessage || {};
  return toComparableId(
    lastMessage.deletedBy ||
      lastMessage.deletedByUser?.id ||
      lastMessage.deletedByUser?._id,
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

const getParticipantName = (conversation, userId) => {
  const targetId = toComparableId(userId);
  const participant = (conversation?.participants || []).find(
    (item) => getParticipantUserId(item) === targetId,
  );

  return participant?.user?.fullName || "Người dùng";
};

export const getDeletedMessageLabel = (conversation, currentUserId) => {
  const deletedById =
    getLastMessageDeletedById(conversation) || getLastMessageSenderId(conversation);

  if (deletedById && deletedById === toComparableId(currentUserId)) {
    return "Bạn đã gỡ tin nhắn này";
  }

  return `${getParticipantName(conversation, deletedById)} đã gỡ tin nhắn này`;
};

export const getConversationPreview = (conversation, currentUserId) => {
  const lastMessage = conversation?.lastMessage;
  if (!lastMessage) {
    return { content: "", isDeleted: false, isMine: false };
  }

  const isDeleted = Boolean(lastMessage.deletedAt);
  if (isDeleted) {
    return {
      content: getDeletedMessageLabel(conversation, currentUserId),
      isDeleted: true,
      isMine: false,
    };
  }

  return {
    content: getMessagePreviewText(lastMessage, { emptyText: "" }),
    isDeleted: false,
    isMine: getLastMessageSenderId(conversation) === toComparableId(currentUserId),
  };
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
  const sortedConversations = sortConversationsByActivity(conversations);

  if (activeTab === "groups") {
    return sortedConversations.filter(
      (conversation) => conversation.type === "group",
    );
  }

  if (activeTab === "unread") {
    return sortedConversations.filter((conversation) =>
      conversationHasUnread(conversation, currentUserId),
    );
  }

  return sortedConversations;
};
