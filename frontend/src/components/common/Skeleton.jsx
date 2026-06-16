const joinClassNames = (...classNames) => classNames.filter(Boolean).join(" ");

export const SkeletonBlock = ({ className = "" }) => (
  <span
    aria-hidden="true"
    className={joinClassNames("workhub-skeleton block", className)}
  />
);

export const RoutePageSkeleton = () => (
  <div
    className="route-loading-screen px-4 py-6"
    aria-busy="true"
    aria-label="Dang tai trang"
  >
    <div className="grid w-full max-w-5xl gap-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <SkeletonBlock className="size-12 rounded-2xl" />
          <div className="grid flex-1 gap-2">
            <SkeletonBlock className="h-5 w-48 max-w-full rounded-full" />
            <SkeletonBlock className="h-3 w-72 max-w-full rounded-full" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonBlock className="h-36 rounded-3xl" />
        <SkeletonBlock className="h-36 rounded-3xl" />
        <SkeletonBlock className="h-36 rounded-3xl" />
      </div>
      <SkeletonBlock className="h-72 rounded-3xl" />
    </div>
  </div>
);

export const FeedPostSkeleton = ({ compact = false }) => (
  <article
    className="max-w-full rounded-2xl border border-slate-100 bg-white/90 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)]"
    aria-hidden="true"
  >
    <div className="p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SkeletonBlock className="size-10 shrink-0 rounded-full sm:size-11" />
          <div className="grid min-w-0 flex-1 gap-2">
            <SkeletonBlock className="h-4 w-40 max-w-full rounded-full" />
            <SkeletonBlock className="h-3 w-28 max-w-full rounded-full" />
          </div>
        </div>
        <SkeletonBlock className="size-8 shrink-0 rounded-full" />
      </div>

      <div className="mb-4 grid gap-2">
        <SkeletonBlock className="h-4 w-full rounded-full" />
        <SkeletonBlock className="h-4 w-11/12 rounded-full" />
        {!compact && <SkeletonBlock className="h-4 w-2/3 rounded-full" />}
      </div>

      {!compact && <SkeletonBlock className="mb-3 h-52 rounded-xl sm:h-64" />}
    </div>

    <div className="flex items-center gap-5 rounded-b-2xl border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
      <SkeletonBlock className="h-8 w-24 rounded-full" />
      <SkeletonBlock className="h-8 w-28 rounded-full" />
      <SkeletonBlock className="ml-auto h-8 w-20 rounded-full" />
    </div>
  </article>
);

export const FeedListSkeleton = ({ count = 3, compact = false }) => (
  <div className="flex flex-col gap-6" aria-busy="true">
    {Array.from({ length: count }, (_, index) => (
      <FeedPostSkeleton key={index} compact={compact || index > 0} />
    ))}
  </div>
);

export const CommentListSkeleton = ({ count = 3, compact = false }) => (
  <div className="flex flex-col gap-3" aria-busy="true">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="flex gap-3">
        <SkeletonBlock
          className={joinClassNames(
            "shrink-0 rounded-full",
            compact ? "size-7" : "size-8",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="inline-grid max-w-full gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3">
            <SkeletonBlock className="h-3 w-28 rounded-full" />
            <SkeletonBlock className="h-3 w-64 max-w-full rounded-full" />
            {!compact && <SkeletonBlock className="h-3 w-44 max-w-full rounded-full" />}
          </div>
          <div className="ml-1 mt-2 flex gap-3">
            <SkeletonBlock className="h-3 w-12 rounded-full" />
            <SkeletonBlock className="h-3 w-14 rounded-full" />
            <SkeletonBlock className="h-3 w-12 rounded-full" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const CommentReplySkeleton = () => (
  <div className="flex gap-2" aria-busy="true">
    <SkeletonBlock className="size-7 shrink-0 rounded-full" />
    <div className="min-w-0 flex-1">
      <div className="inline-grid max-w-full gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3">
        <SkeletonBlock className="h-3 w-24 rounded-full" />
        <SkeletonBlock className="h-3 w-48 max-w-full rounded-full" />
      </div>
      <div className="ml-1 mt-2 flex gap-3">
        <SkeletonBlock className="h-3 w-10 rounded-full" />
        <SkeletonBlock className="h-3 w-12 rounded-full" />
      </div>
    </div>
  </div>
);

export const ConversationListSkeleton = ({ count = 7 }) => (
  <div className="mb-1 mt-1 flex flex-col" aria-busy="true">
    {Array.from({ length: count }, (_, index) => (
      <div
        key={index}
        className="mx-2 my-1 flex w-[calc(100%-1rem)] items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
      >
        <SkeletonBlock className="mt-0.5 size-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <SkeletonBlock className="h-4 w-32 max-w-full rounded-full" />
            <SkeletonBlock className="h-3 w-11 shrink-0 rounded-full" />
          </div>
          <SkeletonBlock
            className={joinClassNames(
              "h-3 rounded-full",
              index % 3 === 0 ? "w-4/5" : "w-11/12",
            )}
          />
        </div>
      </div>
    ))}
  </div>
);

export const MessageThreadSkeleton = ({ count = 6, compact = false }) => (
  <div
    className={joinClassNames(
      "flex w-full flex-col",
      compact ? "gap-3" : "gap-4",
    )}
    aria-busy="true"
  >
    {Array.from({ length: count }, (_, index) => {
      const isMine = index % 3 === 1;
      return (
        <div
          key={index}
          className={joinClassNames(
            "flex items-end gap-2",
            isMine ? "justify-end" : "justify-start",
          )}
        >
          {!isMine && !compact && (
            <SkeletonBlock className="size-8 shrink-0 rounded-full" />
          )}
          <div
            className={joinClassNames(
              "grid max-w-[78%] gap-2 rounded-2xl border p-3",
              isMine
                ? "border-blue-100 bg-blue-50/70"
                : "border-slate-200 bg-white",
            )}
          >
            {!isMine && <SkeletonBlock className="h-3 w-24 rounded-full" />}
            <SkeletonBlock
              className={joinClassNames(
                "h-3 rounded-full",
                index % 2 === 0 ? "w-64 max-w-full" : "w-44 max-w-full",
              )}
            />
            {!compact && index % 2 === 0 && (
              <SkeletonBlock className="h-3 w-40 max-w-full rounded-full" />
            )}
          </div>
        </div>
      );
    })}
  </div>
);

export const TableRowsSkeleton = ({ rows = 3, columns = 4, colSpan = 1 }) =>
  Array.from({ length: rows }, (_, rowIndex) => (
    <tr key={rowIndex}>
      <td colSpan={colSpan} className="px-4 py-4">
        <div
          className="grid items-center gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <div
              key={columnIndex}
              className={joinClassNames(
                "flex items-center gap-3",
                columnIndex === columns - 1 ? "justify-end" : "",
              )}
            >
              {columnIndex === 0 && (
                <SkeletonBlock className="size-10 shrink-0 rounded-xl" />
              )}
              <SkeletonBlock
                className={joinClassNames(
                  "h-4 rounded-full",
                  columnIndex === 0
                    ? "w-32"
                    : columnIndex === columns - 1
                      ? "w-20"
                      : "w-24",
                )}
              />
            </div>
          ))}
        </div>
      </td>
    </tr>
  ));

export const PanelListSkeleton = ({ count = 3, iconRounded = "rounded-xl" }) => (
  <div className="grid gap-0 divide-y divide-slate-100" aria-busy="true">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="flex items-center gap-3 px-4 py-4">
        <SkeletonBlock className={joinClassNames("size-10 shrink-0", iconRounded)} />
        <div className="grid min-w-0 flex-1 gap-2">
          <SkeletonBlock className="h-4 w-40 max-w-full rounded-full" />
          <SkeletonBlock className="h-3 w-56 max-w-full rounded-full" />
        </div>
        <SkeletonBlock className="h-8 w-24 shrink-0 rounded-xl" />
      </div>
    ))}
  </div>
);

export const NotificationPanelSkeleton = ({ count = 3 }) => (
  <div className="space-y-2" aria-busy="true">
    {Array.from({ length: count }, (_, index) => (
      <div
        key={index}
        className="flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"
      >
        <SkeletonBlock className="size-9 shrink-0 rounded-full" />
        <div className="grid min-w-0 flex-1 gap-2">
          <SkeletonBlock className="h-3 w-full rounded-full" />
          <SkeletonBlock className="h-3 w-4/5 rounded-full" />
          <SkeletonBlock className="h-3 w-24 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);
