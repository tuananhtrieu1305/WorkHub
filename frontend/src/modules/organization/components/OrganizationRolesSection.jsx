import { useMemo, useRef, useState } from "react";
import { permissionLabels } from "../organizationUtils";
import Icon from "./Icon";
import { TableRowsSkeleton } from "../../../components/common/Skeleton";

const getDropPlacement = (event, element) => {
  const rect = element.getBoundingClientRect();
  return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
};

const moveRole = (roles, sourceRoleId, targetRoleId, placement = "before") => {
  if (!sourceRoleId || !targetRoleId || sourceRoleId === targetRoleId) {
    return roles;
  }

  const sourceIndex = roles.findIndex((role) => role.id === sourceRoleId);
  const targetIndex = roles.findIndex((role) => role.id === targetRoleId);
  if (sourceIndex < 0 || targetIndex < 0) return roles;

  const nextRoles = [...roles];
  const [movedRole] = nextRoles.splice(sourceIndex, 1);
  const nextTargetIndex = nextRoles.findIndex((role) => role.id === targetRoleId);
  const insertIndex =
    placement === "after" ? nextTargetIndex + 1 : nextTargetIndex;
  nextRoles.splice(insertIndex, 0, movedRole);

  return nextRoles.every((role, index) => role.id === roles[index]?.id)
    ? roles
    : nextRoles;
};

const RolePermissions = ({ permissionKeys, role }) => {
  const activePermissions = useMemo(
    () => permissionKeys.filter((key) => role.permissions?.[key]),
    [permissionKeys, role.permissions],
  );
  const visiblePermissions = activePermissions.slice(0, 8);
  const hiddenCount = Math.max(0, activePermissions.length - visiblePermissions.length);

  if (!activePermissions.length) {
    return (
      <span className="inline-flex w-fit rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500 ring-1 ring-slate-200">
        Chưa bật quyền
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visiblePermissions.map((key) => (
        <span
          key={key}
          className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200/70"
        >
          {permissionLabels[key] || key}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="rounded-xl bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">
          +{hiddenCount} quyền khác
        </span>
      )}
    </div>
  );
};

const OrganizationRolesSection = ({
  isLoading,
  onDeleteRole,
  onOpenRoleModal,
  onReorderRoles,
  organization,
  permissionKeys = [],
  roles = [],
}) => {
  const canManageRoles = Boolean(organization?.permissions?.manageRoles);
  const [draggingRoleId, setDraggingRoleId] = useState("");
  const [previewRoles, setPreviewRoles] = useState([]);
  const [roleSearch, setRoleSearch] = useState("");
  const didDropRef = useRef(false);
  const normalizedRoleSearch = roleSearch.trim().toLowerCase();
  const filteredRoles = useMemo(
    () =>
      normalizedRoleSearch
        ? roles.filter((role) =>
            [role.name, role.key, role.description].some((value) =>
              String(value || "").toLowerCase().includes(normalizedRoleSearch),
            ),
          )
        : roles,
    [normalizedRoleSearch, roles],
  );
  const canReorderRoles = canManageRoles && !normalizedRoleSearch;
  const displayedRoles = draggingRoleId ? previewRoles : filteredRoles;

  const commitRoleOrder = (nextRoles = displayedRoles) => {
    if (!draggingRoleId || !canReorderRoles) {
      setDraggingRoleId("");
      return;
    }

    setDraggingRoleId("");
    const changed = nextRoles.some((role, index) => role.id !== roles[index]?.id);
    if (changed) onReorderRoles?.(nextRoles);
  };

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
            <Icon name="admin_panel_settings" />
            Vai trò
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Sắp xếp thứ tự ưu tiên hiển thị và cấu hình quyền cho từng vai trò.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:min-w-[28rem] sm:flex-row sm:items-center sm:justify-end">
          <label className="relative block sm:flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg leading-none text-slate-400"
            />
            <input
              value={roleSearch}
              onChange={(event) => setRoleSearch(event.target.value)}
              placeholder="Tìm kiếm vai trò"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <button
            type="button"
            onClick={() => onOpenRoleModal()}
            disabled={!canManageRoles}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-lg shadow-blue-200/60 transition hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="add" />
            Tạo vai trò
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[72px]" />
              <col className="w-[260px]" />
              <col className="w-[440px]" />
              <col className="w-[150px]" />
              <col className="w-[118px]" />
            </colgroup>
            <thead>
              <tr className="text-xs font-black uppercase">
                <th className="bg-slate-50 px-4 py-3 text-slate-500">
                  Thứ tự
                </th>
                <th className="bg-blue-50 px-4 py-3 text-blue-700">Vai trò</th>
                <th className="bg-violet-50 px-4 py-3 text-violet-700">
                  Quyền
                </th>
                <th className="bg-emerald-50 px-4 py-3 text-emerald-700">
                  Số lượng
                </th>
                <th className="bg-rose-50 px-4 py-3 text-right text-rose-700">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <TableRowsSkeleton rows={3} columns={5} colSpan={5} />
              ) : displayedRoles.length ? (
                displayedRoles.map((role, index) => {
                  const roleColor = role.color || "#2563eb";
                  const roleManageable =
                    canManageRoles && role.canManage !== false;
                  const roleReorderable =
                    canReorderRoles && role.canReorder !== false;
                  const canDeleteRole =
                    roleManageable &&
                    !role.isDefault &&
                    Number(role.memberCount || 0) === 0;

                  return (
                    <tr
                      key={role.id}
                      onDragOver={(event) => {
                        if (
                          !canReorderRoles ||
                          !draggingRoleId ||
                          draggingRoleId === role.id ||
                          role.canReorder === false
                        ) {
                          return;
                        }
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setPreviewRoles((currentRoles) =>
                          moveRole(
                            currentRoles.length ? currentRoles : roles,
                            draggingRoleId,
                            role.id,
                            getDropPlacement(event, event.currentTarget),
                          ),
                        );
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        didDropRef.current = true;
                        const sourceRoleId =
                          event.dataTransfer.getData("application/x-role-id") ||
                          event.dataTransfer.getData("text/plain") ||
                          draggingRoleId;
                        const nextRoles = moveRole(
                          displayedRoles,
                          sourceRoleId,
                          role.id,
                          getDropPlacement(event, event.currentTarget),
                        );
                        setPreviewRoles(nextRoles);
                        commitRoleOrder(nextRoles);
                      }}
                      className={`align-middle transition ${
                        draggingRoleId === role.id
                          ? "bg-blue-50/70 opacity-70 shadow-inner"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      <td className="px-4 py-4">
                        <span
                          draggable={roleReorderable}
                          onDragStart={(event) => {
                            if (!roleReorderable) return;
                            didDropRef.current = false;
                            setPreviewRoles(roles);
                            setDraggingRoleId(role.id);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData(
                              "application/x-role-id",
                              role.id,
                            );
                            event.dataTransfer.setData("text/plain", role.id);
                          }}
                          onDragEnd={() => {
                            if (didDropRef.current) {
                              didDropRef.current = false;
                              setDraggingRoleId("");
                              return;
                            }
                            commitRoleOrder();
                          }}
                          className={`inline-flex size-10 items-center justify-center rounded-2xl text-slate-400 ring-1 ring-slate-200 transition ${
                            roleReorderable
                              ? "cursor-grab bg-white hover:bg-blue-50 hover:text-blue-700 active:cursor-grabbing"
                              : "cursor-not-allowed bg-slate-50 opacity-50"
                          }`}
                          title="Kéo để đổi thứ tự"
                        >
                          <Icon name="drag_indicator" className="text-2xl leading-none" />
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="grid size-11 shrink-0 place-items-center rounded-2xl ring-1"
                            style={{
                              backgroundColor: `${roleColor}16`,
                              color: roleColor,
                              borderColor: `${roleColor}2e`,
                            }}
                          >
                            <Icon
                              name="server_person"
                              className="text-2xl leading-none"
                            />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950">
                              {role.name}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              Ưu tiên #{index + 1}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <RolePermissions permissionKeys={permissionKeys} role={role} />
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                          <span className="font-mono text-sm tabular-nums">
                            {Number(role.memberCount || 0)}
                          </span>
                          <Icon name="person_apron" />
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenRoleModal(role)}
                            disabled={!roleManageable}
                            className="inline-flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Sửa vai trò"
                            title="Sửa vai trò"
                          >
                            <Icon name="edit" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRole(role)}
                            disabled={!canDeleteRole}
                            className="inline-flex size-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label="Xóa vai trò"
                            title={
                              role.isDefault
                                ? "Không thể xóa vai trò mặc định"
                                : Number(role.memberCount || 0) > 0
                                  ? "Chuyển thành viên sang vai trò khác trước"
                                  : "Xóa vai trò"
                            }
                          >
                            <Icon name="delete" />
                          </button>
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
                        name="badge"
                        className="text-4xl leading-none text-slate-300"
                      />
                      <p className="text-sm font-black text-slate-600">
                        {normalizedRoleSearch
                          ? "Không tìm thấy vai trò phù hợp."
                          : "Chưa có vai trò nào trong tổ chức."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default OrganizationRolesSection;
