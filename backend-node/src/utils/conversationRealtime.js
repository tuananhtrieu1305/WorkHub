const toRoomId = (value) => {
  if (value == null) return "";
  return String(value);
};

export const getConversationRoomName = (conversationId) => {
  const id = toRoomId(conversationId);
  return id ? `conversation:${id}` : "";
};

export const getParticipantUserRoomNames = (conversation) => {
  return (conversation?.participants || [])
    .map((participant) => toRoomId(participant.userId))
    .filter(Boolean)
    .map((userId) => `user:${userId}`);
};

export const getConversationParticipantUserRoomName = (
  conversationId,
  userId,
) => {
  const targetConversationId = toRoomId(conversationId);
  const targetUserId = toRoomId(userId);

  return targetConversationId && targetUserId
    ? `conversation:${targetConversationId}:user:${targetUserId}`
    : "";
};

export const getConversationParticipantUserRoomNames = (conversation) => {
  const conversationId = conversation?._id || conversation?.id;

  return (conversation?.participants || [])
    .map((participant) =>
      getConversationParticipantUserRoomName(conversationId, participant.userId),
    )
    .filter(Boolean);
};

export const getConversationRealtimeRoomNames = (conversation) => {
  const conversationRoom = getConversationRoomName(conversation?._id || conversation?.id);
  return [
    conversationRoom,
    ...getParticipantUserRoomNames(conversation),
  ].filter(Boolean);
};

export const joinParticipantSocketsToConversationRoom = (io, conversation) => {
  const conversationRoom = getConversationRoomName(conversation?._id || conversation?.id);
  if (!io || !conversationRoom) return conversationRoom;

  (conversation?.participants || []).forEach((participant) => {
    const participantUserId = toRoomId(participant.userId);
    if (!participantUserId) return;

    const userRoom = `user:${participantUserId}`;
    const conversationUserRoom = getConversationParticipantUserRoomName(
      conversation?._id || conversation?.id,
      participantUserId,
    );

    io.in(userRoom).socketsJoin(conversationRoom);
    if (conversationUserRoom) {
      io.in(userRoom).socketsJoin(conversationUserRoom);
    }
  });

  return conversationRoom;
};
