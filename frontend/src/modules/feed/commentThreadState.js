export const getCommentId = (comment) => comment?.id || comment?._id;

export const buildReplyMention = (authorName = "") => {
  const trimmedName = authorName.trim();
  return trimmedName ? `@${trimmedName} ` : "";
};

export const splitLeadingReplyMention = (content = "", authorName = "") => {
  const mention = buildReplyMention(authorName).trim();
  if (!mention || !content.startsWith(mention)) return null;

  return {
    mention,
    rest: content.slice(mention.length),
  };
};

export const buildCommentPayload = (content, files = []) => {
  const trimmedContent = content.trim();

  const formData = new FormData();
  formData.append("content", trimmedContent);
  files.forEach((file) => formData.append("attachments", file));
  return formData;
};

const updateCommentList = (comments = [], commentId, updater) => {
  let didUpdate = false;
  const nextComments = comments.map((comment) => {
    if (getCommentId(comment) !== commentId) return comment;
    didUpdate = true;
    return updater(comment);
  });

  return didUpdate ? nextComments : comments;
};

export const updateCommentEverywhere = ({
  comments = [],
  repliesByComment = {},
  commentId,
  updater,
}) => {
  const nextComments = updateCommentList(comments, commentId, updater);
  let didUpdateReplies = false;

  const nextRepliesByComment = Object.fromEntries(
    Object.entries(repliesByComment).map(([parentId, replies]) => {
      const nextReplies = updateCommentList(replies, commentId, updater);
      if (nextReplies !== replies) didUpdateReplies = true;
      return [parentId, nextReplies];
    })
  );

  return {
    comments: nextComments,
    repliesByComment: didUpdateReplies ? nextRepliesByComment : repliesByComment,
  };
};

export const appendReplyToThread = ({
  comments = [],
  repliesByComment = {},
  parentId,
  reply,
}) => {
  const nextRepliesByComment = {
    ...repliesByComment,
    [parentId]: [...(repliesByComment[parentId] || []), reply],
  };

  return updateCommentEverywhere({
    comments,
    repliesByComment: nextRepliesByComment,
    commentId: parentId,
    updater: (comment) => ({
      ...comment,
      repliesCount: (comment.repliesCount || 0) + 1,
    }),
  });
};

export const removeReplyFromThread = ({
  comments = [],
  repliesByComment = {},
  parentId,
  commentId,
  removedCount = 1,
}) => {
  const nextRepliesByComment = {
    ...repliesByComment,
    [parentId]: (repliesByComment[parentId] || []).filter(
      (reply) => getCommentId(reply) !== commentId
    ),
  };
  delete nextRepliesByComment[commentId];

  return updateCommentEverywhere({
    comments,
    repliesByComment: nextRepliesByComment,
    commentId: parentId,
    updater: (comment) => ({
      ...comment,
      repliesCount: Math.max(0, (comment.repliesCount || 0) - removedCount),
    }),
  });
};
