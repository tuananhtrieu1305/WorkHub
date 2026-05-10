import { useCallback, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { likePost, deletePost } from "../../api/postApi";
import CommentSection from "./CommentSection";
import ReactionPicker from "./ReactionPicker";
import {
  buildReactionStateFromPost,
  buildOptimisticReactionState,
  mergeReactionResponse,
} from "./reactionState";
import {
  formatFileSize,
  getAttachmentDownloadUrl,
  getAttachmentIcon,
  getAttachmentIconClass,
  getAttachmentType,
  getAttachmentUrl,
} from "./attachmentUtils";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const PostCard = ({ post, onPostDeleted, onPostUpdated }) => {
  const { user } = useAuth();
  const [timeReference] = useState(() => Date.now());
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = user?._id === post.author?._id;
  const reactionState = buildReactionStateFromPost(post);

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const diff = timeReference - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(dateStr).toLocaleDateString("vi-VN");
  };

  const getPostAttachmentUrl = (attachment) =>
    getAttachmentUrl(attachment, API_URL);

  const getPostAttachmentDownloadUrl = (attachment) =>
    getAttachmentDownloadUrl(attachment, API_URL);

  const handleReactionSelect = async (nextReactionType) => {
    const previousState = buildReactionStateFromPost(post);
    const optimisticState = buildOptimisticReactionState({
      isLiked: previousState.isLiked,
      reactionType: previousState.reactionType,
      likesCount: previousState.likesCount,
      nextReactionType,
    });

    onPostUpdated?.({
      ...post,
      isLiked: optimisticState.isLiked,
      reactionType: optimisticState.reactionType,
      likesCount: optimisticState.likesCount,
    });

    try {
      const res = await likePost(post.id, nextReactionType);
      const nextState = mergeReactionResponse({
        response: res,
        requestedReactionType: nextReactionType,
        optimisticState,
      });

      onPostUpdated?.({
        ...post,
        isLiked: nextState.isLiked,
        reactionType: nextState.reactionType,
        likesCount: nextState.likesCount,
      });
    } catch {
      onPostUpdated?.({
        ...post,
        isLiked: previousState.isLiked,
        reactionType: previousState.reactionType,
        likesCount: previousState.likesCount,
      });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài đăng này?")) return;
    setIsDeleting(true);
    try {
      await deletePost(post.id);
      onPostDeleted?.(post.id);
    } catch (err) {
      console.error("Delete post failed:", err);
      setIsDeleting(false);
    }
  };

  const handleCommentCountChange = useCallback((count) => {
    setCommentsCount(count);
  }, []);

  const authorAvatar = getAvatarUrl(post.author?.avatar);
  const authorPosition = post.author?.position || "";

  const imageAttachments = post.attachments?.filter((a) => getAttachmentType(a) === "image") || [];
  const videoAttachments = post.attachments?.filter((a) => getAttachmentType(a) === "video") || [];
  const fileAttachments = post.attachments?.filter(
    (a) => getAttachmentType(a) === "file"
  ) || [];

  const renderContent = () => {
    const text = post.content || "";
    const parts = text.split(/(@\w[\w\s]*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span
            key={i}
            className="text-blue-600 font-semibold cursor-pointer hover:underline"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <article
      className={`max-w-full bg-white/90 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 transition-opacity ${
        isDeleting ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt={post.author?.fullName}
                referrerPolicy={getAvatarReferrerPolicy(authorAvatar)}
                className="size-10 shrink-0 rounded-full object-cover shadow-sm sm:size-11"
              />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm sm:size-11">
                {post.author?.fullName?.charAt(0) || "?"}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {post.author?.fullName || "Ẩn danh"}
              </p>
              <p className="truncate text-xs font-medium text-slate-500">
                {authorPosition && `${authorPosition} • `}
                {formatTime(post.createdAt)}
              </p>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="inline-flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <span className="material-symbols-outlined leading-none">more_horiz</span>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-20">
                {isAuthor && (
                  <button
                    onClick={() => {
                      handleDelete();
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                    Xóa bài đăng
                  </button>
                )}
                <button
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors font-medium"
                >
                  <span className="material-symbols-outlined text-lg">bookmark</span>
                  Lưu bài đăng
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors font-medium"
                >
                  <span className="material-symbols-outlined text-lg">flag</span>
                  Báo cáo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {post.content && (
          <p className="max-w-full whitespace-pre-wrap break-words text-slate-800 text-base leading-relaxed mb-4 [overflow-wrap:anywhere]">
            {renderContent()}
          </p>
        )}

        {/* Image attachments */}
        {imageAttachments.length > 0 && (
          <div
            className={`grid gap-2 mb-3 rounded-xl overflow-hidden ${
              imageAttachments.length === 1
                ? "grid-cols-1"
                : imageAttachments.length === 2
                ? "grid-cols-2"
                : "grid-cols-2"
            }`}
          >
            {imageAttachments.map((att, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={getPostAttachmentUrl(att)}
                  alt={att.fileName}
                  className={`w-full object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity ${
                    imageAttachments.length === 1
                      ? "max-h-[400px]"
                      : "h-36 sm:h-48"
                  }`}
                />
                <a
                  href={getPostAttachmentDownloadUrl(att)}
                  download={att.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-white/90 text-slate-600 opacity-0 shadow-sm transition-all hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
                  title="Tải xuống"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="material-symbols-outlined text-[20px] leading-none">
                    download
                  </span>
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Video attachments */}
        {videoAttachments.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {videoAttachments.map((att, idx) => (
              <div key={idx} className="relative group">
                <video
                  src={getPostAttachmentUrl(att)}
                  controls
                  className="w-full max-h-[400px] rounded-xl"
                />
                <a
                  href={getPostAttachmentDownloadUrl(att)}
                  download={att.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-white/90 text-slate-600 opacity-0 shadow-sm transition-all hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
                  title="Tải xuống"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="material-symbols-outlined text-[20px] leading-none">
                    download
                  </span>
                </a>
              </div>
            ))}
          </div>
        )}

        {/* File attachments */}
        {fileAttachments.length > 0 && (
          <div className="flex flex-col gap-2 mb-2">
            {fileAttachments.map((att, idx) => (
              <a
                key={idx}
                href={getPostAttachmentDownloadUrl(att)}
                download={att.fileName}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-4 border border-slate-200/60 rounded-xl hover:bg-slate-50 cursor-pointer transition-all duration-300 hover:shadow-sm"
              >
                <div
                  className={`p-2.5 rounded-xl shadow-sm ${getAttachmentIconClass(att)}`}
                >
                  <span className="material-symbols-outlined icon-fill text-2xl">
                    {getAttachmentIcon(att)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {att.fileName}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {formatFileSize(att.fileSize)}
                  </p>
                </div>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                  <span className="material-symbols-outlined leading-none">download</span>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:gap-x-6 sm:px-5">
        <ReactionPicker
          isActive={reactionState.isLiked}
          reactionType={reactionState.reactionType}
          count={reactionState.likesCount}
          onSelect={handleReactionSelect}
        />

        <button
          onClick={() => setShowComments(!showComments)}
          className="group flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors text-sm font-bold"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-full transition-colors group-hover:bg-slate-100">
            <span className="material-symbols-outlined text-[20px] leading-none">
              chat_bubble_outline
            </span>
          </span>
          <span>
            {commentsCount} Bình luận
          </span>
        </button>

        <button className="group flex items-center gap-1.5 text-sm font-bold text-slate-500 transition-colors hover:text-slate-800 sm:ml-auto">
          <span className="inline-flex size-8 items-center justify-center rounded-full transition-colors group-hover:bg-slate-100">
            <span className="material-symbols-outlined text-[20px] leading-none">share</span>
          </span>
          <span>Chia sẻ</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <CommentSection
          postId={post.id}
          initialCommentsCount={commentsCount}
          onCommentCountChange={handleCommentCountChange}
        />
      )}
    </article>
  );
};

export default PostCard;
