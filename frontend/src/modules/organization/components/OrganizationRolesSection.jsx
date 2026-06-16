import { permissionLabels } from "../organizationUtils";
import Icon from "./Icon";
import { PanelListSkeleton } from "../../../components/common/Skeleton";

const OrganizationRolesSection = ({
  isLoading,
  onDeleteRole,
  onOpenRoleModal,
  organization,
  permissionKeys,
  roles,
}) => {
  const canManageRoles = Boolean(organization?.permissions?.manageRoles);

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
            <Icon name="admin_panel_settings" />
            Vai trò
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Tùy chỉnh role, màu sắc và permission toggle tương ứng.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenRoleModal()}
          disabled={!canManageRoles}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="add" />
          Tạo vai trò
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl ring-1 ring-slate-200">
        <div className="hidden grid-cols-[220px_minmax(280px,1fr)_160px_120px] bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-400 lg:grid">
          <span>Vai trò</span>
          <span>Quyền</span>
          <span>Loại</span>
          <span className="text-right">Thao tác</span>
        </div>
        {isLoading ? (
          <PanelListSkeleton count={3} />
        ) : (
          <div className="divide-y divide-slate-100">
            {roles.map((role) => (
              <div
                key={role.id}
                className="grid gap-4 px-4 py-4 lg:grid-cols-[220px_minmax(280px,1fr)_160px_120px] lg:items-center"
              >
                <div className="min-w-0">
                  <span
                    className="inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-black"
                    style={{
                      backgroundColor: `${role.color || "#2563eb"}18`,
                      color: role.color || "#2563eb",
                    }}
                  >
                    {role.name}
                  </span>
                  <p className="mt-2 truncate text-xs font-bold text-slate-500">
                    {role.key}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {permissionKeys
                    .filter((key) => role.permissions?.[key])
                    .map((key) => (
                      <span
                        key={key}
                        className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600"
                      >
                        {permissionLabels[key] || key}
                      </span>
                    ))}
                </div>
                <span className="text-sm font-black text-slate-500">
                  {role.isSystem ? "Hệ thống" : "Tùy chỉnh"}
                </span>
                <div className="flex justify-start gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => onOpenRoleModal(role)}
                    disabled={!canManageRoles}
                    className="inline-flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Sửa vai trò"
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteRole(role)}
                    disabled={!canManageRoles || role.isSystem}
                    className="inline-flex size-10 items-center justify-center rounded-xl bg-red-50 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Xóa vai trò"
                  >
                    <Icon name="delete" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default OrganizationRolesSection;
