const toRoomId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

export const getOrganizationRoomName = (organizationId) => {
  const id = toRoomId(organizationId);
  return id ? `organization:${id}` : "";
};

export const getOrganizationUserRoomName = (organizationId, userId) => {
  const targetOrganizationId = toRoomId(organizationId);
  const targetUserId = toRoomId(userId);

  return targetOrganizationId && targetUserId
    ? `organization:${targetOrganizationId}:user:${targetUserId}`
    : "";
};

export const getConversationRoomName = (conversationId, organizationId) => {
  const id = toRoomId(conversationId);
  const targetOrganizationId = toRoomId(organizationId);

  if (id && targetOrganizationId) {
    return `organization:${targetOrganizationId}:conversation:${id}`;
  }

  return id ? `conversation:${id}` : "";
};

export const getParticipantUserRoomNames = (conversation) => {
  const organizationId = conversation?.organizationId;

  return (conversation?.participants || [])
    .map((participant) => toRoomId(participant.userId))
    .filter(Boolean)
    .map((userId) =>
      getOrganizationUserRoomName(organizationId, userId) || `user:${userId}`,
    );
};

export const getConversationParticipantUserRoomName = (
  conversationId,
  userId,
  organizationId,
) => {
  const targetConversationId = toRoomId(conversationId);
  const targetUserId = toRoomId(userId);
  const targetOrganizationId = toRoomId(organizationId);

  if (targetConversationId && targetUserId && targetOrganizationId) {
    return `organization:${targetOrganizationId}:conversation:${targetConversationId}:user:${targetUserId}`;
  }

  return targetConversationId && targetUserId
    ? `conversation:${targetConversationId}:user:${targetUserId}`
    : "";
};

export const getConversationParticipantUserRoomNames = (conversation) => {
  const conversationId = conversation?._id || conversation?.id;
  const organizationId = conversation?.organizationId;

  return (conversation?.participants || [])
    .map((participant) =>
      getConversationParticipantUserRoomName(
        conversationId,
        participant.userId,
        organizationId,
      ),
    )
    .filter(Boolean);
};

export const getConversationRealtimeRoomNames = (conversation) => {
  const conversationRoom = getConversationRoomName(
    conversation?._id || conversation?.id,
    conversation?.organizationId,
  );
  return [
    conversationRoom,
    ...getParticipantUserRoomNames(conversation),
    ...getConversationParticipantUserRoomNames(conversation),
  ].filter(Boolean);
};

export const joinParticipantSocketsToConversationRoom = (io, conversation) => {
  const conversationRoom = getConversationRoomName(
    conversation?._id || conversation?.id,
    conversation?.organizationId,
  );
  if (!io || !conversationRoom) return conversationRoom;

  (conversation?.participants || []).forEach((participant) => {
    const participantUserId = toRoomId(participant.userId);
    if (!participantUserId) return;

    const userRoom =
      getOrganizationUserRoomName(conversation?.organizationId, participantUserId) ||
      `user:${participantUserId}`;
    const conversationUserRoom = getConversationParticipantUserRoomName(
      conversation?._id || conversation?.id,
      participantUserId,
      conversation?.organizationId,
    );

    io.in(userRoom).socketsJoin(conversationRoom);
    if (conversationUserRoom) {
      io.in(userRoom).socketsJoin(conversationUserRoom);
    }
  });

  return conversationRoom;
};
