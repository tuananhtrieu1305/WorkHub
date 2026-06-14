import { permissionLabels } from "../organizationUtils";
import Icon from "./Icon";
import ToggleSwitch from "./ToggleSwitch";

const OrganizationRoleModal = ({
  form,
  mode,
  onChange,
  onClose,
  onSubmit,
  permissionKeys,
}) => {
  if (!mode) return null;

  const isEdit = mode === "edit";

  return (
    <div className="organization-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="organization-modal-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-slate-200"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-950">
              {isEdit ? "Cập nhật vai trò" : "Tạo vai trò"}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Gán màu và bật tắt quyền cho vai trò này.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="Đóng"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">
              Tên vai trò
            </span>
            <input
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">
              Key
            </span>
            <input
              value={form.key}
              disabled={isEdit}
              onChange={(event) => onChange({ ...form, key: event.target.value })}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
              placeholder="moderator"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-black uppercase text-slate-500">
              Mô tả
            </span>
            <textarea
              value={form.description}
              onChange={(event) =>
                onChange({ ...form, description: event.target.value })
              }
              rows={3}
              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">
              Màu
            </span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={(event) => onChange({ ...form, color: event.target.value })}
                className="size-12 rounded-2xl border border-slate-200 bg-white p-1"
              />
              <input
                value={form.color}
                onChange={(event) => onChange({ ...form, color: event.target.value })}
                className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </label>
        </div>

        <div className="mt-6 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <h4 className="mb-3 text-sm font-black text-slate-900">Phân quyền</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {permissionKeys.map((key) => (
              <ToggleSwitch
                key={key}
                checked={Boolean(form.permissions?.[key])}
                label={permissionLabels[key] || key}
                onChange={(checked) =>
                  onChange({
                    ...form,
                    permissions: {
                      ...(form.permissions || {}),
                      [key]: checked,
                    },
                  })
                }
              />
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700"
          >
            <Icon name="save" />
            Lưu vai trò
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrganizationRoleModal;
