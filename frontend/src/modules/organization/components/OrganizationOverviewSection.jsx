import OverviewActivityTable from "./overview/OverviewActivityTable";
import OverviewBarChart from "./overview/OverviewBarChart";
import OverviewDashboardSkeleton from "./overview/OverviewDashboardSkeleton";
import OverviewLineChart from "./overview/OverviewLineChart";
import OverviewSidePanels from "./overview/OverviewSidePanels";
import OverviewStatCards from "./overview/OverviewStatCards";

const OrganizationOverviewSection = ({ isLoading, overview }) => {
  if (isLoading && !overview) {
    return <OverviewDashboardSkeleton />;
  }

  return (
    <section className="grid gap-5">
      <OverviewStatCards overview={overview} />

      <div className="grid gap-5 xl:grid-cols-12">
        <OverviewLineChart rows={overview?.activityTrend || []} />
        <OverviewBarChart rows={overview?.weeklyThroughput || []} />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <OverviewActivityTable rows={overview?.recentActivities || []} />
        <OverviewSidePanels overview={overview} />
      </div>
    </section>
  );
};

export default OrganizationOverviewSection;
