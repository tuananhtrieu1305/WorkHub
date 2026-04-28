const toComparableId = (value) => {
  if (value == null) return "";
  return String(value);
};

const getParticipantUserId = (participant) => {
  return toComparableId(
    participant?.user?.id || participant?.user?._id || participant?.userId,
  );
};

const getParticipantUser = (participant) => {
  return participant?.user || null;
};

const getOtherParticipant = (participants = [], currentUserId) => {
  const currentId = toComparableId(currentUserId);
  return (
    participants.find((participant) => {
      const participantId = getParticipantUserId(participant);
      return participantId && participantId !== currentId;
    }) || participants.find((participant) => getParticipantUser(participant))
  );
};

export const getChatDetailDisplay = (conversation, currentUserId) => {
  if (!conversation) return null;

  const isPrivate = conversation.type === "private";
  const participantCount = conversation.participants?.length || 0;
  const otherParticipant = isPrivate
    ? getOtherParticipant(conversation.participants, currentUserId)
    : null;
  const otherUser = getParticipantUser(otherParticipant);
  const displayName = isPrivate
    ? otherUser?.fullName || "Người dùng"
    : conversation.name || "Nhóm";

  return {
    isPrivate,
    participantCount,
    user: otherUser,
    displayName,
    avatar: isPrivate ? otherUser?.avatar : conversation.avatar,
    email: isPrivate ? otherUser?.email : null,
    activityStatus: otherUser?.activityStatus,
    isOnline: otherUser?.isOnline,
    displayInitial: (displayName || "N").charAt(0).toUpperCase(),
  };
};
