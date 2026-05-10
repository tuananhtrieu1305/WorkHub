import { REACTION_OPTIONS, getReactionOption } from "./reactionOptions.js";

const REACTION_ORDER = new Map(
  REACTION_OPTIONS.map((reaction, index) => [reaction.type, index])
);

const getReactionOrder = (reactionType) =>
  REACTION_ORDER.has(reactionType) ? REACTION_ORDER.get(reactionType) : 999;

const normalizeReactionType = (reactionType, fallback = null) => {
  const normalized =
    typeof reactionType === "string" ? reactionType.trim().toLowerCase() : "";

  return REACTION_ORDER.has(normalized) ? normalized : fallback;
};

const getUserId = (user = {}) => user.id || user._id || "";

const getEntryUser = (entry = {}) => entry.user || entry.userId || entry;

const getEntryReactionType = (entry = {}, fallback = null) => {
  if (typeof entry === "string") {
    return normalizeReactionType(entry, fallback);
  }

  const nestedReaction =
    entry.reaction && typeof entry.reaction === "object" ? entry.reaction : null;
  const reactionType =
    entry.reactionType ||
    entry.type ||
    entry.reactionName ||
    nestedReaction?.reactionType ||
    nestedReaction?.type ||
    (typeof entry.reaction === "string" ? entry.reaction : null);

  return normalizeReactionType(reactionType, fallback);
};

const getReactionTime = (entry = {}) =>
  entry.reactedAt || entry.latestReactionAt || entry.updatedAt || entry.createdAt || "";

const getReactionTimestamp = (entry = {}) => {
  const time = getReactionTime(entry);
  if (!time) return 0;
  const timestamp = new Date(time).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const buildSummaryFromEntries = (entries = []) =>
  Array.from(
    entries.reduce((groups, entry) => {
      const reactionType = getEntryReactionType(entry);
      if (!reactionType) return groups;

      const timestamp = getReactionTimestamp(entry);
      const current = groups.get(reactionType) || {
        reactionType,
        count: 0,
        latestReactionAt: "",
        latestReactionTimestamp: 0,
      };

      current.count += 1;
      if (timestamp >= current.latestReactionTimestamp) {
        current.latestReactionTimestamp = timestamp;
        current.latestReactionAt = getReactionTime(entry);
      }

      groups.set(reactionType, current);
      return groups;
    }, new Map()).values()
  );

const normalizeSummaryItems = (items = []) =>
  items
    .map((item) => {
      const reactionType = getEntryReactionType(item);
      if (!reactionType) return null;

      return {
        reactionType,
        count: Number.isFinite(item.count) ? item.count : 0,
        latestReactionAt: item.latestReactionAt || item.reactedAt || "",
        latestReactionTimestamp: getReactionTimestamp(item),
      };
    })
    .filter(Boolean);

const mergeSummarySources = (...sources) => {
  const merged = new Map();

  sources.flat().forEach((item) => {
    if (!item?.reactionType || item.count <= 0) return;
    const current = merged.get(item.reactionType);

    if (!current) {
      merged.set(item.reactionType, { ...item });
      return;
    }

    current.count = Math.max(current.count, item.count);
    if ((item.latestReactionTimestamp || 0) > (current.latestReactionTimestamp || 0)) {
      current.latestReactionTimestamp = item.latestReactionTimestamp;
      current.latestReactionAt = item.latestReactionAt;
    }
  });

  return Array.from(merged.values());
};

export const getCommentReactionParticipants = (comment = {}) => {
  const reactionEntries = Array.isArray(comment.reactions) ? comment.reactions : [];
  const likedByEntries = Array.isArray(comment.likedBy) ? comment.likedBy : [];
  const source =
    reactionEntries.length >= likedByEntries.length
      ? reactionEntries
      : likedByEntries;

  return source
    .map((entry) => {
      const user = getEntryUser(entry);
      const reactionType = getEntryReactionType(entry);
      if (!reactionType) return null;

      const reaction = getReactionOption(reactionType);

      return {
        id: getUserId(user),
        fullName: user?.fullName || "Người dùng",
        email: user?.email || "",
        avatar: user?.avatar || "",
        reactionType,
        reactionLabel: reaction.label,
        reactionEmoji: reaction.emoji,
        reactedAt: getReactionTime(entry),
      };
    })
    .filter(
      (participant) =>
        participant && (participant.id || participant.fullName)
    );
};

export const getCommentReactionSummary = (comment = {}, maxItems = 3) => {
  const detailedReactionSummary = Array.isArray(comment.reactions)
    ? buildSummaryFromEntries(comment.reactions)
    : [];
  const likedByReactionSummary = Array.isArray(comment.likedBy)
    ? buildSummaryFromEntries(comment.likedBy)
    : [];
  const explicitSummary = Array.isArray(comment.reactionSummary)
    ? normalizeSummaryItems(comment.reactionSummary)
    : [];

  const participantSummary =
    explicitSummary.length ||
    detailedReactionSummary.length ||
    likedByReactionSummary.length
      ? []
      : Array.from(
          getCommentReactionParticipants(comment).reduce((groups, participant) => {
            const current = groups.get(participant.reactionType) || {
              reactionType: participant.reactionType,
              count: 0,
              latestReactionAt: "",
              latestReactionTimestamp: 0,
            };
            const timestamp = getReactionTimestamp(participant);
            current.count += 1;
            if (timestamp >= current.latestReactionTimestamp) {
              current.latestReactionTimestamp = timestamp;
              current.latestReactionAt = getReactionTime(participant);
            }
            groups.set(participant.reactionType, current);
            return groups;
          }, new Map()).values()
        );

  const summary = mergeSummarySources(
    explicitSummary,
    detailedReactionSummary,
    likedByReactionSummary,
    participantSummary
  );

  if (summary.length === 0 && (comment.likesCount || 0) > 0) {
    const fallbackReactionType = getEntryReactionType(comment, "like");
    summary.push({
      reactionType: fallbackReactionType,
      count: comment.likesCount,
      latestReactionAt: "",
      latestReactionTimestamp: 0,
    });
  }

  return summary
    .filter((item) => item.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      if (right.latestReactionTimestamp !== left.latestReactionTimestamp) {
        return right.latestReactionTimestamp - left.latestReactionTimestamp;
      }
      return getReactionOrder(left.reactionType) - getReactionOrder(right.reactionType);
    })
    .slice(0, maxItems)
    .map((item) => {
      const reaction = getReactionOption(item.reactionType);
      return {
        ...item,
        label: reaction.label,
        emoji: reaction.emoji,
      };
    });
};

export const getCommentReactionTotal = (comment = {}) => {
  if (Number.isFinite(comment.likesCount)) return comment.likesCount;
  return getCommentReactionParticipants(comment).length;
};
