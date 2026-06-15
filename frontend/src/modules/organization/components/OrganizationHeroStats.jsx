import { getStat } from "../organizationUtils";
import StatTile from "./StatTile";

const OrganizationHeroStats = ({ organization, roleLabel = "" }) => (
  <div className="organization-hero-stat-row grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <StatTile
      icon="radio_button_checked"
      value={getStat(organization, "online")}
      label="Online"
      tone="emerald"
    />
    <StatTile
      icon="groups"
      value={getStat(organization, "members")}
      label="Thành viên"
      tone="sky"
    />
    <StatTile
      icon="verified_user"
      value={roleLabel || "Thành viên"}
      label="Vai trò"
      tone="violet"
      valueClassName="text-base leading-tight sm:text-lg"
    />
  </div>
);

export default OrganizationHeroStats;
