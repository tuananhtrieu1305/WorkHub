const getUserId = (user) => String(user?.id || user?._id || "");

const buildFallbackGroupName = (selectedUsers) => {
  return selectedUsers
    .map((user) => user?.fullName || user?.email || "")
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
};

export const toggleSelectedUser = (selectedUsers, user, type) => {
  const userId = getUserId(user);
  if (!userId) return selectedUsers;

  const isSelected = selectedUsers.some((item) => getUserId(item) === userId);
  if (type === "private") {
    return isSelected ? [] : [user];
  }

  if (isSelected) {
    return selectedUsers.filter((item) => getUserId(item) !== userId);
  }

  return [...selectedUsers, user];
};

export const buildConversationPayload = ({
  type,
  groupName,
  selectedUsers,
}) => {
  const participantIds = selectedUsers.map(getUserId).filter(Boolean);

  if (type === "group") {
    return {
      type,
      name: groupName.trim() || buildFallbackGroupName(selectedUsers),
      participantIds,
    };
  }

  return {
    type: "private",
    participantIds: participantIds.slice(0, 1),
  };
};

export const canCreateConversation = (type, groupName, selectedUsers) => {
  if (!selectedUsers.length) return false;
  if (type === "group") {
    return selectedUsers.length >= 2;
  }
  return true;
};
