const OverviewDashboardSkeleton = () => (
  <section className="grid gap-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="h-40 animate-pulse rounded-[1.25rem] bg-white ring-1 ring-slate-200"
        />
      ))}
    </div>
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="h-[28rem] animate-pulse rounded-[1.5rem] bg-white ring-1 ring-slate-200 xl:col-span-7" />
      <div className="h-[28rem] animate-pulse rounded-[1.5rem] bg-white ring-1 ring-slate-200 xl:col-span-5" />
    </div>
  </section>
);

export default OverviewDashboardSkeleton;
