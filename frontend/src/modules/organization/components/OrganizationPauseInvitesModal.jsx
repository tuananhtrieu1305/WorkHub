import Icon from "./Icon";

const OrganizationPauseInvitesModal = ({
  onChangeScope,
  onClose,
  onSubmit,
  open,
  scope,
}) => {
  if (!open) return null;

  return (
    <div className="organization-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="organization-modal-card w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-slate-200"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-950">
              Tạm dừng lời mời
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Các liên kết đang hoạt động sẽ không thể dùng để tham gia.
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

        <div className="mt-6 grid gap-3">
          {[
            ["all", "Tất cả lời mời", "Tạm dừng mọi liên kết đang active trong tổ chức."],
            ["mine", "Lời mời của tôi", "Chỉ tạm dừng các liên kết do bạn tạo."],
          ].map(([value, title, description]) => (
            <label
              key={value}
              className={`flex items-start gap-3 rounded-2xl p-4 ring-1 transition ${
                scope === value
                  ? "bg-blue-50 ring-blue-200"
                  : "bg-slate-50 ring-slate-200"
              }`}
            >
              <input
                type="radio"
                name="pauseScope"
                value={value}
                checked={scope === value}
                onChange={(event) => onChangeScope(event.target.value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-black text-slate-950">
                  {title}
                </span>
                <span className="mt-1 block text-sm font-semibold text-slate-500">
                  {description}
                </span>
              </span>
            </label>
          ))}
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
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-700"
          >
            <Icon name="pause" />
            Tạm dừng
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrganizationPauseInvitesModal;
