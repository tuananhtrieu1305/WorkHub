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

  getParticipantUserRoomNames(conversation).forEach((userRoom) => {
    io.in(userRoom).socketsJoin(conversationRoom);
  });

  return conversationRoom;
};
