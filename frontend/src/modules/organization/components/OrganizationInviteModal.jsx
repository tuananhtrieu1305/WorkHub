import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import ToggleSwitch from "./ToggleSwitch";

const expiryOptions = [
  { value: "30m", label: "30 phút", detail: "Dùng cho lời mời nhanh" },
  { value: "1h", label: "1 giờ", detail: "Phiên làm việc ngắn" },
  { value: "6h", label: "6 giờ", detail: "Trong nửa ngày" },
  { value: "12h", label: "12 giờ", detail: "Trong ngày" },
  { value: "1d", label: "1 ngày", detail: "Mặc định ngắn hạn" },
  { value: "7d", label: "7 ngày", detail: "Phù hợp mời nhóm" },
  { value: "forever", label: "Vĩnh viễn", detail: "Không tự hết hạn" },
];

const maxUseOptions = [
  { value: "", label: "Không giới hạn", detail: "Chỉ hiển thị số lượt đã dùng" },
  { value: "1", label: "1 lần dùng", detail: "Một người tham gia" },
  { value: "5", label: "5 lần dùng", detail: "Nhóm nhỏ" },
  { value: "10", label: "10 lần dùng", detail: "Nhóm vừa" },
  { value: "25", label: "25 lần dùng", detail: "Đội mở rộng" },
  { value: "50", label: "50 lần dùng", detail: "Phòng ban" },
  { value: "100", label: "100 lần dùng", detail: "Chiến dịch lớn" },
];

const findOption = (options, value) =>
  options.find((option) => option.value === value) || options[0];

const InviteDropdown = ({ icon, label, onChange, options, value }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const selected = findOption(options, value);

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
      <span className="text-xs font-black uppercase text-slate-500">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`mt-2 flex min-h-14 w-full items-center justify-between gap-3 rounded-[1.25rem] border px-4 py-3 text-left shadow-sm transition duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 ${
          open
            ? "border-blue-300 bg-white shadow-blue-100/80"
            : "border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-white"
        }`}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-blue-600 ring-1 ring-slate-200">
            <Icon name={icon} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-slate-950">
              {selected.label}
            </span>
          </span>
        </span>
        <Icon
          name="expand_more"
          className={`shrink-0 text-slate-400 transition duration-200 ${
            open ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </button>

      <div
        className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 origin-top overflow-hidden rounded-[1.25rem] bg-white shadow-2xl ring-1 ring-slate-200 transition duration-200 ${
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
        <div className="max-h-72 overflow-y-auto p-1.5">
          {options.map((option) => {
            const selectedOption = option.value === selected.value;
            return (
              <button
                key={option.value || "unlimited"}
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
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">
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

const OrganizationInviteModal = ({
  form,
  onChange,
  onClose,
  onSubmit,
  open,
  organization,
}) => {
  const shouldShowApprovalBypass =
    organization?.settings?.requireApproval !== false;

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
              Mã mời ngắn, dễ đọc và được theo dõi lượt dùng riêng.
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
          <InviteDropdown
            icon="timer"
            label="Thời hạn"
            onChange={(value) => onChange({ ...form, expiresIn: value })}
            options={expiryOptions}
            value={form.expiresIn}
          />

          <InviteDropdown
            icon="call_missed_outgoing"
            label="Số lần sử dụng"
            onChange={(value) => onChange({ ...form, maxUses: value })}
            options={maxUseOptions}
            value={form.maxUses}
          />

          {shouldShowApprovalBypass && (
            <div className="rounded-[1.25rem] bg-blue-50/70 p-4 ring-1 ring-blue-100">
              <ToggleSwitch
                checked={Boolean(form.bypassApproval)}
                label="Bỏ qua phê duyệt tham gia"
                onChange={(checked) =>
                  onChange({ ...form, bypassApproval: checked })
                }
              />
              <p className="mt-2 text-sm font-semibold leading-6 text-blue-700/80">
                Người dùng nhập mã này sẽ tham gia tổ chức ngay, không vào danh
                sách chờ duyệt.
              </p>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">
              Ghi chú nội bộ
            </span>
            <input
              value={form.note}
              onChange={(event) => onChange({ ...form, note: event.target.value })}
              placeholder="VD: mời nhóm thiết kế"
              className="mt-2 h-12 w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-200/60 transition hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 active:scale-[0.98]"
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
