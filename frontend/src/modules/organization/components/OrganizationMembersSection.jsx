import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getActivityStatusMeta,
  getEffectiveActivityStatus,
} from "../../chat/activityStatus";
import { formatDate, hasPermission } from "../organizationUtils";
import Icon from "./Icon";
import MemberAvatar from "./MemberAvatar";
import { TableRowsSkeleton } from "../../../components/common/Skeleton";

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

const getMemberRoleIdSet = (member = {}) =>
  new Set(
    [
      ...(member.roleIds || []),
      ...(member.roles || []).map((role) => role.id),
      member.roleId,
    ]
      .filter(Boolean)
      .map((roleId) => String(roleId)),
  );

const getMemberName = (member) =>
  member?.user?.fullName || member?.user?.email || "Thành viên";

const activityFilterOptions = [
  { value: "all", label: "Tất cả", icon: "tune" },
  { value: "online", label: "Trực tuyến", icon: "circle" },
  { value: "idle", label: "Chờ", icon: "dark_mode" },
  { value: "dnd", label: "Không làm phiền", icon: "do_not_disturb_on" },
  { value: "offline", label: "Ngoại tuyến", icon: "offline_ring" },
];

const findFilterOption = (options, value) =>
  options.find((option) => option.value === value) || options[0];

const FilterDropdown = ({ ariaLabel, onChange, options, value }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const selected = findFilterOption(options, value);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm font-black shadow-sm transition duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 ${
          open
            ? "border-blue-300 bg-white text-blue-900 shadow-blue-100/70"
            : "border-slate-200 bg-slate-50 text-slate-950 hover:border-blue-200 hover:bg-white"
        }`}
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selected?.color ? (
            <span
              className="size-2.5 shrink-0 rounded-full ring-2 ring-white"
              style={{ backgroundColor: selected.color }}
            />
          ) : (
            <Icon
              name={selected?.icon || "filter_list"}
              className="shrink-0 text-xl leading-none text-slate-500"
            />
          )}
          <span className="truncate">{selected?.label}</span>
        </span>
        <Icon
          name="expand_more"
          className={`shrink-0 text-slate-400 transition duration-200 ${
            open ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </button>

      <div
        className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 origin-top overflow-hidden rounded-[1.25rem] bg-white shadow-2xl ring-1 ring-slate-200 transition duration-200 ${
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
        <div className="max-h-72 overflow-y-auto p-1.5">
          {options.map((option) => {
            const selectedOption = option.value === selected?.value;
            return (
              <button
                key={option.value || option.label}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                  selectedOption
                    ? "bg-blue-50 text-blue-800"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {option.color ? (
                    <span
                      className="size-2.5 shrink-0 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: option.color }}
                    />
                  ) : (
                    <Icon
                      name={option.icon || "filter_list"}
                      className="shrink-0 text-lg leading-none"
                    />
                  )}
                  <span className="truncate text-sm font-black">
                    {option.label}
                  </span>
                </span>
                {selectedOption && (
                  <Icon name="check_circle" className="shrink-0 text-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const RoleBadge = ({ compact = true, role }) => {
  const color = role?.color || "#2563eb";

  return (
    <span
      className={`inline-flex w-fit max-w-full items-center gap-1.5 rounded-2xl font-black ring-1 ${
        compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
      }`}
      style={{
        backgroundColor: `${color}18`,
        borderColor: `${color}2e`,
        color,
      }}
    >
      <Icon name="server_person" className="text-base leading-none" />
      <span className="truncate">{role?.name || "Thành viên"}</span>
    </span>
  );
};

const MemberRoleCell = ({ member, onToggle, open }) => {
  const roles = getMemberRoles(member);
  const primaryRole = roles[0];
  const extraRoles = roles.slice(1);

  return (
    <div className="relative flex min-w-0 items-center gap-2">
      <RoleBadge role={primaryRole} />
      {extraRoles.length > 0 && (
        <button
          type="button"
          onClick={onToggle}
          title="Xem tất cả các vai trò"
          aria-label="Xem tất cả các vai trò"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600 ring-1 ring-slate-200 transition hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-100"
        >
          +{extraRoles.length}
        </button>
      )}
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 grid min-w-56 gap-2 rounded-2xl bg-white p-3 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-200 lg:left-full lg:top-0 lg:ml-2 lg:mt-0">
          {roles.map((role) => (
            <RoleBadge key={role.id || role.key || role.name} role={role} />
          ))}
        </div>
      )}
    </div>
  );
};

const activityBadgeClasses = {
  online: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  idle: "bg-amber-50 text-amber-700 ring-amber-100",
  dnd: "bg-rose-50 text-rose-700 ring-rose-100",
  offline: "bg-slate-100 text-slate-500 ring-slate-200",
};

const getVisibleActivityStatus = (member) => {
  const status = getEffectiveActivityStatus({
    activityStatus: member.user?.activityStatus,
    isOnline: Boolean(member.user?.isOnline),
  });
  return status === "invisible" ? "offline" : status;
};

const ActivityBadge = ({ member }) => {
  const status = getVisibleActivityStatus(member);
  const meta = getActivityStatusMeta(status);
  const label =
    status === "online" ? "Trực tuyến" : meta.menuLabel || "Ngoại tuyến";

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-black ring-1 ${
        activityBadgeClasses[status] || activityBadgeClasses.offline
      }`}
      title={label}
    >
      <Icon name={meta.icon} className="text-base leading-none" />
      {label}
    </span>
  );
};

const MemberRoleAssignModal = ({ member, onClose, onSubmit, roles }) => {
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!member || typeof document === "undefined") return null;

  const toggleRole = (roleId) => {
    setSelectedRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((item) => item !== roleId)
        : [...current, roleId],
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedRoleIds.length || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(member, selectedRoleIds);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="organization-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <form
        onSubmit={submit}
        className="organization-modal-card relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-2xl ring-1 ring-slate-200"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h3 className="text-xl font-black text-slate-950">Thêm vai trò</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Chọn các vai trò muốn thêm cho {getMemberName(member)}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="Đóng"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex min-w-0 items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <MemberAvatar member={member} />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">
                {getMemberName(member)}
              </p>
              <p className="truncate text-xs font-semibold text-slate-500">
                {member.user?.email || "Chưa có email"}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            {roles.length ? (
              roles.map((role) => {
                const checked = selectedRoleIds.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRole(role.id)}
                    className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left ring-1 transition active:scale-[0.99] ${
                      checked
                        ? "bg-blue-50 ring-blue-200"
                        : "bg-white ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <RoleBadge compact={false} role={role} />
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-xl border text-white transition ${
                        checked
                          ? "border-blue-600 bg-blue-600"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {checked && <Icon name="check" className="text-lg leading-none" />}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                <Icon name="admin_panel_settings" className="text-4xl leading-none text-slate-300" />
                <p className="text-sm font-black text-slate-600">
                  Không còn vai trò có thể thêm.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/80 p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!selectedRoleIds.length || isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name={isSubmitting ? "progress_activity" : "add"} />
            Thêm vai trò
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
};

const OrganizationMembersSection = ({
  filters,
  isLoading,
  members,
  onBanMember,
  onChangeFilters,
  onChangeRole,
  onKickMember,
  organization,
  pagination,
  roles,
}) => {
  const [openRoleMemberId, setOpenRoleMemberId] = useState("");
  const [roleAssignMember, setRoleAssignMember] = useState(null);
  const canManageMembers = hasPermission(organization, "manageMembers");
  const manageableRoles = useMemo(
    () => roles.filter((role) => role.canManage !== false),
    [roles],
  );
  const assignableRolesForModal = useMemo(() => {
    if (!roleAssignMember) return [];
    const memberRoleIds = getMemberRoleIdSet(roleAssignMember);
    return manageableRoles.filter((role) => !memberRoleIds.has(String(role.id)));
  }, [manageableRoles, roleAssignMember]);
  const roleFilterOptions = useMemo(
    () => [
      { value: "", label: "Mọi vai trò", icon: "admin_panel_settings" },
      ...roles.map((role) => ({
        value: role.id,
        label: role.name,
        icon: "server_person",
        color: role.color || "#2563eb",
      })),
    ],
    [roles],
  );
  const activityStatusValue = filters.activityStatus || "all";
  const currentPage = pagination?.page || filters.page || 1;
  const totalPages = pagination?.totalPages || 0;
  const pageSize = pagination?.size || filters.size || 8;
  const totalElements = pagination?.totalElements || 0;
  const rangeStart = totalElements ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = totalElements
    ? Math.min(currentPage * pageSize, totalElements)
    : 0;

  const changeFilters = (updates, { resetPage = true } = {}) => {
    onChangeFilters((current) => ({
      ...current,
      ...updates,
      page: resetPage ? 1 : updates.page || current.page || 1,
    }));
  };

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
        <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_180px_190px]">
          <label className="relative block">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg leading-none text-slate-400"
            />
            <input
              value={filters.search || ""}
              onChange={(event) => changeFilters({ search: event.target.value })}
              placeholder="Tìm kiếm"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <FilterDropdown
            ariaLabel="Lọc theo trạng thái hoạt động"
            onChange={(value) => changeFilters({ activityStatus: value })}
            options={activityFilterOptions}
            value={activityStatusValue}
          />
          <FilterDropdown
            ariaLabel="Lọc theo vai trò"
            onChange={(value) => changeFilters({ role: value })}
            options={roleFilterOptions}
            value={filters.role || ""}
          />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[310px]" />
              <col className="w-[140px]" />
              <col className="w-[270px]" />
              <col className="w-[170px]" />
              <col className="w-[230px]" />
            </colgroup>
            <thead>
              <tr className="text-xs font-black uppercase">
                <th className="bg-blue-50 px-4 py-3 text-blue-700">
                  Người dùng
                </th>
                <th className="bg-emerald-50 px-4 py-3 text-emerald-700">
                  Gia nhập
                </th>
                <th className="bg-violet-50 px-4 py-3 text-violet-700">
                  Vai trò
                </th>
                <th className="bg-amber-50 px-4 py-3 text-amber-700">
                  Hoạt động
                </th>
                <th className="bg-rose-50 px-4 py-3 text-right text-rose-700">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <TableRowsSkeleton rows={4} columns={5} colSpan={5} />
              ) : members.length ? (
                members.map((member) => {
                  const memberRoleIds = getMemberRoleIdSet(member);
                  const assignableRoles = manageableRoles.filter(
                    (role) => !memberRoleIds.has(String(role.id)),
                  );
                  const canManageRow =
                    canManageMembers &&
                    !member.isOwner &&
                    member.canManage !== false &&
                    member.status !== "banned" &&
                    member.status !== "removed";
                  const memberName = getMemberName(member);

                  return (
                    <tr
                      key={member.id}
                      className="align-middle transition hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <MemberAvatar member={member} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950">
                              {member.user?.fullName || "Người dùng"}
                            </p>
                            <p className="truncate text-xs font-semibold text-slate-500">
                              {member.user?.email || "Chưa có email"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-sm font-black tabular-nums text-slate-700">
                          {formatDate(member.joinedAt) || "Chưa gia nhập"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <MemberRoleCell
                          member={member}
                          onToggle={() =>
                            setOpenRoleMemberId((current) =>
                              current === member.id ? "" : member.id,
                            )
                          }
                          open={openRoleMemberId === member.id}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <ActivityBadge member={member} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {canManageRow ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setRoleAssignMember(member)}
                                disabled={!assignableRoles.length}
                                className="inline-flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-45"
                                aria-label={`Thêm vai trò cho ${memberName}`}
                                title="Thêm vai trò"
                              >
                                <Icon name="add" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onKickMember?.(member)}
                                className="inline-flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 transition hover:bg-amber-100"
                                aria-label={`Đuổi ${memberName}`}
                                title="Đuổi"
                              >
                                <Icon name="person_remove" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onBanMember?.(member)}
                                className="inline-flex size-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                                aria-label={`Chặn ${memberName}`}
                                title="Chặn"
                              >
                                <Icon name="block" />
                              </button>
                            </>
                          ) : (
                            <span className="inline-flex h-9 items-center rounded-xl bg-slate-50 px-3 text-xs font-black text-slate-400 ring-1 ring-slate-200">
                              Chỉ xem
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="grid place-items-center gap-2 px-4 py-12 text-center">
                      <Icon
                        name="person_search"
                        className="text-4xl leading-none text-slate-300"
                      />
                      <p className="text-sm font-black text-slate-600">
                        Không tìm thấy thành viên phù hợp.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 rounded-b-3xl border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-slate-500">
            {totalElements
              ? `Hiển thị ${rangeStart}-${rangeEnd} trong ${totalElements} thành viên`
              : "Chưa có thành viên để hiển thị"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                changeFilters({ page: Math.max(1, currentPage - 1) }, { resetPage: false })
              }
              disabled={pagination?.first || currentPage <= 1}
              className="grid size-9 place-items-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Trang trước"
              title="Trang trước"
            >
              <Icon name="chevron_left" />
            </button>
            <span className="min-w-24 text-center text-xs font-black text-slate-600">
              Trang {totalPages ? currentPage : 0}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                changeFilters({ page: currentPage + 1 }, { resetPage: false })
              }
              disabled={pagination?.last || !totalPages || currentPage >= totalPages}
              className="grid size-9 place-items-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Trang sau"
              title="Trang sau"
            >
              <Icon name="chevron_right" />
            </button>
          </div>
        </div>
      </div>

      <MemberRoleAssignModal
        key={roleAssignMember?.id || "empty-role-assign"}
        member={roleAssignMember}
        onClose={() => setRoleAssignMember(null)}
        onSubmit={onChangeRole}
        roles={assignableRolesForModal}
      />
    </section>
  );
};

export default OrganizationMembersSection;
