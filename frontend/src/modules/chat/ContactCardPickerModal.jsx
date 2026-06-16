import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getOrganizationMembers } from "../../api/organizationApi";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";

const toComparableId = (value) => String(value?._id || value?.id || value || "");

const getMemberUser = (member) => member?.user || member?.userId || null;

const getMemberName = (member) =>
  getMemberUser(member)?.fullName || "Người dùng";

const getMemberInitial = (member) => getMemberName(member).charAt(0).toUpperCase();

const getMemberSubtitle = (member) => {
  const user = getMemberUser(member);
  return (
    user?.position ||
    member?.roleLabel ||
    member?.role ||
    user?.email ||
    "Thành viên"
  );
};

const ContactCardPickerModal = ({
  open,
  organizationId,
  currentUserId,
  onClose,
  onSendContact,
  disabled = false,
}) => {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !organizationId) return undefined;

    let ignore = false;
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setError("");

      try {
        const payload = await getOrganizationMembers(organizationId, {
          status: "active",
          search: query.trim(),
        });
        if (ignore) return;
        setMembers(Array.isArray(payload?.content) ? payload.content : []);
      } catch (err) {
        if (ignore) return;
        console.error("Failed to load contact card members:", err);
        setMembers([]);
        setError("Không thể tải danh sách thành viên.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }, 220);

    return () => {
      ignore = true;
      window.clearTimeout(timeoutId);
    };
  }, [organizationId, open, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setMembers([]);
      setSelectedMember(null);
      setError("");
      setIsSubmitting(false);
    }
  }, [open]);

  const selectableMembers = useMemo(
    () =>
      members.filter((member) => {
        const user = getMemberUser(member);
        const userId = toComparableId(user);
        return (
          userId &&
          userId !== toComparableId(currentUserId) &&
          member?.status !== "removed"
        );
      }),
    [currentUserId, members],
  );

  useEffect(() => {
    if (!selectedMember) return;

    const selectedId = toComparableId(getMemberUser(selectedMember));
    const stillVisible = selectableMembers.some(
      (member) => toComparableId(getMemberUser(member)) === selectedId,
    );
    if (!stillVisible) setSelectedMember(null);
  }, [selectableMembers, selectedMember]);

  if (!open || typeof document === "undefined") return null;

  const selectedUser = getMemberUser(selectedMember);
  const canSubmit =
    Boolean(selectedUser) && Boolean(onSendContact) && !disabled && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError("");

    try {
      const selectedUserPayload =
        selectedUser && typeof selectedUser === "object"
          ? selectedUser
          : { id: selectedUser };
      await onSendContact?.({
        ...selectedUserPayload,
        role: selectedMember?.role,
        roleLabel: selectedMember?.roleLabel,
        memberId: selectedMember?.id,
      });
      onClose?.();
    } catch (err) {
      console.error("Failed to send contact card:", err);
      setError("Không thể gửi danh thiếp. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Đóng gửi danh thiếp"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-600">
              Danh thiếp
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-950">
              Gửi hồ sơ thành viên
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        <div className="border-b border-slate-200 px-5 py-4">
          <label className="relative block">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
              search
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="Tìm theo tên, email hoặc chức vụ"
              autoFocus
            />
          </label>
        </div>

        <div className="min-h-72 flex-1 overflow-y-auto px-3 py-3">
          {error ? (
            <p className="mx-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              {error}
            </p>
          ) : null}

          {isLoading ? (
            <div className="grid gap-2 p-2">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : selectableMembers.length ? (
            <div className="grid gap-2">
              {selectableMembers.map((member) => {
                const user = getMemberUser(member);
                const userId = toComparableId(user);
                const avatarUrl = getAvatarUrl(user?.avatar);
                const isSelected =
                  toComparableId(getMemberUser(selectedMember)) === userId;

                return (
                  <button
                    key={member.id || userId}
                    type="button"
                    onClick={() => setSelectedMember(member)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected
                        ? "bg-blue-50 ring-2 ring-blue-300"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={getMemberName(member)}
                        referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
                        className="size-11 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="flex size-11 items-center justify-center rounded-xl bg-slate-200 text-sm font-black text-slate-700">
                        {getMemberInitial(member)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-slate-950">
                        {getMemberName(member)}
                      </span>
                      <span className="block truncate text-xs font-semibold text-slate-500">
                        {getMemberSubtitle(member)}
                      </span>
                    </span>
                    {isSelected ? (
                      <span className="material-symbols-outlined text-[22px] text-blue-600">
                        check_circle
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-64 place-items-center px-6 text-center">
              <div>
                <span className="material-symbols-outlined mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-[26px] text-slate-400">
                  person_search
                </span>
                <p className="text-sm font-bold text-slate-700">
                  Không có thành viên phù hợp để gửi danh thiếp.
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-100"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <span className="material-symbols-outlined text-[19px]">
              {isSubmitting ? "sync" : "contact_page"}
            </span>
            {isSubmitting ? "Đang gửi..." : "Gửi danh thiếp"}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};

export default ContactCardPickerModal;
