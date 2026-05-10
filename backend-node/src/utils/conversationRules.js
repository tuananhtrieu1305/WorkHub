export const getUniqueParticipantIds = (currentUserId, participantIds = []) => {
  return [
    ...new Set(
      [currentUserId, ...participantIds]
        .filter((id) => id != null)
        .map((id) => id.toString()),
    ),
  ];
};

export const hasMinimumGroupParticipantCount = (participantIds = []) => {
  return participantIds.length >= 3;
};
