export const SOCIAL_NOTIFICATION_TYPES = new Set([
  "post_reaction",
  "post_comment",
  "comment_reaction",
  "comment_reply",
]);

export const MENTION_NOTIFICATION_TYPES = new Set([
  "post_mention",
  "chat_mention",
]);

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

export const uniqueIdList = (values = [], { exclude = [] } = {}) => {
  const excludedIds = new Set(
    (Array.isArray(exclude) ? exclude : [exclude])
      .map(toComparableId)
      .filter(Boolean),
  );
  const seen = new Set();

  return (Array.isArray(values) ? values : [values])
    .map(toComparableId)
    .filter((id) => {
      if (!id || excludedIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
};

export const isMentionNotificationType = (type) =>
  MENTION_NOTIFICATION_TYPES.has(String(type || ""));

export const isSocialNotificationType = (type) =>
  SOCIAL_NOTIFICATION_TYPES.has(String(type || ""));

export const buildActorPrefix = (actorName, actorCount = 1) => {
  const safeName = String(actorName || "Ai đó").trim() || "Ai đó";
  const otherCount = Math.max(Number(actorCount) || 1, 1) - 1;
  if (otherCount <= 0) return safeName;
  return `${safeName} và ${otherCount} người khác`;
};

export const buildAggregatedNotificationCopy = ({
  type,
  actorName,
  actorCount = 1,
  data = {},
} = {}) => {
  const prefix = buildActorPrefix(actorName, actorCount);
  const postLabel = data.postLabel || "bài viết của bạn";
  const commentLabel = data.commentLabel || "bình luận của bạn";
  const conversationName = data.conversationName || "cuộc trò chuyện";

  if (type === "post_reaction") {
    return {
      title: "Bài viết có tương tác mới",
      message: `${prefix} đã bày tỏ cảm xúc về ${postLabel}.`,
    };
  }

  if (type === "post_comment") {
    return {
      title: "Bài viết có bình luận mới",
      message: `${prefix} đã bình luận về ${postLabel}.`,
    };
  }

  if (type === "comment_reaction") {
    return {
      title: "Bình luận có tương tác mới",
      message: `${prefix} đã bày tỏ cảm xúc về ${commentLabel}.`,
    };
  }

  if (type === "comment_reply") {
    return {
      title: "Luồng phản hồi có trả lời mới",
      message: `${prefix} đã trả lời trong một luồng bình luận bạn tham gia.`,
    };
  }

  if (type === "post_mention") {
    return {
      title: "Bạn được gắn thẻ trong bài viết",
      message: `${prefix} đã gắn thẻ bạn trong một bài viết.`,
    };
  }

  if (type === "chat_mention") {
    const mentionLabel = data.mentionEveryone ? "@mọi người" : "bạn";
    return {
      title: "Bạn được đề cập trong tin nhắn",
      message: `${prefix} đã nhắc ${mentionLabel} trong ${conversationName}.`,
    };
  }

  return {
    title: data.title || "Thông báo mới",
    message: data.message || `${prefix} đã tạo một cập nhật mới.`,
  };
};
