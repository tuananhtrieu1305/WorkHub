import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { getPosts } from "../../api/postApi";
import CreatePostBox from "./CreatePostBox";
import PostCard from "./PostCard";
import { FeedListSkeleton, FeedPostSkeleton } from "../../components/common/Skeleton";

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

const FeedPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);
  const isLoadingRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const activeOrganizationId = toComparableId(
    user?.activeOrganization?.id || user?.activeOrganizationId,
  );
  const activeOrganizationIdRef = useRef(activeOrganizationId);

  const fetchPosts = useCallback(async (pageNum, reset = false) => {
    if (isLoadingRef.current) return;
    const requestOrganizationId = activeOrganizationId;
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const res = await getPosts({ page: pageNum, size: 10 });
      const isCurrentRequest =
        requestId === requestSequenceRef.current &&
        requestOrganizationId === activeOrganizationIdRef.current;
      if (!isCurrentRequest) return;
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
      const isCurrentRequest =
        requestId === requestSequenceRef.current &&
        requestOrganizationId === activeOrganizationIdRef.current;
      if (isCurrentRequest) {
        isLoadingRef.current = false;
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, [activeOrganizationId]);

  useEffect(() => {
    activeOrganizationIdRef.current = activeOrganizationId;
  }, [activeOrganizationId]);

  useEffect(() => {
    requestSequenceRef.current += 1;
    isLoadingRef.current = false;
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setIsInitialLoad(true);
    fetchPosts(1, true);
  }, [activeOrganizationId, fetchPosts]);

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
  }, [fetchPosts, page, hasMore, isLoading, isInitialLoad]);

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
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-5 sm:py-6 lg:gap-6 lg:px-8 lg:py-8">
      <CreatePostBox onPostCreated={handlePostCreated} />

      {isInitialLoad ? (
        <FeedListSkeleton count={3} />
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
            <div ref={sentinelRef} className="py-2">
              {isLoading && <FeedPostSkeleton compact />}
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
