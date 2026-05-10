const toComparableId = (value) => {
  if (value == null) return "";
  return String(value);
};

const getMessageTime = (message) => {
  const time = new Date(message?.createdAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const sortMessagesByCreatedAt = (messages) => {
  return [...messages].sort((a, b) => getMessageTime(a) - getMessageTime(b));
};

export const upsertMessageById = (messages, incomingMessage) => {
  if (!incomingMessage?.id) return messages;

  const incomingId = toComparableId(incomingMessage.id);
  const existingIndex = messages.findIndex(
    (message) => toComparableId(message.id) === incomingId
  );

  if (existingIndex === -1) {
    return sortMessagesByCreatedAt([...messages, incomingMessage]);
  }

  const nextMessages = [...messages];
  nextMessages[existingIndex] = {
    ...nextMessages[existingIndex],
    ...incomingMessage,
  };

  return sortMessagesByCreatedAt(nextMessages);
};

export const removeMessageById = (messages, messageId) => {
  const removedId = toComparableId(messageId);
  return messages.filter((message) => toComparableId(message.id) !== removedId);
};

export const addReactionToMessages = (
  messages,
  { messageId, userId, reaction }
) => {
  const targetMessageId = toComparableId(messageId);
  const targetUserId = toComparableId(userId);

  return messages.map((message) => {
    if (toComparableId(message.id) !== targetMessageId) return message;

    const reactions = message.reactions || [];
    const hasReaction = reactions.some(
      (item) =>
        toComparableId(item.userId) === targetUserId &&
        item.reaction === reaction
    );

    if (hasReaction) return message;

    return {
      ...message,
      reactions: [...reactions, { userId, reaction }],
    };
  });
};

export const removeReactionFromMessages = (
  messages,
  { messageId, userId, reaction }
) => {
  const targetMessageId = toComparableId(messageId);
  const targetUserId = toComparableId(userId);

  return messages.map((message) => {
    if (toComparableId(message.id) !== targetMessageId) return message;

    return {
      ...message,
      reactions: (message.reactions || []).filter(
        (item) =>
          !(
            toComparableId(item.userId) === targetUserId &&
            item.reaction === reaction
          )
      ),
    };
  });
};

export const updateTypingUsers = (typingUsers, typingEvent) => {
  const { conversationId, userId, fullName, isTyping } = typingEvent || {};
  if (!conversationId || !userId) return typingUsers;

  const targetConversationId = toComparableId(conversationId);
  const targetUserId = toComparableId(userId);
  const withoutUser = typingUsers.filter(
    (user) =>
      toComparableId(user.conversationId) !== targetConversationId ||
      toComparableId(user.userId) !== targetUserId
  );

  if (!isTyping) return withoutUser;

  return [
    ...withoutUser,
    {
      conversationId,
      userId,
      fullName,
    },
  ];
};

export const updateConversationParticipantStatus = (
  conversations,
  { userId, activityStatus, activityStatusExpiresAt, isOnline, fullName, avatar }
) => {
  const targetUserId = toComparableId(userId);
  if (!targetUserId || !activityStatus) return conversations;

  return conversations.map((conversation) => ({
    ...conversation,
    participants: (conversation.participants || []).map((participant) => {
      const participantUserId =
        participant.user?._id || participant.user?.id || participant.userId;

      if (toComparableId(participantUserId) !== targetUserId) {
        return participant;
      }

      return {
        ...participant,
        user: {
          ...(participant.user || {}),
          activityStatus,
          activityStatusExpiresAt,
          isOnline,
          ...(fullName ? { fullName } : {}),
          ...(avatar !== undefined ? { avatar } : {}),
        },
      };
    }),
  }));
};

const getConversationId = (conversation) => {
  return toComparableId(conversation?.id || conversation?._id);
};

const getMessageSenderId = (message) => {
  return toComparableId(message?.sender?._id || message?.sender?.id || message?.senderId);
};

const sortConversationsByUpdatedAt = (conversations) => {
  return [...conversations].sort((a, b) => {
    const aTime = new Date(a?.updatedAt || 0).getTime();
    const bTime = new Date(b?.updatedAt || 0).getTime();
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
};

export const markConversationAsRead = (conversations, conversationId) => {
  const targetConversationId = toComparableId(conversationId);
  if (!targetConversationId) return conversations;

  return conversations.map((conversation) => {
    if (getConversationId(conversation) !== targetConversationId) {
      return conversation;
    }

    return {
      ...conversation,
      hasUnread: false,
      unreadCount: 0,
    };
  });
};

export const upsertConversationById = (conversations, incomingConversation) => {
  const incomingConversationId = getConversationId(incomingConversation);
  if (!incomingConversationId) return conversations;

  const existingIndex = conversations.findIndex(
    (conversation) => getConversationId(conversation) === incomingConversationId
  );

  if (existingIndex === -1) {
    return sortConversationsByUpdatedAt([
      {
        ...incomingConversation,
        id:
          incomingConversation.id ||
          incomingConversation._id ||
          incomingConversationId,
      },
      ...conversations,
    ]);
  }

  const nextConversations = [...conversations];
  nextConversations[existingIndex] = {
    ...nextConversations[existingIndex],
    ...incomingConversation,
    id:
      incomingConversation.id ||
      incomingConversation._id ||
      getConversationId(nextConversations[existingIndex]),
  };

  return sortConversationsByUpdatedAt(nextConversations);
};

export const updateConversationPreview = (
  conversations,
  message,
  { currentUserId, selectedConversationId } = {},
) => {
  const conversationId = toComparableId(message?.conversationId);
  if (!conversationId) return conversations;

  const incomingConversation = message?.conversation;
  const conversationsWithIncoming =
    !incomingConversation
      ? conversations
      : upsertConversationById(conversations, incomingConversation);

  const nextConversations = conversationsWithIncoming.map((conversation) => {
    if (getConversationId(conversation) !== conversationId) return conversation;

    const createdAt = message.createdAt || new Date().toISOString();
    const content =
      message.content ||
      (message.attachments?.length > 0 ? "[Attachment]" : "");
    const senderId = getMessageSenderId(message);
    const isSentByCurrentUser =
      currentUserId && senderId === toComparableId(currentUserId);
    const isSelectedConversation =
      selectedConversationId &&
      conversationId === toComparableId(selectedConversationId);

    return {
      ...conversation,
      lastMessage: {
        id: message.id || message._id,
        content,
        senderId,
        createdAt,
      },
      updatedAt: createdAt,
      hasUnread:
        isSentByCurrentUser || isSelectedConversation
          ? false
          : Boolean(senderId) || conversation.hasUnread,
    };
  });

  return sortConversationsByUpdatedAt(nextConversations);
};
