import { useState, useEffect, useRef, useCallback } from "react";
import { getPosts } from "../../api/postApi";
import CreatePostBox from "./CreatePostBox";
import PostCard from "./PostCard";

const FeedPage = () => {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  const fetchPosts = useCallback(async (pageNum, reset = false) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await getPosts({ page: pageNum, size: 10 });
      const newPosts = res.content || [];

      if (reset) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNew = newPosts.filter((p) => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
      }

      const totalPages = res.totalPages || 1;
      setHasMore(pageNum < totalPages);
      setPage(pageNum);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, [isLoading]);

  useEffect(() => {
    fetchPosts(1, true);
  }, []);

  useEffect(() => {
    if (isInitialLoad || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          fetchPosts(page + 1);
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current = observer;

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [page, hasMore, isLoading, isInitialLoad]);

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
    );
  };

  return (
    <div className="max-w-[720px] mx-auto py-6 px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
      <CreatePostBox onPostCreated={handlePostCreated} />

      {isInitialLoad ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <span className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Đang tải bảng tin...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <span className="material-symbols-outlined text-6xl text-slate-200">
            dynamic_feed
          </span>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-400">Chưa có bài đăng nào</p>
            <p className="text-sm text-slate-400 mt-1">
              Hãy là người đầu tiên chia sẻ!
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPostDeleted={handlePostDeleted}
              onPostUpdated={handlePostUpdated}
            />
          ))}

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-6">
              {isLoading && (
                <span className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              )}
            </div>
          )}

          {/* End of feed indicator */}
          {!hasMore && posts.length > 0 && (
            <div className="flex items-center gap-4 py-8">
              <div className="flex-1 h-px bg-slate-200" />
              <div className="flex items-center gap-2 text-slate-400">
                <span className="material-symbols-outlined text-lg">check_circle</span>
                <span className="text-sm font-medium">Bạn đã xem hết bảng tin</span>
              </div>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedPage;
