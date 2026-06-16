import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import MemberAvatar from "./MemberAvatar";

const OrganizationTransferOwnerModal = ({
  isSubmitting = false,
  members = [],
  onClose,
  onSubmit,
  open,
  organization,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState("");

  const eligibleMembers = useMemo(
    () =>
      members.filter(
        (member) => member.status === "active" && !member.isOwner,
      ),
    [members],
  );
  const selectedMember = eligibleMembers.find(
    (member) => member.id === selectedMemberId,
  );

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setSelectedMemberId("");
    onClose?.();
  }, [isSubmitting, onClose]);

  const handleSubmit = () => {
    if (!selectedMember || isSubmitting) return;
    setSelectedMemberId("");
    onSubmit?.(selectedMember);
  };

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, open]);

  if (!open) return null;

  return (
    <div className="organization-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={handleClose}
        aria-hidden="true"
      />
      <section className="organization-modal-card relative z-10 max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-900/18 ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 ring-1 ring-amber-100">
              <Icon name="workspace_premium" />
              Quyền sở hữu
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-950 sm:text-3xl">
              Chuyển quyền sở hữu
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Chọn thành viên sẽ trở thành chủ sở hữu mới của{" "}
              <span className="font-black text-slate-900">
                {organization?.name || "tổ chức này"}
              </span>
              . Sau khi chuyển, bạn sẽ được hạ xuống vai trò quản trị hoặc thành viên.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Đóng"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-13rem)] overflow-y-auto px-6 py-6 sm:px-7">
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800 ring-1 ring-amber-100">
            Chỉ chủ sở hữu hiện tại có thể thực hiện thao tác này. Hãy kiểm tra đúng
            người nhận quyền trước khi xác nhận.
          </div>

          <div className="mt-5 grid gap-3">
            {eligibleMembers.length ? (
              eligibleMembers.map((member) => {
                const selected = member.id === selectedMemberId;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedMemberId(member.id)}
                    className={`flex items-center gap-3 rounded-3xl p-4 text-left ring-1 transition hover:-translate-y-0.5 ${
                      selected
                        ? "bg-blue-50 ring-blue-200"
                        : "bg-slate-50 ring-slate-200 hover:bg-white"
                    }`}
                  >
                    <MemberAvatar member={member} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">
                        {member.user?.fullName || member.user?.email || "Thành viên"}
                      </p>
                      <p className="truncate text-xs font-semibold text-slate-500">
                        {member.user?.email || "Chưa có email"}
                      </p>
                    </div>
                    <span className="rounded-2xl bg-white px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                      {member.roleLabel || "Thành viên"}
                    </span>
                    <span
                      className={`grid size-9 place-items-center rounded-2xl ${
                        selected
                          ? "bg-blue-600 text-white"
                          : "bg-white text-slate-300 ring-1 ring-slate-200"
                      }`}
                    >
                      <Icon name={selected ? "check" : "radio_button_unchecked"} />
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="grid place-items-center gap-2 rounded-3xl border border-dashed border-slate-300 px-4 py-10 text-center">
                <Icon name="group_off" className="text-4xl text-slate-300" />
                <p className="text-sm font-black text-slate-600">
                  Chưa có thành viên phù hợp để chuyển quyền.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end sm:px-7">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedMember || isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-sm shadow-amber-500/20 transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name={isSubmitting ? "progress_activity" : "swap_horiz"} />
            Xác nhận chuyển quyền
          </button>
        </div>
      </section>
    </div>
  );
};

export default OrganizationTransferOwnerModal;
