const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

export const getMessageMenuActions = ({
  currentUserId,
  senderId,
  isDeleted = false,
  isPinned = false,
} = {}) => {
  if (isDeleted) return [];

  const pinAction = isPinned ? "unpin" : "pin";
  const isSender = toComparableId(currentUserId) === toComparableId(senderId);

  return isSender
    ? ["copy", "edit", "recall", pinAction]
    : ["copy", pinAction];
};

export const normalizePinnedState = (isPinned) => {
  if (typeof isPinned !== "boolean") {
    throw new Error("isPinned must be a boolean");
  }

  return isPinned;
};
