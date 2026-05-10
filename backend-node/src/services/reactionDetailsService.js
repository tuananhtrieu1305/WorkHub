import Like from "../models/Like.js";
import User from "../models/User.js";
import {
  REACTION_TYPES,
  getLikeReactionType,
} from "./reactionService.js";

const REACTION_ORDER = new Map(
  REACTION_TYPES.map((reactionType, index) => [reactionType, index])
);

const serializeReactionUser = (user) => ({
  _id: user._id,
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  avatar: user.avatar,
});

const getReactionTime = (like = {}) => like.updatedAt || like.createdAt || null;

const getReactionTimestamp = (like = {}) => {
  const time = getReactionTime(like);
  if (!time) return 0;
  const timestamp = new Date(time).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const buildReactionSummaryFromTypes = (reactionTypes = []) =>
  Array.from(
    reactionTypes.reduce((groups, reactionType) => {
      const count = groups.get(reactionType) || 0;
      groups.set(reactionType, count + 1);
      return groups;
    }, new Map()),
    ([reactionType, count]) => ({ reactionType, count })
  ).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return (
      (REACTION_ORDER.get(left.reactionType) ?? 999) -
      (REACTION_ORDER.get(right.reactionType) ?? 999)
    );
  });

export const buildReactionSummaryFromLikes = (likes = []) =>
  Array.from(
    likes.reduce((groups, like) => {
      const reactionType = getLikeReactionType(like);
      const timestamp = getReactionTimestamp(like);
      const current = groups.get(reactionType) || {
        reactionType,
        count: 0,
        latestReactionAt: null,
        latestReactionTimestamp: 0,
      };

      current.count += 1;
      if (timestamp >= current.latestReactionTimestamp) {
        current.latestReactionTimestamp = timestamp;
        current.latestReactionAt = getReactionTime(like);
      }

      groups.set(reactionType, current);
      return groups;
    }, new Map()).values()
  )
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      if (right.latestReactionTimestamp !== left.latestReactionTimestamp) {
        return right.latestReactionTimestamp - left.latestReactionTimestamp;
      }
      return (
        (REACTION_ORDER.get(left.reactionType) ?? 999) -
        (REACTION_ORDER.get(right.reactionType) ?? 999)
      );
    })
    .map(({ latestReactionTimestamp, ...item }) => item);

export const getReactionDetailsForTarget = async (targetType, targetId) => {
  const likes = await Like.find({ targetType, targetId }).sort({
    updatedAt: -1,
    createdAt: -1,
  });
  const userIds = likes.map((like) => like.userId);
  const users = await User.find({ _id: { $in: userIds } }).select(
    "_id fullName email avatar"
  );
  const userById = new Map(
    users.map((user) => [user._id.toString(), serializeReactionUser(user)])
  );

  const reactions = likes
    .map((like) => {
      const user = userById.get(like.userId.toString());
      if (!user) return null;

      return {
        user,
        reactionType: getLikeReactionType(like),
        createdAt: like.createdAt,
        updatedAt: like.updatedAt,
        reactedAt: getReactionTime(like),
      };
    })
    .filter(Boolean);

  return {
    reactionSummary: buildReactionSummaryFromLikes(likes),
    reactions,
  };
};
