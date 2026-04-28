import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { likePost, deletePost } from "../../api/postApi";
import CommentSection from "./CommentSection";
import {
  formatFileSize,
  getAttachmentDownloadUrl,
  getAttachmentIcon,
  getAttachmentIconClass,
  getAttachmentType,
  getAttachmentUrl,
} from "./attachmentUtils";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const PostCard = ({ post, onPostDeleted, onPostUpdated }) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = user?._id === post.author?._id;

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(dateStr).toLocaleDateString("vi-VN");
  };

  const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    return avatar.startsWith("http") ? avatar : `${API_URL}${avatar}`;
  };

  const getPostAttachmentUrl = (attachment) =>
    getAttachmentUrl(attachment, API_URL);

  const getPostAttachmentDownloadUrl = (attachment) =>
    getAttachmentDownloadUrl(attachment, API_URL);

  const handleLike = async () => {
    try {
      const prevLiked = liked;
      const prevCount = likesCount;
      setLiked(!liked);
      setLikesCount(liked ? likesCount - 1 : likesCount + 1);

      const res = await likePost(post.id);
      setLiked(res.liked);
      setLikesCount(res.likesCount);
    } catch {
      setLiked(!liked);
      setLikesCount(likesCount);
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
      className={`bg-white/90 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 transition-opacity ${
        isDeleting ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {authorAvatar ? (
              <img
                src={authorAvatar}
                alt={post.author?.fullName}
                className="size-11 rounded-full shadow-sm object-cover"
              />
            ) : (
              <div className="size-11 rounded-full shadow-sm bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                {post.author?.fullName?.charAt(0) || "?"}
              </div>
            )}
            <div>
              <p className="text-slate-900 text-sm font-bold">
                {post.author?.fullName || "Ẩn danh"}
              </p>
              <p className="text-slate-500 text-xs font-medium">
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
          <p className="text-slate-800 text-base leading-relaxed mb-4">
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
                      : "h-48"
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
      <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-6 bg-slate-50/50 rounded-b-2xl">
        <button
          onClick={handleLike}
          className={`group flex items-center gap-1.5 transition-colors text-sm font-bold ${
            liked
              ? "text-blue-600"
              : "text-slate-500 hover:text-blue-600"
          }`}
        >
          <span
            className={`inline-flex size-8 items-center justify-center rounded-full transition-colors ${
              liked
                ? "bg-blue-50 text-blue-500"
                : "text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] leading-none ${
                liked ? "icon-fill" : ""
              }`}
            >
              thumb_up
            </span>
          </span>
          <span>{likesCount}</span>
        </button>

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

        <button className="group flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors text-sm font-bold ml-auto">
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
          onCommentCountChange={(count) => setCommentsCount(count)}
        />
      )}
    </article>
  );
};

export default PostCard;
