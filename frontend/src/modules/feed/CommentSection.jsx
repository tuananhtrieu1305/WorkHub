import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  getComments,
  getCommentById,
  createComment,
  deleteComment,
  getCommentReplies,
  createCommentReply,
  likeComment,
} from "../../api/postApi";
import { EmojiPickerButton, appendEmojiToText } from "../../components/emoji";
import SendIcon from "../../components/icons/SendIcon";
import { useSocket } from "../../context/SocketContext";
import ReactionPicker from "./ReactionPicker";
import {
  buildOptimisticReactionState,
  mergeReactionResponse,
} from "./reactionState";
import {
  getCommentReactionParticipants,
  getCommentReactionSummary,
  getCommentReactionTotal,
} from "./reactionSummary";
import {
  buildCommentPayload,
  buildReplyMention,
  getCommentId,
  splitLeadingReplyMention,
  updateCommentEverywhere,
} from "./commentThreadState";
import {
  getAttachmentType,
  getAttachmentUrl,
} from "./attachmentUtils";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";
import UserProfileModal from "../profile/UserProfileModal";
import {
  CommentListSkeleton,
  CommentReplySkeleton,
} from "../../components/common/Skeleton";

const MAX_COMMENT_IMAGES = 4;

const getImageAttachments = (attachments = []) =>
  attachments.filter((attachment) => getAttachmentType(attachment) === "image");

const getComparableUserId = (user = {}) => {
  const id = user?._id || user?.id || user;
  return id?.toString?.() || "";
};

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

const getReactionEntryUserId = (reaction = {}) =>
  getComparableUserId(reaction.user || reaction.userId);

const toReactionSummaryPayload = (comment) =>
  getCommentReactionSummary(comment, Number.MAX_SAFE_INTEGER).map(
    ({ reactionType, count, latestReactionAt }) => ({
      reactionType,
      count,
      latestReactionAt,
    })
  );

const toReactionEntry = (participant) => ({
  user: {
    _id: participant.id,
    id: participant.id,
    fullName: participant.fullName,
    email: participant.email,
    avatar: participant.avatar,
  },
  reactionType: participant.reactionType,
  reactedAt: participant.reactedAt,
});

const getReactionSummaryPayloadTotal = (summary = []) =>
  summary.reduce((total, item) => total + (item.count || 0), 0);

const isSameId = (left, right) =>
  left != null && right != null && String(left) === String(right);

const buildReactionSummaryMap = (comment) =>
  new Map(
    getCommentReactionSummary(comment, Number.MAX_SAFE_INTEGER).map((item) => [
      item.reactionType,
      {
        reactionType: item.reactionType,
        count: item.count,
        latestReactionAt: item.latestReactionAt || item.reactedAt || "",
      },
    ])
  );

const pickReliableReactionSummaryPayload = ({
  current,
  response,
  likesCount,
}) => {
  const currentSummary = toReactionSummaryPayload(current);
  const responseSummary = toReactionSummaryPayload({
    reactionSummary: Array.isArray(response?.reactionSummary)
      ? response.reactionSummary
      : [],
    reactions: Array.isArray(response?.reactions) ? response.reactions : [],
    likesCount,
    reactionType: response?.reactionType,
  });

  if (responseSummary.length === 0) return current.reactionSummary;

  const currentSummaryTotal = getReactionSummaryPayloadTotal(currentSummary);
  const responseSummaryTotal = getReactionSummaryPayloadTotal(responseSummary);

  if (
    currentSummary.length > responseSummary.length &&
    currentSummaryTotal === likesCount &&
    responseSummaryTotal === likesCount
  ) {
    return currentSummary;
  }

  return responseSummary;
};

const toLikedByPayload = (reactions = []) =>
  reactions.map((reaction) => ({
    ...reaction.user,
    reactionType: reaction.reactionType,
    reactedAt: reaction.reactedAt,
  }));

const mergeRefreshedComment = (current, refreshedComment) => ({
  ...current,
  ...refreshedComment,
  repliesCount: refreshedComment.repliesCount ?? current.repliesCount,
});

const buildOptimisticCommentReactionMetadata = ({
  comment,
  user,
  previousLiked,
  previousReactionType,
  optimisticState,
}) => {
  const currentUserId = getComparableUserId(user);
  const summaryByType = buildReactionSummaryMap(comment);
  const currentReactions = getCommentReactionParticipants(comment).map(toReactionEntry);
  const nextReactions = currentUserId
    ? currentReactions.filter(
        (reaction) => getReactionEntryUserId(reaction) !== currentUserId
      )
    : currentReactions;

  if (previousLiked && previousReactionType) {
    const previousSummary = summaryByType.get(previousReactionType);
    if (previousSummary) {
      previousSummary.count -= 1;
      if (previousSummary.count <= 0) {
        summaryByType.delete(previousReactionType);
      } else {
        summaryByType.set(previousReactionType, previousSummary);
      }
    }
  }

  if (currentUserId && optimisticState.isLiked) {
    const reactedAt = new Date().toISOString();
    const nextSummary = summaryByType.get(optimisticState.reactionType) || {
      reactionType: optimisticState.reactionType,
      count: 0,
      latestReactionAt: "",
    };
    nextSummary.count += 1;
    nextSummary.latestReactionAt = reactedAt;
    summaryByType.set(optimisticState.reactionType, nextSummary);

    nextReactions.unshift({
      user: {
        _id: user?._id || user?.id,
        id: user?.id || user?._id,
        fullName: user?.fullName || "Bạn",
        email: user?.email || "",
        avatar: user?.avatar || "",
      },
      reactionType: optimisticState.reactionType,
      reactedAt,
    });
  }

  return {
    reactionSummary: Array.from(summaryByType.values()).filter(
      (item) => item.count > 0
    ),
    reactions: nextReactions,
  };
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

const CommentReactionCluster = ({ comment, onOpen }) => {
  const summary = getCommentReactionSummary(comment);
  const total = getCommentReactionTotal(comment);

  if (total <= 0 || summary.length === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="absolute -bottom-3 -right-2 inline-flex h-6 items-center gap-1 rounded-full border border-white/90 bg-white/95 px-1.5 shadow-[0_8px_18px_-10px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/80 backdrop-blur transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:bg-white hover:shadow-[0_10px_22px_-12px_rgba(15,23,42,0.65)] active:translate-y-0"
      aria-label={`Xem ${total} người đã bày tỏ cảm xúc`}
    >
      <span className="flex items-center -space-x-1 pr-0.5">
        {summary.map((reaction, index) => (
          <span
            key={reaction.reactionType}
            className="workhub-reaction-emoji inline-flex size-[18px] items-center justify-center rounded-full border border-white bg-white text-[14px] leading-none ring-1 ring-slate-100"
            style={{ zIndex: summary.length - index }}
            title={`${reaction.label}: ${reaction.count}`}
          >
            {reaction.emoji}
          </span>
        ))}
      </span>
      <span className="min-w-[0.65rem] text-center text-[11px] font-semibold leading-none text-slate-600">
        {total}
      </span>
    </button>
  );
};

const CommentReactionDetailsModal = ({ comment, onClose }) => {
  const participants = getCommentReactionParticipants(comment);
  const summary = getCommentReactionSummary(comment, Number.MAX_SAFE_INTEGER);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Danh sách cảm xúc bình luận"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-950">
              Cảm xúc bình luận
            </h3>
            <p className="text-xs font-medium text-slate-500">
              {getCommentReactionTotal(comment)} lượt reaction
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Đóng bảng cảm xúc"
          >
            <span className="material-symbols-outlined text-[20px] leading-none">
              close
            </span>
          </button>
        </header>

        {summary.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
            {summary.map((reaction) => (
              <span
                key={reaction.reactionType}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
              >
                <span className="workhub-reaction-emoji text-base leading-none">
                  {reaction.emoji}
                </span>
                {reaction.count}
              </span>
            ))}
          </div>
        )}

        <div className="max-h-[360px] overflow-y-auto">
          {participants.length > 0 ? (
            participants.map((participant) => {
              const participantAvatar = getAvatarUrl(participant.avatar);
              const initial = participant.fullName?.charAt(0)?.toUpperCase() || "?";

              return (
                <div
                  key={`${participant.id}-${participant.reactionType}`}
                  className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-b-0"
                >
                  {participantAvatar ? (
                    <img
                      src={participantAvatar}
                      alt={participant.fullName}
                      referrerPolicy={getAvatarReferrerPolicy(participantAvatar)}
                      className="size-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-9 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">
                      {initial}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {participant.fullName}
                    </p>
                    {participant.email && (
                      <p className="truncate text-xs text-slate-500">
                        {participant.email}
                      </p>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                    <span className="workhub-reaction-emoji text-base leading-none">
                      {participant.reactionEmoji}
                    </span>
                    {participant.reactionLabel}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="px-5 py-6 text-center text-sm font-medium text-slate-500">
              Chưa có dữ liệu người reaction.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

const CommentSection = ({ postId, initialCommentsCount = 0, onCommentCountChange }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commentImages, setCommentImages] = useState([]);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyImages, setReplyImages] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [repliesByComment, setRepliesByComment] = useState({});
  const [expandedReplies, setExpandedReplies] = useState({});
  const [loadingReplies, setLoadingReplies] = useState({});
  const [reactionDetailsCommentId, setReactionDetailsCommentId] = useState(null);
  const [profileModalUser, setProfileModalUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingReplyTo, setSubmittingReplyTo] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [, setTotalCount] = useState(initialCommentsCount);
  const commentInputRef = useRef(null);
  const commentImageInputRef = useRef(null);
  const commentCountChangeRef = useRef(onCommentCountChange);
  const replyInputRef = useRef(null);
  const replyImageInputRef = useRef(null);

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";
  const avatarUrl = getAvatarUrl(user?.avatar);
  const activeOrganizationId = toComparableId(
    user?.activeOrganization?.id || user?.activeOrganizationId,
  );
  const currentUserId = getComparableUserId(user);

  useEffect(() => {
    commentCountChangeRef.current = onCommentCountChange;
  }, [onCommentCountChange]);

  useEffect(() => {
    setTotalCount(initialCommentsCount);
  }, [initialCommentsCount]);

  const adjustTotalCount = (delta) => {
    setTotalCount((prev) => {
      const next = Math.max(0, prev + delta);
      commentCountChangeRef.current?.(next);
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
      setHasMore(pageNum < (res.totalPages || 1));
      setPage(pageNum);
      if (Number.isFinite(res.totalCommentsCount)) {
        setTotalCount(res.totalCommentsCount);
        commentCountChangeRef.current?.(res.totalCommentsCount);
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

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

  const updateCommentItem = useCallback((commentId, updater) => {
    setComments(
      (prev) =>
        updateCommentEverywhere({
          comments: prev,
          commentId,
          updater,
        }).comments
    );
    setRepliesByComment(
      (prev) =>
        updateCommentEverywhere({
          repliesByComment: prev,
          commentId,
          updater,
        }).repliesByComment
    );
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const handleCommentReactionUpdated = (event = {}) => {
      const eventOrganizationId = toComparableId(event.organizationId);
      if (eventOrganizationId && eventOrganizationId !== activeOrganizationId) {
        return;
      }
      if (!isSameId(event.postId, postId) || !event.commentId) return;

      updateCommentItem(event.commentId, (current) => ({
        ...current,
        ...(toComparableId(event.actorId) === currentUserId
          ? {
              isLiked: !!event.liked,
              reactionType: event.liked ? event.reactionType : null,
            }
          : {}),
        likesCount: Number.isFinite(event.likesCount)
          ? event.likesCount
          : current.likesCount,
        reactionSummary: Array.isArray(event.reactionSummary)
          ? event.reactionSummary
          : current.reactionSummary,
        reactions: Array.isArray(event.reactions)
          ? event.reactions
          : current.reactions,
        likedBy: Array.isArray(event.likedBy)
          ? event.likedBy
          : Array.isArray(event.reactions)
          ? toLikedByPayload(event.reactions)
          : current.likedBy,
      }));
    };

    socket.on("comment_reaction_updated", handleCommentReactionUpdated);

    return () => {
      socket.off("comment_reaction_updated", handleCommentReactionUpdated);
    };
  }, [activeOrganizationId, currentUserId, postId, socket, updateCommentItem]);

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
        buildCommentPayload(newComment, commentImages)
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
        buildCommentPayload(content, images)
      );
      setRepliesByComment((prev) => ({
        ...prev,
        [commentId]: [...(prev[commentId] || []), created],
      }));
      setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
      setReplyingTo(null);
      setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
      setReplyImages((prev) => ({ ...prev, [commentId]: [] }));
      updateCommentItem(commentId, (comment) => ({
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

  const handleReactionSelect = async (comment, nextReactionType) => {
    const commentId = getCommentId(comment);
    const previousLiked = !!comment.isLiked;
    const previousReactionType = comment.reactionType || null;
    const previousCount = comment.likesCount || 0;
    const previousReactionSummary = comment.reactionSummary;
    const previousReactions = comment.reactions;
    const previousLikedBy = comment.likedBy;
    const optimisticState = buildOptimisticReactionState({
      isLiked: previousLiked,
      reactionType: previousReactionType,
      likesCount: previousCount,
      nextReactionType,
    });
    const optimisticReactionMetadata = buildOptimisticCommentReactionMetadata({
      comment,
      user,
      previousLiked,
      previousReactionType:
        previousReactionType || (previousLiked ? "like" : null),
      optimisticState,
    });

    updateCommentItem(commentId, (current) => ({
      ...current,
      isLiked: optimisticState.isLiked,
      reactionType: optimisticState.reactionType,
      likesCount: optimisticState.likesCount,
      ...optimisticReactionMetadata,
    }));

    try {
      const res = await likeComment(commentId, nextReactionType);
      const nextState = mergeReactionResponse({
        response: res,
        requestedReactionType: nextReactionType,
        optimisticState,
      });
      let refreshedComment = null;

      try {
        refreshedComment = await getCommentById(commentId);
      } catch (refreshErr) {
        console.warn("Failed to refresh comment reaction details:", refreshErr);
      }

      updateCommentItem(commentId, (current) => ({
        ...(refreshedComment
          ? mergeRefreshedComment(current, refreshedComment)
          : {
              ...current,
              isLiked: nextState.isLiked,
              reactionType: nextState.reactionType,
              likesCount: nextState.likesCount,
              reactionSummary: pickReliableReactionSummaryPayload({
                current,
                response: res,
                likesCount: nextState.likesCount,
              }),
              reactions: Array.isArray(res?.reactions)
                ? res.reactions
                : current.reactions,
              likedBy: Array.isArray(res?.likedBy)
                ? res.likedBy
                : Array.isArray(res?.reactions)
                ? toLikedByPayload(res.reactions)
                : current.likedBy,
            }),
      }));
    } catch (err) {
      updateCommentItem(commentId, (current) => ({
        ...current,
        isLiked: previousLiked,
        reactionType: previousReactionType,
        likesCount: previousCount,
        reactionSummary: previousReactionSummary,
        reactions: previousReactions,
        likedBy: previousLikedBy,
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
          [commentId]: [],
        }));
        updateCommentItem(parentId, (parentComment) => ({
          ...parentComment,
          repliesCount: Math.max(0, (parentComment.repliesCount || 0) - 1),
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

  const startReply = (comment) => {
    const commentId = getCommentId(comment);
    const authorName = comment.author?.fullName || "";
    const mention = buildReplyMention(authorName);

    setReplyingTo((current) =>
      current?.commentId === commentId ? null : { commentId, authorName }
    );

    if (mention) {
      setReplyDrafts((prev) => ({
        ...prev,
        [commentId]: (prev[commentId] || "").trim() ? prev[commentId] : mention,
      }));
    }

    requestAnimationFrame(() => replyInputRef.current?.focus());
  };

  const renderCommentActions = (comment, parentId = null) => {
    const isCommentAuthor = user?._id === comment.author?._id;

    return (
      <div className="flex items-center gap-4 mt-1 ml-1">
        <span className="text-xs text-slate-500 font-medium">
          {formatTime(comment.createdAt)}
        </span>
        <ReactionPicker
          variant="comment"
          isActive={!!comment.isLiked}
          reactionType={comment.reactionType}
          count={comment.likesCount || 0}
          onSelect={(nextReactionType) =>
            handleReactionSelect(comment, nextReactionType)
          }
        />
        <button
          type="button"
          onClick={() => {
            startReply(comment);
            requestAnimationFrame(() => commentInputRef.current?.blur());
          }}
          className="text-xs text-slate-500 hover:text-blue-600 font-bold transition-colors"
        >
          Trả lời
        </button>
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

  const renderCommentContent = (comment, replyTargetName) => {
    if (!comment.content) return null;

    const leadingMention = splitLeadingReplyMention(
      comment.content,
      replyTargetName
    );

    return (
      <p className="text-sm text-slate-800 mt-0.5 break-words">
        {leadingMention ? (
          <>
            <strong className="font-bold text-slate-950">
              {leadingMention.mention}
            </strong>
            {leadingMention.rest}
          </>
        ) : (
          comment.content
        )}
      </p>
    );
  };

  const openAuthorProfile = (author) => {
    const authorId = getComparableUserId(author);
    if (!authorId) return;
    if (authorId === currentUserId) {
      navigate("/profile");
      return;
    }
    setProfileModalUser(author);
  };

  const renderCommentBubble = (
    comment,
    { isReply = false, replyTargetName = "" } = {}
  ) => {
    const hasReactionCluster =
      getCommentReactionTotal(comment) > 0 &&
      getCommentReactionSummary(comment).length > 0;

    return (
      <div
        className={`relative inline-block max-w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 pt-2.5 shadow-sm ${
          hasReactionCluster ? "mb-3 pb-4 pr-5" : "pb-2.5"
        }`}
      >
        <button
          type="button"
          onClick={() => openAuthorProfile(comment.author)}
          className="block max-w-full truncate text-left text-sm font-bold text-slate-950 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {comment.author?.fullName || "Ẩn danh"}
        </button>
        {renderCommentContent(comment, replyTargetName)}
        <CommentImageGrid attachments={comment.attachments} isReply={isReply} />
        <CommentReactionCluster
          comment={comment}
          onOpen={() => setReactionDetailsCommentId(getCommentId(comment))}
        />
      </div>
    );
  };

  const renderReplyForm = (commentId) => {
    const images = replyImages[commentId] || [];
    const draft = replyDrafts[commentId] || "";
    const isReplySubmitting = submittingReplyTo === commentId;

    return (
      <form
        onSubmit={(event) => handleReplySubmit(event, commentId)}
        className="flex gap-2"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user?.fullName}
            referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
            className="size-7 rounded-full object-cover shrink-0 mt-1"
          />
        ) : (
          <div className="size-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-1">
            {userInitial}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="relative">
            <input
              ref={replyInputRef}
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
            <SendIcon className="size-5" />
          )}
        </button>
      </form>
    );
  };

  const renderThreadConnectorRow = (
    children,
    { className = "", depth = 0, key, isFirst = false, isLast = false } = {}
  ) => {
    const branchOffsetClass =
      depth > 0
        ? "before:-left-[34px] before:w-7 after:-left-[34px]"
        : "before:-left-10 before:w-[34px] after:-left-10";
    const branchRiseClass = isFirst
      ? depth > 0
        ? "before:-top-14 before:h-[76px]"
        : "before:-top-16 before:h-[84px]"
      : "before:top-0.5 before:h-[18px]";

    return (
      <div
        key={key}
        className={`relative before:absolute before:rounded-bl-2xl before:border-b-2 before:border-l-2 before:border-slate-300/70 ${
          isLast
            ? ""
            : "after:absolute after:top-5 after:bottom-[-0.625rem] after:border-l-2 after:border-slate-300/70"
        } ${branchOffsetClass} ${branchRiseClass} ${className}`}
      >
        {children}
      </div>
    );
  };

  const renderReplies = (comment, depth = 0) => {
    const commentId = getCommentId(comment);
    const replies = repliesByComment[commentId] || [];
    const repliesCount = comment.repliesCount || 0;
    const isReplyingHere = replyingTo?.commentId === commentId;
    const isExpanded = !!expandedReplies[commentId];
    const isLoadingReplies = !!loadingReplies[commentId];
    const hasThreadContent =
      repliesCount > 0 ||
      isReplyingHere ||
      (isExpanded && replies.length > 0);

    if (!hasThreadContent) return null;

    const threadRows = [];

    if (repliesCount > 0 && !isExpanded && isLoadingReplies) {
      threadRows.push({
        key: `${commentId}-replies-loading`,
        className: "pr-1",
        node: <CommentReplySkeleton />,
      });
    } else if (repliesCount > 0 && !isExpanded) {
      threadRows.push({
        key: `${commentId}-view-replies`,
        node: (
          <button
            type="button"
            onClick={() => handleToggleReplies(commentId)}
            className="inline-flex min-h-5 items-center gap-1 rounded-full pr-2 text-xs font-bold text-slate-500 transition-colors hover:text-blue-600"
          >
            {repliesCount === 1
              ? "Xem 1 phản hồi"
              : `Xem ${repliesCount} phản hồi`}
          </button>
        ),
      });
    }

    if (isReplyingHere) {
      threadRows.push({
        key: `${commentId}-reply-form`,
        className: "pr-1",
        node: renderReplyForm(commentId),
      });
    }

    if (isExpanded) {
      replies.forEach((reply) => {
        const replyId = getCommentId(reply);
        threadRows.push({
          key: replyId,
          className: "pr-1",
          node: renderCommentNode(reply, {
            parentId: commentId,
            depth: depth + 1,
            replyTargetName: comment.author?.fullName || "",
          }),
        });
      });
    }

    if (threadRows.length === 0) return null;

    return (
      <div className="relative ml-3 mt-2 flex flex-col gap-2">
        {threadRows.map((row, index) =>
          renderThreadConnectorRow(row.node, {
            key: row.key,
            className: row.className,
            depth,
            isFirst: index === 0,
            isLast: index === threadRows.length - 1,
          })
        )}
      </div>
    );
  };

  const renderCommentNode = (
    comment,
    { parentId = null, depth = 0, replyTargetName = "" } = {}
  ) => {
    const commentAvatar = getAvatarUrl(comment.author?.avatar);
    const avatarColumnClassName =
      depth > 0
        ? "relative z-10 flex w-7 shrink-0 justify-center"
        : "relative z-10 flex w-8 shrink-0 justify-center";
    const avatarClassName =
      depth > 0
        ? "size-7 rounded-full object-cover shrink-0 mt-0.5"
        : "size-8 rounded-full object-cover shrink-0 mt-0.5";
    const fallbackClassName =
      depth > 0
        ? "size-7 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
        : "size-8 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5";

    return (
      <div className={`flex ${depth > 0 ? "gap-2" : "gap-3"} group`}>
        <div className={avatarColumnClassName}>
          <button
            type="button"
            onClick={() => openAuthorProfile(comment.author)}
            className="rounded-full focus:outline-none focus:ring-2 focus:ring-blue-300"
            aria-label={`Xem hồ sơ ${comment.author?.fullName || "người dùng"}`}
          >
            {commentAvatar ? (
              <img
                src={commentAvatar}
                alt={comment.author?.fullName}
                referrerPolicy={getAvatarReferrerPolicy(commentAvatar)}
                className={avatarClassName}
              />
            ) : (
              <div className={fallbackClassName}>
                {comment.author?.fullName?.charAt(0) || "?"}
              </div>
            )}
          </button>
        </div>
        <div className="flex-1 min-w-0">
          {renderCommentBubble(comment, {
            isReply: depth > 0,
            replyTargetName,
          })}
          {renderCommentActions(comment, parentId)}
          {renderReplies(comment, depth)}
        </div>
      </div>
    );
  };

  const findCommentById = (commentId) => {
    const rootComment = comments.find(
      (comment) => getCommentId(comment) === commentId
    );
    if (rootComment) return rootComment;

    for (const replies of Object.values(repliesByComment)) {
      const reply = replies.find((item) => getCommentId(item) === commentId);
      if (reply) return reply;
    }

    return null;
  };

  const activeReactionComment = reactionDetailsCommentId
    ? findCommentById(reactionDetailsCommentId)
    : null;

  return (
    <>
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
                <SendIcon className="size-5" />
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
          <CommentListSkeleton count={3} />
        ) : comments.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-4 font-medium">
            Chưa có bình luận nào. Hãy là người đầu tiên!
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((comment) => (
              <div key={getCommentId(comment)}>
                {renderCommentNode(comment)}
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              isLoading ? (
                <CommentListSkeleton count={2} compact />
              ) : (
                <button
                  type="button"
                  onClick={() => fetchComments(page + 1)}
                  className="flex items-center justify-center gap-1 py-2 text-sm font-bold text-blue-600 transition-colors hover:text-blue-700"
                >
                  <span className="material-symbols-outlined text-base">expand_more</span>
                  Xem thêm bình luận
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
    {activeReactionComment && (
      <CommentReactionDetailsModal
        comment={activeReactionComment}
        onClose={() => setReactionDetailsCommentId(null)}
      />
    )}
    <UserProfileModal
      open={Boolean(profileModalUser)}
      userId={profileModalUser?._id || profileModalUser?.id}
      userPreview={profileModalUser}
      onClose={() => setProfileModalUser(null)}
    />
    </>
  );
};

export default CommentSection;
