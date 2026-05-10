export const REACTION_TYPES = [
  "like",
  "love",
  "care",
  "haha",
  "wow",
  "sad",
  "angry",
];

export const DEFAULT_REACTION_TYPE = "like";

export const normalizeReactionType = (reactionType = DEFAULT_REACTION_TYPE) => {
  const normalized =
    typeof reactionType === "string"
      ? reactionType.trim().toLowerCase()
      : DEFAULT_REACTION_TYPE;

  if (!REACTION_TYPES.includes(normalized)) {
    throw new Error(`Unsupported reaction type: ${reactionType}`);
  }

  return normalized;
};

export const getLikeReactionType = (like) =>
  normalizeReactionType(like?.reactionType || DEFAULT_REACTION_TYPE);

export const getReactionTogglePlan = ({
  existingReactionType,
  requestedReactionType,
} = {}) => {
  const nextReactionType = normalizeReactionType(requestedReactionType);

  if (!existingReactionType) {
    return {
      action: "create",
      liked: true,
      reactionType: nextReactionType,
      countDelta: 1,
    };
  }

  const currentReactionType = normalizeReactionType(existingReactionType);

  if (currentReactionType === nextReactionType) {
    return {
      action: "delete",
      liked: false,
      reactionType: null,
      countDelta: -1,
    };
  }

  return {
    action: "update",
    liked: true,
    reactionType: nextReactionType,
    countDelta: 0,
  };
};

export const isReactionTypeError = (error) =>
  error instanceof Error &&
  error.message.startsWith("Unsupported reaction type:");
