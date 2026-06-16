import Comment from "../models/Comment.js";
import OrganizationMember from "../models/OrganizationMember.js";
import {
  notifyUsersAggregated,
  upsertAggregatedNotification,
} from "./notificationService.js";
import {
  buildAggregatedNotificationCopy,
  uniqueIdList,
} from "../utils/notificationPolicy.js";

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

const getActorName = (actor) =>
  String(actor?.fullName || actor?.name || "Ai đó").trim() || "Ai đó";

const getActorId = (actor) => actor?._id || actor?.id || actor;

const getPostId = (post) => post?._id || post?.id;

const getCommentId = (comment) => comment?._id || comment?.id;

const previewText = (value = "", maxLength = 140) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
};

const filterActiveOrganizationUsers = async (userIds, organizationId) => {
  const uniqueUserIds = uniqueIdList(userIds);
  if (!organizationId || uniqueUserIds.length === 0) return uniqueUserIds;

  const memberships = await OrganizationMember.find({
    organizationId,
    userId: { $in: uniqueUserIds },
    status: "active",
  }).select("userId");

  return uniqueIdList(memberships.map((membership) => membership.userId));
};

const buildCopy = (type, data = {}) => (context) =>
  buildAggregatedNotificationCopy({
    type,
    data,
    ...context,
  });

export const notifyPostMention = async ({ post, actor }) => {
  const postId = getPostId(post);
  const actorId = getActorId(actor);
  const recipients = await filterActiveOrganizationUsers(
    uniqueIdList(post?.mentions || [], { exclude: actorId }),
    post?.organizationId,
  );
  if (!postId || recipients.length === 0) return [];

  return notifyUsersAggregated(recipients, {
    organizationId: post.organizationId || null,
    type: "post_mention",
    title: "Bạn được gắn thẻ trong bài viết",
    message: `${getActorName(actor)} đã gắn thẻ bạn trong một bài viết.`,
    entityType: "post",
    entityId: postId,
    actorId,
    actorName: getActorName(actor),
    aggregationKey: `post:${postId}:mentions`,
    isMention: true,
    buildCopy: buildCopy("post_mention", {}),
    data: {
      postId,
      actorName: getActorName(actor),
      contentPreview: previewText(post?.content),
      route: "/",
    },
  });
};

export const notifyPostReaction = async ({ post, actor, reactionType }) => {
  const postId = getPostId(post);
  const actorId = getActorId(actor);
  const postAuthorId = post?.authorId;
  const recipientId = toComparableId(postAuthorId);
  if (!postId || !recipientId || recipientId === toComparableId(actorId)) {
    return null;
  }

  return upsertAggregatedNotification({
    userId: postAuthorId,
    organizationId: post.organizationId || null,
    type: "post_reaction",
    title: "Bài viết có tương tác mới",
    message: `${getActorName(actor)} đã bày tỏ cảm xúc về bài viết của bạn.`,
    entityType: "post",
    entityId: postId,
    actorId,
    actorName: getActorName(actor),
    aggregationKey: `post:${postId}:reactions`,
    buildCopy: buildCopy("post_reaction", {}),
    data: {
      postId,
      reactionType,
      actorName: getActorName(actor),
      contentPreview: previewText(post?.content),
      route: "/",
    },
  });
};

export const notifyPostComment = async ({ post, comment, actor }) => {
  const postId = getPostId(post);
  const commentId = getCommentId(comment);
  const actorId = getActorId(actor);
  const postAuthorId = post?.authorId;
  const recipientId = toComparableId(postAuthorId);
  if (!postId || !commentId || !recipientId || recipientId === toComparableId(actorId)) {
    return null;
  }

  return upsertAggregatedNotification({
    userId: postAuthorId,
    organizationId: post.organizationId || null,
    type: "post_comment",
    title: "Bài viết có bình luận mới",
    message: `${getActorName(actor)} đã bình luận về bài viết của bạn.`,
    entityType: "post",
    entityId: postId,
    actorId,
    actorName: getActorName(actor),
    aggregationKey: `post:${postId}:comments`,
    buildCopy: buildCopy("post_comment", {}),
    data: {
      postId,
      commentId,
      actorName: getActorName(actor),
      contentPreview: previewText(comment?.content),
      route: "/",
    },
  });
};

const findRootComment = async (comment) => {
  let current = comment;
  let guard = 0;

  while (current?.parentId && guard < 20) {
    const parent = await Comment.findById(current.parentId).select(
      "_id parentId authorId postId organizationId content",
    );
    if (!parent) break;
    current = parent;
    guard += 1;
  }

  return current || comment;
};

const collectThreadParticipantIds = async (rootComment) => {
  const participantIds = [rootComment?.authorId];
  let frontier = [rootComment?._id].filter(Boolean);
  let guard = 0;

  while (frontier.length > 0 && guard < 20) {
    const replies = await Comment.find({
      parentId: { $in: frontier },
    }).select("_id authorId");
    participantIds.push(...replies.map((reply) => reply.authorId));
    frontier = replies.map((reply) => reply._id);
    guard += 1;
  }

  return uniqueIdList(participantIds);
};

export const notifyCommentReply = async ({
  post,
  parentComment,
  reply,
  actor,
}) => {
  const rootComment = await findRootComment(parentComment);
  const rootCommentId = getCommentId(rootComment);
  const replyId = getCommentId(reply);
  const actorId = getActorId(actor);
  if (!rootCommentId || !replyId) return [];

  const threadParticipantIds = await collectThreadParticipantIds(rootComment);
  const recipients = uniqueIdList(threadParticipantIds, { exclude: actorId });
  if (recipients.length === 0) return [];

  return notifyUsersAggregated(recipients, {
    organizationId: rootComment.organizationId || post?.organizationId || null,
    type: "comment_reply",
    title: "Luồng phản hồi có trả lời mới",
    message: `${getActorName(actor)} đã trả lời trong một luồng bình luận bạn tham gia.`,
    entityType: "comment",
    entityId: replyId,
    actorId,
    actorName: getActorName(actor),
    aggregationKey: `comment-thread:${rootCommentId}:replies`,
    buildCopy: buildCopy("comment_reply", {}),
    data: {
      postId: getPostId(post) || rootComment.postId,
      rootCommentId,
      replyId,
      actorName: getActorName(actor),
      contentPreview: previewText(reply?.content),
      route: "/",
    },
  });
};

export const notifyCommentReaction = async ({ comment, actor, reactionType }) => {
  const commentId = getCommentId(comment);
  const actorId = getActorId(actor);
  const commentAuthorId = comment?.authorId;
  const recipientId = toComparableId(commentAuthorId);
  if (!commentId || !recipientId || recipientId === toComparableId(actorId)) {
    return null;
  }

  return upsertAggregatedNotification({
    userId: commentAuthorId,
    organizationId: comment.organizationId || null,
    type: "comment_reaction",
    title: "Bình luận có tương tác mới",
    message: `${getActorName(actor)} đã bày tỏ cảm xúc về bình luận của bạn.`,
    entityType: "comment",
    entityId: commentId,
    actorId,
    actorName: getActorName(actor),
    aggregationKey: `comment:${commentId}:reactions`,
    buildCopy: buildCopy("comment_reaction", {}),
    data: {
      postId: comment.postId,
      commentId,
      reactionType,
      actorName: getActorName(actor),
      contentPreview: previewText(comment?.content),
      route: "/",
    },
  });
};

export default {
  notifyPostMention,
  notifyPostReaction,
  notifyPostComment,
  notifyCommentReply,
  notifyCommentReaction,
};
