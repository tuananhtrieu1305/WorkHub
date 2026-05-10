export const buildReactionStateFromPost = (post = {}) => {
  const isLiked = !!post.isLiked;
  return {
    isLiked,
    reactionType: isLiked ? post.reactionType || "like" : null,
    likesCount: Number.isFinite(post.likesCount) ? post.likesCount : 0,
  };
};

export const buildOptimisticReactionState = ({
  isLiked,
  reactionType,
  likesCount = 0,
  nextReactionType,
}) => {
  const previousReactionType = reactionType || (isLiked ? "like" : null);
  const willRemove = isLiked && previousReactionType === nextReactionType;

  return {
    isLiked: !willRemove,
    reactionType: willRemove ? null : nextReactionType,
    likesCount: Math.max(
      0,
      likesCount + (!isLiked ? 1 : willRemove ? -1 : 0)
    ),
  };
};

export const mergeReactionResponse = ({
  response,
  requestedReactionType,
  optimisticState,
}) => {
  const responseHasLiked = typeof response?.liked === "boolean";
  const isLiked = responseHasLiked ? response.liked : optimisticState.isLiked;
  const responseCount = Number.isFinite(response?.likesCount)
    ? response.likesCount
    : optimisticState.likesCount;

  return {
    isLiked,
    reactionType: isLiked
      ? response?.reactionType || requestedReactionType || optimisticState.reactionType
      : null,
    likesCount: responseCount,
  };
};
