import { hasPermission } from "../organizationUtils";
import Icon from "./Icon";
import OrganizationAccentPicker from "./OrganizationAccentPicker";
import ToggleSwitch from "./ToggleSwitch";

const OrganizationAdvancedSection = ({
  form,
  isLeaving,
  isSaving,
  onChange,
  onLeave,
  onSubmit,
  organization,
  roles,
}) => {
  const canManageSettings = hasPermission(organization, "manageSettings");
  const canManageAppearance = hasPermission(organization, "manageOrganization");
  const canLeave = organization?.role !== "owner";

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_0.55fr]">
      <div className="grid gap-5">
        <OrganizationAccentPicker
          disabled={!canManageAppearance}
          onChange={(accentColor) => onChange({ ...(form || {}), accentColor })}
          value={form?.accentColor || organization?.accentColor}
        />

        <form
          onSubmit={onSubmit}
          className="rounded-3xl bg-white p-5 ring-1 ring-slate-200"
        >
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
              <Icon name="tune" />
              Cài đặt nâng cao
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Điều khiển chính sách tham gia, lời mời và dữ liệu thành viên.
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            <ToggleSwitch
              checked={Boolean(form?.requireApproval)}
              disabled={!canManageSettings}
              label="Yêu cầu duyệt khi tham gia"
              onChange={(checked) => onChange({ ...form, requireApproval: checked })}
            />
            <ToggleSwitch
              checked={Boolean(form?.allowMemberInvites)}
              disabled={!canManageSettings}
              label="Cho phép thành viên tạo liên kết mời"
              onChange={(checked) =>
                onChange({ ...form, allowMemberInvites: checked })
              }
            />
            <ToggleSwitch
              checked={Boolean(form?.memberDirectoryVisible)}
              disabled={!canManageSettings}
              label="Hiển thị danh bạ thành viên"
              onChange={(checked) =>
                onChange({ ...form, memberDirectoryVisible: checked })
              }
            />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase text-slate-500">
                Vai trò mặc định
              </span>
              <select
                value={form?.defaultRoleKey || "member"}
                disabled={!canManageSettings}
                onChange={(event) =>
                  onChange({ ...form, defaultRoleKey: event.target.value })
                }
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {roles
                  .filter((role) => role.key !== "owner")
                  .map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-black uppercase text-slate-500">
                Lời nhắn khi tham gia
              </span>
              <textarea
                value={form?.joinMessage || ""}
                disabled={!canManageSettings}
                onChange={(event) =>
                  onChange({ ...form, joinMessage: event.target.value })
                }
                rows={4}
                className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="Thông tin nội bộ hiển thị cho thành viên mới"
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={(!canManageSettings && !canManageAppearance) || isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name={isSaving ? "progress_activity" : "save"} />
              Lưu cài đặt
            </button>
          </div>
        </form>
      </div>

      <aside className="grid gap-5">
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-950">
            <Icon name="lock" />
            Quyền hiện tại
          </h3>
          <div className="mt-4 grid gap-2">
            {Object.entries(organization?.permissions || {}).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2"
              >
                <span className="text-xs font-black text-slate-600">{key}</span>
                <span
                  className={`size-2 rounded-full ${
                    value ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-red-50 p-5 ring-1 ring-red-100">
          <h3 className="flex items-center gap-2 text-lg font-black text-red-800">
            <Icon name="logout" />
            Rời tổ chức
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-red-700">
            Chủ sở hữu không thể rời tổ chức cho đến khi chuyển quyền sở hữu.
          </p>
          <button
            type="button"
            onClick={onLeave}
            disabled={!canLeave || isLeaving}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name={isLeaving ? "progress_activity" : "exit_to_app"} />
            Rời tổ chức này
          </button>
        </div>
      </aside>
    </section>
  );
};

export default OrganizationAdvancedSection;
