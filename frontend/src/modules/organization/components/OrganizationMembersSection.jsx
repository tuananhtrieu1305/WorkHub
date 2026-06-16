import { formatDate, hasPermission } from "../organizationUtils";
import Icon from "./Icon";
import MemberAvatar from "./MemberAvatar";
import { PanelListSkeleton } from "../../../components/common/Skeleton";

const activityLabel = (member) => {
  if (member.user?.isOnline) return "Online";
  if (member.user?.activityStatus === "busy") return "Đang bận";
  if (member.user?.activityStatus === "away") return "Vắng mặt";
  return "Offline";
};

const getMemberRoles = (member = {}) =>
  Array.isArray(member.roles) && member.roles.length
    ? member.roles
    : [
        {
          id: member.roleId,
          key: member.role,
          name: member.roleLabel || "Thành viên",
          color: member.roleColor || "#2563eb",
        },
      ];

const MemberRoleBadges = ({ member }) => (
  <div className="flex flex-wrap gap-1.5">
    {getMemberRoles(member).map((role) => (
      <span
        key={role.id || role.key || role.name}
        className="inline-flex w-fit items-center rounded-xl px-3 py-1.5 text-xs font-black"
        style={{
          backgroundColor: `${role.color || "#2563eb"}18`,
          color: role.color || "#2563eb",
        }}
      >
        {role.name || "Thành viên"}
      </span>
    ))}
  </div>
);

const OrganizationMembersSection = ({
  filters,
  isLoading,
  members,
  onChangeFilters,
  onChangeRole,
  organization,
  roles,
}) => {
  const canManageMembers = hasPermission(organization, "manageMembers");
  const manageableRoles = roles.filter((role) => role.canManage !== false);

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
            <Icon name="groups" />
            Thành viên
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Theo dõi trạng thái, vai trò và quyền thao tác của từng người.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_170px]">
          <label className="relative block">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg leading-none text-slate-400"
            />
            <input
              value={filters.search}
              onChange={(event) =>
                onChangeFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Tìm theo tên, email, vai trò"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <select
            value={filters.status}
            onChange={(event) =>
              onChangeFilters((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            {canManageMembers && <option value="pending">Chờ duyệt</option>}
          </select>
          <select
            value={filters.role}
            onChange={(event) =>
              onChangeFilters((current) => ({
                ...current,
                role: event.target.value,
              }))
            }
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Mọi vai trò</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl ring-1 ring-slate-200">
        <div className="hidden grid-cols-[minmax(260px,1.2fr)_150px_160px_150px_140px] bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-400 lg:grid">
          <span>Người dùng</span>
          <span>Gia nhập</span>
          <span>Vai trò</span>
          <span>Hoạt động</span>
          <span className="text-right">Thao tác</span>
        </div>

        {isLoading ? (
          <PanelListSkeleton count={4} iconRounded="rounded-2xl" />
        ) : members.length ? (
          <div className="divide-y divide-slate-100">
            {members.map((member) => {
              const memberRoleIds = new Set(
                [
                  ...(member.roleIds || []),
                  ...(member.roles || []).map((role) => role.id),
                ]
                  .filter(Boolean)
                  .map((roleId) => String(roleId)),
              );
              const assignableRoles = manageableRoles.filter(
                (role) => !memberRoleIds.has(String(role.id)),
              );

              return (
                <div
                  key={member.id}
                  className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(260px,1.2fr)_150px_160px_150px_140px] lg:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar member={member} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">
                        {member.user?.fullName || "Người dùng"}
                      </p>
                      <p className="truncate text-xs font-semibold text-slate-500">
                        {member.user?.email}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-600">
                    {formatDate(member.joinedAt) || "Chưa gia nhập"}
                  </span>
                  <MemberRoleBadges member={member} />
                  <span
                    className={`inline-flex w-fit items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-black ${
                      member.user?.isOnline
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <span
                      className={`size-2 rounded-full ${
                        member.user?.isOnline ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    {activityLabel(member)}
                  </span>
                  <div className="flex justify-start lg:justify-end">
                    {canManageMembers && !member.isOwner && member.canManage !== false ? (
                      <select
                        value=""
                        onChange={(event) => {
                          const nextRoleId = event.target.value;
                          if (nextRoleId) onChangeRole(member, nextRoleId);
                        }}
                        disabled={!assignableRoles.length}
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Thêm vai trò</option>
                        {assignableRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-black text-slate-400">
                        Chỉ xem
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid place-items-center gap-2 px-4 py-12 text-center">
            <Icon name="person_search" className="text-4xl leading-none text-slate-300" />
            <p className="text-sm font-black text-slate-600">
              Không tìm thấy thành viên phù hợp.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default OrganizationMembersSection;
