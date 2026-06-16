import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getOrganizationRoleMembers,
  updateOrganizationRoleMembers,
} from "../../../api/organizationApi";
import { useWorkHubToast } from "../../../components/feedback/workHubToast";
import {
  permissionDescriptions,
  permissionLabels,
  permissionSections,
} from "../organizationUtils";
import Icon from "./Icon";
import MemberAvatar from "./MemberAvatar";
import ToggleSwitch from "./ToggleSwitch";

const roleModalTabs = [
  { id: "display", label: "Hiển thị", icon: "palette" },
  { id: "permissions", label: "Quyền hạn", icon: "rule_settings" },
  { id: "members", label: "Quản lý thành viên", icon: "group_add" },
];

const getMemberName = (member) =>
  member?.user?.fullName || member?.user?.name || "Thành viên";

const getMemberSubtitle = (member) =>
  [member?.user?.email, member?.user?.position].filter(Boolean).join(" · ");

const memberMatchesSearch = (member, search) => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;

  return [
    member?.user?.fullName,
    member?.user?.email,
    member?.user?.position,
    member?.roleLabel,
  ].some((value) => String(value || "").toLowerCase().includes(needle));
};

const RoleModalTabs = ({ activeTab, onChange }) => {
  const activeIndex = Math.max(
    0,
    roleModalTabs.findIndex((tab) => tab.id === activeTab),
  );

  return (
    <nav
      className="organization-workspace-tabs rounded-[1.25rem] bg-slate-50 p-1.5 ring-1 ring-slate-200/80"
      style={{
        "--organization-tab-count": roleModalTabs.length,
        "--organization-tab-index": activeIndex,
      }}
      aria-label="Cấu hình vai trò"
    >
      <div className="organization-workspace-tabs-track relative grid min-w-max gap-1 overflow-hidden rounded-2xl bg-white p-1 sm:min-w-0">
        <span className="organization-workspace-tab-indicator" aria-hidden="true" />
        {roleModalTabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={active ? "page" : undefined}
              className={`organization-workspace-tab relative z-10 inline-flex min-w-[12rem] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition focus:outline-none active:scale-[0.98] sm:min-w-0 ${
                active
                  ? "text-blue-700"
                  : "text-slate-500 hover:bg-blue-50/70 hover:text-blue-700"
              }`}
            >
              <Icon name={tab.icon} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

const MemberLine = ({ action, disabled = false, member }) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
    <div className="flex min-w-0 items-center gap-3">
      <MemberAvatar member={member} />
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-950">
          {getMemberName(member)}
        </p>
        <p className="truncate text-xs font-semibold text-slate-500">
          {getMemberSubtitle(member) || member.roleLabel || "Thành viên"}
        </p>
      </div>
    </div>
    <div className={disabled ? "pointer-events-none opacity-45" : ""}>{action}</div>
  </div>
);

const OrganizationRoleModal = ({
  form,
  mode,
  onChange,
  onClose,
  onMembersChanged,
  onSubmit,
  organizationId,
  permissionKeys = [],
}) => {
  const message = useWorkHubToast();
  const [activeTab, setActiveTab] = useState("display");
  const [memberSearch, setMemberSearch] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [memberPayload, setMemberPayload] = useState({
    members: [],
    candidates: [],
  });
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSavingMembers, setIsSavingMembers] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  const open = Boolean(mode);
  const isEdit = mode === "edit" && Boolean(form?.id);
  const canManageRole = form?.canManage !== false;
  const isManagerRole = Boolean(form?.permissions?.manageOrganization);

  const filteredPermissionSections = useMemo(
    () =>
      permissionSections
        .map((section) => ({
          ...section,
          keys: section.keys.filter((key) => permissionKeys.includes(key)),
        }))
        .filter((section) => section.keys.length),
    [permissionKeys],
  );

  const roleMembers = useMemo(
    () =>
      (memberPayload.members || []).filter((member) =>
        memberMatchesSearch(member, memberSearch),
      ),
    [memberPayload.members, memberSearch],
  );

  const candidates = useMemo(
    () =>
      (memberPayload.candidates || []).filter((member) =>
        memberMatchesSearch(member, candidateSearch),
      ),
    [candidateSearch, memberPayload.candidates],
  );

  const loadRoleMembers = useCallback(async () => {
    if (!organizationId || !form?.id || !canManageRole) return;

    setIsLoadingMembers(true);
    try {
      const payload = await getOrganizationRoleMembers(organizationId, form.id);
      setMemberPayload({
        members: payload.members || [],
        candidates: payload.candidates || [],
      });
    } catch (error) {
      console.error("Failed to load role members:", error);
      message.error("Không thể tải thành viên của vai trò", {
        description:
          "Danh sách thành viên trong vai trò này chưa được tải. Hãy kiểm tra quyền quản trị role.",
      });
      setMemberPayload({ members: [], candidates: [] });
    } finally {
      setIsLoadingMembers(false);
    }
  }, [canManageRole, form?.id, message, organizationId]);

  useEffect(() => {
    if (!open) return;
    setActiveTab("display");
    setMemberSearch("");
    setCandidateSearch("");
    setSelectedMemberIds([]);
    setAddModalOpen(false);
    setMemberPayload({ members: [], candidates: [] });
  }, [form?.id, open]);

  useEffect(() => {
    if (open && activeTab === "members" && isEdit) {
      loadRoleMembers();
    }
  }, [activeTab, isEdit, loadRoleMembers, open]);

  if (!open) return null;

  const updatePermission = (key, checked) => {
    const nextPermissions = {
      ...(form.permissions || {}),
      [key]: checked,
    };

    if (key === "manageOrganization" && checked) {
      permissionKeys.forEach((permissionKey) => {
        nextPermissions[permissionKey] = true;
      });
    }

    onChange({
      ...form,
      permissions: nextPermissions,
    });
  };

  const toggleCandidate = (memberId) => {
    setSelectedMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((item) => item !== memberId)
        : [...current, memberId],
    );
  };

  const removeMember = async (member) => {
    if (!organizationId || !form?.id || !member?.id || isSavingMembers) return;

    setIsSavingMembers(true);
    try {
      const payload = await updateOrganizationRoleMembers(organizationId, form.id, {
        removeMemberIds: [member.id],
      });
      setMemberPayload({
        members: payload.members || [],
        candidates: payload.candidates || [],
      });
      onMembersChanged?.();
      message.success("Đã gỡ thành viên khỏi vai trò", {
        description: `${getMemberName(member)} đã được chuyển về vai trò mặc định.`,
      });
    } catch (error) {
      console.error("Failed to remove role member:", error);
      message.error("Không thể gỡ thành viên khỏi vai trò", {
        description:
          "Thành viên chưa được cập nhật. Hãy kiểm tra quyền quản trị role và thử lại.",
      });
    } finally {
      setIsSavingMembers(false);
    }
  };

  const addSelectedMembers = async () => {
    if (
      !organizationId ||
      !form?.id ||
      !selectedMemberIds.length ||
      isSavingMembers
    ) {
      return;
    }

    setIsSavingMembers(true);
    try {
      const payload = await updateOrganizationRoleMembers(organizationId, form.id, {
        addMemberIds: selectedMemberIds,
      });
      setMemberPayload({
        members: payload.members || [],
        candidates: payload.candidates || [],
      });
      setSelectedMemberIds([]);
      setCandidateSearch("");
      setAddModalOpen(false);
      onMembersChanged?.();
      message.success("Đã thêm thành viên vào vai trò", {
        description: `${selectedMemberIds.length} thành viên đã được gán vai trò ${form.name}.`,
      });
    } catch (error) {
      console.error("Failed to add role members:", error);
      message.error("Không thể thêm thành viên vào vai trò", {
        description:
          "Danh sách chọn chưa được lưu. Hãy kiểm tra quyền quản trị role và thử lại.",
      });
    } finally {
      setIsSavingMembers(false);
    }
  };

  return (
    <div className="organization-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="organization-modal-card relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-200"
      >
        <div className="border-b border-slate-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-950">
                {isEdit ? "Cập nhật vai trò" : "Tạo vai trò"}
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Thiết lập hiển thị, quyền hạn và thành viên đang mang vai trò.
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

          <div className="mt-5">
            <RoleModalTabs activeTab={activeTab} onChange={setActiveTab} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "display" && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="grid gap-4">
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Tên vai trò
                  </span>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      onChange({ ...form, name: event.target.value })
                    }
                    disabled={!canManageRole}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Mô tả
                  </span>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      onChange({ ...form, description: event.target.value })
                    }
                    disabled={!canManageRole}
                    rows={4}
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Màu vai trò
                  </span>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(event) =>
                        onChange({ ...form, color: event.target.value })
                      }
                      disabled={!canManageRole}
                      className="size-12 rounded-2xl border border-slate-200 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <input
                      value={form.color}
                      onChange={(event) =>
                        onChange({ ...form, color: event.target.value })
                      }
                      disabled={!canManageRole}
                      className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </label>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-xs font-black uppercase text-slate-500">
                  Xem trước badge
                </p>
                <div className="mt-5 grid place-items-center rounded-[1.5rem] bg-white p-8 ring-1 ring-slate-200">
                  <span
                    className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black ring-1"
                    style={{
                      backgroundColor: `${form.color || "#2563eb"}18`,
                      borderColor: `${form.color || "#2563eb"}2e`,
                      color: form.color || "#2563eb",
                    }}
                  >
                    <Icon name="server_person" />
                    {form.name || "Tên vai trò"}
                  </span>
                </div>
                <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
                  Màu này sẽ được dùng cho badge vai trò trong danh sách thành
                  viên, tổng quan và các khu vực hiển thị vai trò khác.
                </p>
              </div>
            </div>
          )}

          {activeTab === "permissions" && (
            <div className="grid gap-4">
              {filteredPermissionSections.map((section) => (
                <section
                  key={section.id}
                  className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-blue-700 ring-1 ring-blue-100">
                      <Icon name={section.icon} />
                    </span>
                    <div>
                      <h4 className="text-sm font-black text-slate-950">
                        {section.title}
                      </h4>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                        {section.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {section.keys.map((key) => {
                      const checked =
                        key === "manageOrganization"
                          ? Boolean(form.permissions?.[key])
                          : isManagerRole || Boolean(form.permissions?.[key]);
                      const disabled =
                        !canManageRole ||
                        (isManagerRole && key !== "manageOrganization");

                      return (
                        <ToggleSwitch
                          key={key}
                          checked={checked}
                          disabled={disabled}
                          label={permissionLabels[key] || key}
                          description={permissionDescriptions[key]}
                          className="min-h-20 w-full justify-start px-4 py-3 ring-1 ring-slate-200"
                          onChange={(nextChecked) =>
                            updatePermission(key, nextChecked)
                          }
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {activeTab === "members" && (
            <div className="grid gap-4">
              {!isEdit ? (
                <div className="grid place-items-center gap-3 rounded-3xl bg-slate-50 px-4 py-14 text-center ring-1 ring-slate-200">
                  <Icon
                    name="save"
                    className="text-4xl leading-none text-slate-300"
                  />
                  <div>
                    <p className="text-sm font-black text-slate-700">
                      Tạo vai trò trước khi quản lý thành viên.
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Sau khi lưu, tab này sẽ hiển thị người đang mang role và
                      danh sách thành viên có thể thêm vào.
                    </p>
                  </div>
                </div>
              ) : !canManageRole ? (
                <div className="grid place-items-center gap-3 rounded-3xl bg-amber-50 px-4 py-14 text-center ring-1 ring-amber-100">
                  <Icon
                    name="lock"
                    className="text-4xl leading-none text-amber-500"
                  />
                  <p className="text-sm font-black text-amber-800">
                    Bạn chỉ có thể quản lý thành viên của role nằm bên dưới role
                    cao nhất của mình.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="relative block sm:max-w-sm sm:flex-1">
                      <Icon
                        name="search"
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg leading-none text-slate-400"
                      />
                      <input
                        value={memberSearch}
                        onChange={(event) => setMemberSearch(event.target.value)}
                        placeholder="Tìm kiếm thành viên"
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMemberIds([]);
                        setCandidateSearch("");
                        setAddModalOpen(true);
                        loadRoleMembers();
                      }}
                      disabled={isSavingMembers}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-lg shadow-blue-200/60 transition hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon name="person_add" />
                      Thêm thành viên
                    </button>
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    {isLoadingMembers ? (
                      <div className="grid gap-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-16 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200"
                          />
                        ))}
                      </div>
                    ) : roleMembers.length ? (
                      <div className="grid gap-3">
                        {roleMembers.map((member) => (
                          <MemberLine
                            key={member.id}
                            disabled={form.isDefault || !member.canManage}
                            member={member}
                            action={
                              <button
                                type="button"
                                onClick={() => removeMember(member)}
                                disabled={
                                  form.isDefault ||
                                  !member.canManage ||
                                  isSavingMembers
                                }
                                className="grid size-10 place-items-center rounded-2xl bg-rose-50 text-rose-700 transition hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                                title={
                                  form.isDefault
                                    ? "Không thể gỡ vai trò mặc định"
                                    : "Gỡ khỏi vai trò"
                                }
                                aria-label="Gỡ khỏi vai trò"
                              >
                                <Icon name="close" />
                              </button>
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid place-items-center gap-2 px-4 py-12 text-center">
                        <Icon
                          name="person_search"
                          className="text-4xl leading-none text-slate-300"
                        />
                        <p className="text-sm font-black text-slate-600">
                          Chưa có thành viên phù hợp trong vai trò này.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!canManageRole}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="save" />
            {isEdit ? "Lưu vai trò" : "Tạo vai trò"}
          </button>
        </div>
      </form>

      {addModalOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <section className="organization-modal-card flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <h4 className="text-lg font-black text-slate-950">
                  Thêm thành viên
                </h4>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Chọn nhiều người chưa mang vai trò {form.name || "này"}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label="Đóng"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="grid gap-4 overflow-y-auto p-5">
              <label className="relative block">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg leading-none text-slate-400"
                />
                <input
                  value={candidateSearch}
                  onChange={(event) => setCandidateSearch(event.target.value)}
                  placeholder="Tìm kiếm thành viên"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <div className="grid gap-3">
                {candidates.length ? (
                  candidates.map((member) => {
                    const checked = selectedMemberIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleCandidate(member.id)}
                        className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left ring-1 transition active:scale-[0.99] ${
                          checked
                            ? "bg-blue-50 ring-blue-200"
                            : "bg-white ring-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <MemberAvatar member={member} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950">
                              {getMemberName(member)}
                            </p>
                            <p className="truncate text-xs font-semibold text-slate-500">
                              {getMemberSubtitle(member) ||
                                member.roleLabel ||
                                "Thành viên"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`grid size-6 shrink-0 place-items-center rounded-lg border text-white transition ${
                            checked
                              ? "border-blue-600 bg-blue-600"
                              : "border-slate-300 bg-white"
                          }`}
                          aria-hidden="true"
                        >
                          {checked && <Icon name="check" className="text-base" />}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="grid place-items-center gap-2 rounded-2xl bg-slate-50 px-4 py-10 text-center ring-1 ring-slate-200">
                    <Icon
                      name="person_search"
                      className="text-4xl leading-none text-slate-300"
                    />
                    <p className="text-sm font-black text-slate-600">
                      Không còn thành viên phù hợp để thêm.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 p-5">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={addSelectedMembers}
                disabled={!selectedMemberIds.length || isSavingMembers}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="group_add" />
                Thêm {selectedMemberIds.length || ""} thành viên
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default OrganizationRoleModal;
