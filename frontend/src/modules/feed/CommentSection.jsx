import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getComments,
  createComment,
  deleteComment,
  getCommentReplies,
  createCommentReply,
  likeComment,
} from "../../api/postApi";
import { EmojiPickerButton, appendEmojiToText } from "../../components/emoji";
import {
  getAttachmentType,
  getAttachmentUrl,
} from "./attachmentUtils";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";

const MAX_COMMENT_IMAGES = 4;

const getCommentId = (comment) => comment.id || comment._id;

const getImageAttachments = (attachments = []) =>
  attachments.filter((attachment) => getAttachmentType(attachment) === "image");

const buildCommentFormData = (content, files = []) => {
  const formData = new FormData();
  formData.append("content", content.trim());
  files.forEach((file) => formData.append("attachments", file));
  return formData;
};

const CommentImageGrid = ({ attachments = [], isReply = false }) => {
  const imageAttachments = getImageAttachments(attachments);
  if (imageAttachments.length === 0) return null;

  return (
    <div
      className={`mt-2 grid gap-2 overflow-hidden rounded-xl ${
        imageAttachments.length > 1 ? "grid-cols-2" : "grid-cols-1"
      } ${isReply ? "max-w-[260px]" : "max-w-[360px]"}`}
    >
      {imageAttachments.map((attachment, index) => (
        <img
          key={`${attachment.fileUrl || attachment.fileName}-${index}`}
          src={getAttachmentUrl(attachment)}
          alt={attachment.fileName || "Ảnh bình luận"}
          className={`w-full rounded-xl border border-slate-200 object-cover ${
            imageAttachments.length > 1 ? "h-28" : isReply ? "max-h-48" : "max-h-64"
          }`}
        />
      ))}
    </div>
  );
};

const LocalImagePreviews = ({ files = [], onRemove }) => {
  if (files.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${file.lastModified}-${index}`}
          className="group relative size-16 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <img
            src={URL.createObjectURL(file)}
            alt={file.name}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-slate-950/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Xóa ảnh"
          >
            <span className="material-symbols-outlined text-sm leading-none">close</span>
          </button>
        </div>
      ))}
    </div>
  );
};

const CommentSection = ({ postId, onCommentCountChange }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commentImages, setCommentImages] = useState([]);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyImages, setReplyImages] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [repliesByComment, setRepliesByComment] = useState({});
  const [expandedReplies, setExpandedReplies] = useState({});
  const [loadingReplies, setLoadingReplies] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingReplyTo, setSubmittingReplyTo] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [, setTotalCount] = useState(0);
  const commentInputRef = useRef(null);
  const commentImageInputRef = useRef(null);
  const replyImageInputRef = useRef(null);

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";
  const avatarUrl = getAvatarUrl(user?.avatar);

  const adjustTotalCount = (delta) => {
    setTotalCount((prev) => {
      const next = Math.max(0, prev + delta);
      onCommentCountChange?.(next);
      return next;
    });
  };

  const fetchComments = useCallback(async (pageNum, reset = false) => {
    setIsLoading(true);
    try {
      const res = await getComments(postId, { page: pageNum, size: 5 });
      const newComments = res.content || [];
      if (reset) {
        setComments(newComments);
      } else {
        setComments((prev) => [...prev, ...newComments]);
      }
      setTotalCount(res.totalElements || 0);
      setHasMore(pageNum < (res.totalPages || 1));
      setPage(pageNum);
      onCommentCountChange?.(res.totalElements || 0);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setIsLoading(false);
    }
  }, [postId, onCommentCountChange]);

  useEffect(() => {
    fetchComments(1, true);
  }, [fetchComments]);

  const selectImages = (event, setter) => {
    const selected = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith("image/")
    );
    if (selected.length > 0) {
      setter((prev) => [...prev, ...selected].slice(0, MAX_COMMENT_IMAGES));
    }
    event.target.value = "";
  };

  const handleCommentImageSelect = (event) => {
    selectImages(event, setCommentImages);
  };

  const handleReplyImageSelect = (commentId, event) => {
    selectImages(event, (updater) => {
      setReplyImages((prev) => {
        const current = prev[commentId] || [];
        const next =
          typeof updater === "function" ? updater(current) : updater;
        return { ...prev, [commentId]: next };
      });
    });
  };

  const updateCommentItem = (commentId, parentId, updater) => {
    if (parentId) {
      setRepliesByComment((prev) => ({
        ...prev,
        [parentId]: (prev[parentId] || []).map((reply) =>
          getCommentId(reply) === commentId ? updater(reply) : reply
        ),
      }));
      return;
    }

    setComments((prev) =>
      prev.map((comment) =>
        getCommentId(comment) === commentId ? updater(comment) : comment
      )
    );
  };

  const updateRootComment = (commentId, updater) => {
    setComments((prev) =>
      prev.map((comment) =>
        getCommentId(comment) === commentId ? updater(comment) : comment
      )
    );
  };

  const loadReplies = async (commentId) => {
    if (loadingReplies[commentId]) return;
    setLoadingReplies((prev) => ({ ...prev, [commentId]: true }));
    try {
      const res = await getCommentReplies(commentId, { page: 1, size: 10 });
      setRepliesByComment((prev) => ({
        ...prev,
        [commentId]: res.content || [],
      }));
      setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
    } catch (err) {
      console.error("Failed to load replies:", err);
    } finally {
      setLoadingReplies((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  const handleToggleReplies = async (commentId) => {
    if (expandedReplies[commentId]) {
      setExpandedReplies((prev) => ({ ...prev, [commentId]: false }));
      return;
    }

    if (repliesByComment[commentId]) {
      setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
      return;
    }

    await loadReplies(commentId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() && commentImages.length === 0) return;
    setIsSubmitting(true);
    try {
      const created = await createComment(
        postId,
        buildCommentFormData(newComment, commentImages)
      );
      setComments((prev) => [created, ...prev]);
      setNewComment("");
      setCommentImages([]);
      adjustTotalCount(1);
      requestAnimationFrame(() => commentInputRef.current?.focus());
    } catch (err) {
      console.error("Failed to create comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplySubmit = async (event, commentId) => {
    event.preventDefault();
    const content = replyDrafts[commentId] || "";
    const images = replyImages[commentId] || [];
    if (!content.trim() && images.length === 0) return;

    setSubmittingReplyTo(commentId);
    try {
      const created = await createCommentReply(
        commentId,
        buildCommentFormData(content, images)
      );
      setRepliesByComment((prev) => ({
        ...prev,
        [commentId]: [...(prev[commentId] || []), created],
      }));
      setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
      setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
      setReplyImages((prev) => ({ ...prev, [commentId]: [] }));
      updateRootComment(commentId, (comment) => ({
        ...comment,
        repliesCount: (comment.repliesCount || 0) + 1,
      }));
      adjustTotalCount(1);
    } catch (err) {
      console.error("Failed to create reply:", err);
    } finally {
      setSubmittingReplyTo(null);
    }
  };

  const handleEmojiSelect = (emojiNative) => {
    setNewComment((prev) => appendEmojiToText(prev, emojiNative));
    requestAnimationFrame(() => commentInputRef.current?.focus());
  };

  const handleReplyEmojiSelect = (commentId, emojiNative) => {
    setReplyDrafts((prev) => ({
      ...prev,
      [commentId]: appendEmojiToText(prev[commentId] || "", emojiNative),
    }));
  };

  const handleLike = async (comment, parentId = null) => {
    const commentId = getCommentId(comment);
    const previousLiked = !!comment.isLiked;
    const previousCount = comment.likesCount || 0;
    const optimisticLiked = !previousLiked;
    const optimisticCount = Math.max(
      0,
      previousCount + (optimisticLiked ? 1 : -1)
    );

    updateCommentItem(commentId, parentId, (current) => ({
      ...current,
      isLiked: optimisticLiked,
      likesCount: optimisticCount,
    }));

    try {
      const res = await likeComment(commentId);
      updateCommentItem(commentId, parentId, (current) => ({
        ...current,
        isLiked: res.liked,
        likesCount: res.likesCount,
      }));
    } catch (err) {
      updateCommentItem(commentId, parentId, (current) => ({
        ...current,
        isLiked: previousLiked,
        likesCount: previousCount,
      }));
      console.error("Failed to like comment:", err);
    }
  };

  const handleDelete = async (comment, parentId = null) => {
    const commentId = getCommentId(comment);
    try {
      await deleteComment(commentId);
      if (parentId) {
        setRepliesByComment((prev) => ({
          ...prev,
          [parentId]: (prev[parentId] || []).filter(
            (reply) => getCommentId(reply) !== commentId
          ),
        }));
        updateRootComment(parentId, (rootComment) => ({
          ...rootComment,
          repliesCount: Math.max(0, (rootComment.repliesCount || 0) - 1),
        }));
        adjustTotalCount(-1);
        return;
      }

      setComments((prev) =>
        prev.filter((item) => getCommentId(item) !== commentId)
      );
      adjustTotalCount(-(1 + (comment.repliesCount || 0)));
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  const renderCommentActions = (comment, parentId = null) => {
    const commentId = getCommentId(comment);
    const isCommentAuthor = user?._id === comment.author?._id;

    return (
      <div className="flex items-center gap-4 mt-1 ml-1">
        <span className="text-xs text-slate-500 font-medium">
          {formatTime(comment.createdAt)}
        </span>
        <button
          type="button"
          onClick={() => handleLike(comment, parentId)}
          className={`text-xs font-bold transition-colors ${
            comment.isLiked
              ? "text-blue-600"
              : "text-slate-500 hover:text-blue-600"
          }`}
        >
          {comment.isLiked ? "Đã thích" : "Thích"}
          {(comment.likesCount || 0) > 0 && (
            <span className="ml-1">({comment.likesCount})</span>
          )}
        </button>
        {!parentId && (
          <button
            type="button"
            onClick={() => {
              setReplyingTo((current) => (current === commentId ? null : commentId));
              requestAnimationFrame(() => commentInputRef.current?.blur());
            }}
            className="text-xs text-slate-500 hover:text-blue-600 font-bold transition-colors"
          >
            Trả lời
          </button>
        )}
        {isCommentAuthor && (
          <button
            type="button"
            onClick={() => handleDelete(comment, parentId)}
            className="text-xs text-slate-400 hover:text-red-600 font-bold transition-colors opacity-0 group-hover:opacity-100"
          >
            Xóa
          </button>
        )}
      </div>
    );
  };

  const renderCommentBubble = (comment, { isReply = false } = {}) => (
    <div className="bg-slate-100 rounded-2xl px-4 py-2.5 inline-block max-w-full border border-slate-200 shadow-sm">
      <p className="text-sm font-bold text-slate-950">
        {comment.author?.fullName || "Ẩn danh"}
      </p>
      {comment.content && (
        <p className="text-sm text-slate-800 mt-0.5 break-words">
          {comment.content}
        </p>
      )}
      <CommentImageGrid attachments={comment.attachments} isReply={isReply} />
    </div>
  );

  const renderReplyForm = (commentId) => {
    const images = replyImages[commentId] || [];
    const draft = replyDrafts[commentId] || "";
    const isReplySubmitting = submittingReplyTo === commentId;

    return (
      <form
        onSubmit={(event) => handleReplySubmit(event, commentId)}
        className="mt-2 flex gap-2"
      >
        <div className="flex-1 min-w-0">
          <div className="relative">
            <input
              type="text"
              value={draft}
              onChange={(event) =>
                setReplyDrafts((prev) => ({
                  ...prev,
                  [commentId]: event.target.value,
                }))
              }
              placeholder="Viết phản hồi..."
              className="w-full rounded-full border border-slate-200 bg-white py-2 pl-4 pr-20 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30"
            />
            <button
              type="button"
              onClick={() => replyImageInputRef.current?.click()}
              className="absolute right-9 top-1/2 z-20 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-sky-500 transition-colors hover:bg-sky-50"
              title="Đính kèm ảnh"
            >
              <span className="material-symbols-outlined text-[19px] leading-none">image</span>
            </button>
            <EmojiPickerButton
              className="absolute right-1 top-1/2 z-20 -translate-y-1/2"
              buttonClassName="!h-8 !w-8"
              onEmojiSelect={(emoji) => handleReplyEmojiSelect(commentId, emoji)}
              placement="top"
              label="Chèn biểu tượng cảm xúc vào phản hồi"
            />
            <input
              ref={replyImageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => handleReplyImageSelect(commentId, event)}
            />
          </div>
          <LocalImagePreviews
            files={images}
            onRemove={(index) =>
              setReplyImages((prev) => ({
                ...prev,
                [commentId]: (prev[commentId] || []).filter((_, i) => i !== index),
              }))
            }
          />
        </div>
        <button
          type="submit"
          disabled={isReplySubmitting || (!draft.trim() && images.length === 0)}
          className="mt-0 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-blue-600 transition-colors hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent"
        >
          {isReplySubmitting ? (
            <span className="size-4 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
          ) : (
            <span className="material-symbols-outlined text-xl leading-none">send</span>
          )}
        </button>
      </form>
    );
  };

  const renderReplies = (comment) => {
    const commentId = getCommentId(comment);
    const replies = repliesByComment[commentId] || [];

    return (
      <>
        {(comment.repliesCount || 0) > 0 && (
          <button
            type="button"
            onClick={() => handleToggleReplies(commentId)}
            className="mt-2 ml-1 inline-flex items-center gap-1 text-xs font-bold text-blue-600 transition-colors hover:text-blue-700"
          >
            {loadingReplies[commentId] ? (
              <span className="size-3 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-base leading-none">
                subdirectory_arrow_right
              </span>
            )}
            {expandedReplies[commentId] ? "Ẩn phản hồi" : `Xem ${comment.repliesCount} phản hồi`}
          </button>
        )}

        {replyingTo === commentId && renderReplyForm(commentId)}

        {expandedReplies[commentId] && replies.length > 0 && (
          <div className="mt-3 flex flex-col gap-3 border-l-2 border-slate-200 pl-4">
            {replies.map((reply) => {
              const replyId = getCommentId(reply);
              const replyAvatar = getAvatarUrl(reply.author?.avatar);

              return (
                <div key={replyId} className="flex gap-2 group">
                  {replyAvatar ? (
                    <img
                      src={replyAvatar}
                      alt={reply.author?.fullName}
                      referrerPolicy={getAvatarReferrerPolicy(replyAvatar)}
                      className="size-7 rounded-full object-cover shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="size-7 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                      {reply.author?.fullName?.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {renderCommentBubble(reply, { isReply: true })}
                    {renderCommentActions(reply, commentId)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="border-t border-slate-100 bg-slate-50/40">
      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="flex gap-3 px-5 py-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user?.fullName}
            referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
            className="size-9 rounded-full object-cover shrink-0 mt-0.5"
          />
        ) : (
          <div className="size-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
            {userInitial}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={commentInputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Viết bình luận..."
                className="w-full bg-white border border-slate-200 rounded-full py-2 pl-4 pr-20 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 transition-all"
              />
              <button
                type="button"
                onClick={() => commentImageInputRef.current?.click()}
                className="absolute right-9 top-1/2 z-20 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-sky-500 transition-colors hover:bg-sky-50"
                title="Đính kèm ảnh"
              >
                <span className="material-symbols-outlined text-[19px] leading-none">image</span>
              </button>
              <EmojiPickerButton
                className="absolute right-1 top-1/2 z-20 -translate-y-1/2"
                buttonClassName="!h-8 !w-8"
                onEmojiSelect={handleEmojiSelect}
                placement="top"
                label="Chèn biểu tượng cảm xúc vào bình luận"
              />
              <input
                ref={commentImageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleCommentImageSelect}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || (!newComment.trim() && commentImages.length === 0)}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-blue-600 transition-colors hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              {isSubmitting ? (
                <span className="size-4 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-xl leading-none">send</span>
              )}
            </button>
          </div>
          <LocalImagePreviews
            files={commentImages}
            onRemove={(index) =>
              setCommentImages((prev) => prev.filter((_, i) => i !== index))
            }
          />
        </div>
      </form>

      {/* Comments list */}
      <div className="px-5 pb-4">
        {isLoading && comments.length === 0 ? (
          <div className="flex items-center justify-center py-4">
            <span className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-4 font-medium">
            Chưa có bình luận nào. Hãy là người đầu tiên!
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((comment) => {
              const cAvatar = getAvatarUrl(comment.author?.avatar);
              const cId = getCommentId(comment);

              return (
                <div key={cId} className="flex gap-3 group">
                  {cAvatar ? (
                    <img
                      src={cAvatar}
                      alt={comment.author?.fullName}
                      referrerPolicy={getAvatarReferrerPolicy(cAvatar)}
                      className="size-8 rounded-full object-cover shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="size-8 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {comment.author?.fullName?.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {renderCommentBubble(comment)}
                    {renderCommentActions(comment)}
                    {renderReplies(comment)}
                  </div>
                </div>
              );
            })}

            {/* Load more */}
            {hasMore && (
              <button
                type="button"
                onClick={() => fetchComments(page + 1)}
                disabled={isLoading}
                className="text-sm text-blue-600 hover:text-blue-700 font-bold py-2 transition-colors flex items-center gap-1 justify-center"
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">expand_more</span>
                    Xem thêm bình luận
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentSection;
