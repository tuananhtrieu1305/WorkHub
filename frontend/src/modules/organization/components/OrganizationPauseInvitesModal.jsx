import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

const durationOptions = [
  { value: "1", label: "1 giờ" },
  { value: "2", label: "2 giờ" },
  { value: "4", label: "4 giờ" },
  { value: "6", label: "6 giờ" },
  { value: "12", label: "12 giờ" },
  { value: "24", label: "24 giờ" },
];

const DurationDropdown = ({ onChange, value }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const selected =
    durationOptions.find((option) => option.value === String(value)) ||
    durationOptions[0];

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <span className="text-xs font-black uppercase text-slate-500">
        Thời gian tạm dừng
      </span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`mt-2 flex h-12 w-full items-center justify-between rounded-[1.25rem] border px-4 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-amber-100 ${
          open
            ? "border-amber-300 bg-white text-amber-800"
            : "border-slate-200 bg-slate-50 text-slate-800 hover:border-amber-200 hover:bg-white"
        }`}
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <Icon name="schedule" className="text-amber-600" />
          {selected.label}
        </span>
        <Icon
          name="expand_more"
          className={`text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-[1.25rem] bg-white p-1.5 shadow-2xl ring-1 ring-slate-200 transition duration-200 ${
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
        {durationOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
            className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-black transition ${
              option.value === selected.value
                ? "bg-amber-50 text-amber-800"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option.label}
            {option.value === selected.value && (
              <Icon name="check_circle" className="text-amber-600" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

const OrganizationPauseInvitesModal = ({
  durationHours,
  onChangeDuration,
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
              Hết thời gian đã chọn, các lời mời sẽ tự hoạt động lại.
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
          <DurationDropdown
            onChange={onChangeDuration}
            value={durationHours}
          />

          <div className="grid gap-3">
            {[
              ["all", "Tất cả lời mời", "Tạm dừng mọi liên kết đang hoạt động trong tổ chức."],
              ["mine", "Lời mời của tôi", "Chỉ tạm dừng các liên kết do bạn tạo."],
            ].map(([value, title, description]) => (
              <label
                key={value}
                className={`flex items-start gap-3 rounded-2xl p-4 ring-1 transition ${
                  scope === value
                    ? "bg-amber-50 ring-amber-200"
                    : "bg-slate-50 ring-slate-200 hover:bg-white"
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
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-200/60 transition hover:-translate-y-0.5 hover:bg-amber-700 active:translate-y-0 active:scale-[0.98]"
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
