import Icon from "./Icon";

const OrganizationInviteModal = ({
  form,
  onChange,
  onClose,
  onSubmit,
  open,
}) => {
  if (!open) return null;

  return (
    <div className="organization-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="organization-modal-card w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-slate-200"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-950">
              Tạo liên kết mời
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Mỗi người tạo sẽ có mã mời riêng ở cuối đường dẫn.
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

        <div className="mt-6 grid gap-4">
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">
              Thời hạn
            </span>
            <select
              value={form.expiresIn}
              onChange={(event) => onChange({ ...form, expiresIn: event.target.value })}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
            >
              <option value="1">1 ngày</option>
              <option value="7">7 ngày</option>
              <option value="30">30 ngày</option>
              <option value="0">Không hết hạn</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">
              Số lần sử dụng
            </span>
            <input
              type="number"
              min="1"
              value={form.maxUses}
              onChange={(event) => onChange({ ...form, maxUses: event.target.value })}
              placeholder="Không giới hạn"
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">
              Ghi chú nội bộ
            </span>
            <input
              value={form.note}
              onChange={(event) => onChange({ ...form, note: event.target.value })}
              placeholder="VD: mời nhóm thiết kế"
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>
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
            <Icon name="add_link" />
            Tạo liên kết
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrganizationInviteModal;
