import { useEffect } from "react";
import Icon from "./Icon";

const OrganizationActionModal = ({
  action,
  createForm,
  inviteLink,
  isCreating,
  isJoining,
  onClose,
  onCreate,
  onJoin,
  setCreateForm,
  setInviteLink,
}) => {
  useEffect(() => {
    if (!action) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [action, onClose]);

  if (!action) return null;

  const isCreate = action === "create";

  return (
    <div className="organization-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <section className="organization-modal-card relative z-10 w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-900/18 ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 ring-1 ring-blue-100">
              <Icon name={isCreate ? "add_business" : "group_add"} />
              {isCreate ? "Tạo tổ chức" : "Tham gia tổ chức"}
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-950 sm:text-3xl">
              {isCreate ? "Thiết lập tổ chức mới" : "Gửi yêu cầu tham gia"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95"
            aria-label="Đóng"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="px-6 py-6 sm:px-7">
          {isCreate ? (
            <form className="grid gap-5" onSubmit={onCreate}>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Tên tổ chức
                </span>
                <input
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="VD: WorkHub Core Team"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Mô tả
                </span>
                <textarea
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="Nhóm, lớp học, cộng đồng hoặc dự án"
                />
              </label>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={!createForm.name.trim() || isCreating}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon name={isCreating ? "progress_activity" : "add"} />
                  Tạo tổ chức
                </button>
              </div>
            </form>
          ) : (
            <div className="grid gap-5">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Link mời hoặc mã invite
                </span>
                <input
                  value={inviteLink}
                  onChange={(event) => setInviteLink(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  placeholder="Dán link mời hoặc mã invite"
                  autoFocus
                />
              </label>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => onJoin()}
                  disabled={!inviteLink.trim() || isJoining}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon name={isJoining ? "progress_activity" : "send"} />
                  Gửi yêu cầu
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default OrganizationActionModal;
