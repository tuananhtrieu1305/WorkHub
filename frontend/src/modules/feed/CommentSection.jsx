import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { getComments, createComment, deleteComment } from "../../api/postApi";
import { EmojiPickerButton, appendEmojiToText } from "../../components/emoji";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const CommentSection = ({ postId, onCommentCountChange }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const commentInputRef = useRef(null);

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";
  const avatarUrl = user?.avatar
    ? user.avatar.startsWith("http")
      ? user.avatar
      : `${API_URL}${user.avatar}`
    : null;

  useEffect(() => {
    fetchComments(1, true);
  }, [postId]);

  const fetchComments = async (pageNum, reset = false) => {
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await createComment(postId, { content: newComment });
      setComments((prev) => [created, ...prev]);
      setNewComment("");
      setTotalCount((prev) => prev + 1);
      onCommentCountChange?.(totalCount + 1);
    } catch (err) {
      console.error("Failed to create comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmojiSelect = (emojiNative) => {
    setNewComment((prev) => appendEmojiToText(prev, emojiNative));
    requestAnimationFrame(() => commentInputRef.current?.focus());
  };

  const handleDelete = async (commentId) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => (c.id || c._id) !== commentId));
      setTotalCount((prev) => prev - 1);
      onCommentCountChange?.(totalCount - 1);
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

  const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    return avatar.startsWith("http") ? avatar : `${API_URL}${avatar}`;
  };

  return (
    <div className="border-t border-slate-100 bg-slate-50/30">
      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="flex gap-3 px-5 py-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user?.fullName}
            className="size-9 rounded-full object-cover shrink-0 mt-0.5"
          />
        ) : (
          <div className="size-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
            {userInitial}
          </div>
        )}
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={commentInputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Viết bình luận..."
              className="w-full bg-white border border-slate-200 rounded-full py-2 pl-4 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 transition-all"
            />
            <EmojiPickerButton
              className="absolute right-1 top-1/2 z-20 -translate-y-1/2"
              buttonClassName="!h-8 !w-8"
              onEmojiSelect={handleEmojiSelect}
              placement="top"
              label="Chèn biểu tượng cảm xúc vào bình luận"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            <span className="material-symbols-outlined text-xl">send</span>
          </button>
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
              const isCommentAuthor = user?._id === comment.author?._id;
              const cId = comment.id || comment._id;
              return (
                <div key={cId} className="flex gap-3 group">
                  {cAvatar ? (
                    <img
                      src={cAvatar}
                      alt={comment.author?.fullName}
                      className="size-8 rounded-full object-cover shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="size-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {comment.author?.fullName?.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-2xl px-4 py-2.5 inline-block max-w-full border border-slate-100">
                      <p className="text-sm font-bold text-slate-900">
                        {comment.author?.fullName || "Ẩn danh"}
                      </p>
                      <p className="text-sm text-slate-700 mt-0.5 break-words">
                        {comment.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 mt-1 ml-1">
                      <span className="text-xs text-slate-400 font-medium">
                        {formatTime(comment.createdAt)}
                      </span>
                      <button className="text-xs text-slate-400 hover:text-blue-600 font-bold transition-colors">
                        Thích
                      </button>
                      <button className="text-xs text-slate-400 hover:text-blue-600 font-bold transition-colors">
                        Trả lời
                      </button>
                      {isCommentAuthor && (
                        <button
                          onClick={() => handleDelete(cId)}
                          className="text-xs text-slate-400 hover:text-red-600 font-bold transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load more */}
            {hasMore && (
              <button
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
