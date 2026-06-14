import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { App } from "antd";
import { getOrganizationMembers } from "../../api/organizationApi";
import { useAuth } from "../../context/AuthContext";

const normalizeInviteValue = (value) => String(value || "").trim();

const getOrganizationId = (organization) => organization?.id || organization?._id;

const OrganizationPage = () => {
  const {
    user,
    createOrganization,
    joinOrganization,
    leaveOrganization,
    switchActiveOrganization,
    refreshOrganizations,
    updateOrganization,
  } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const inviteFromUrl = params.inviteCode || searchParams.get("invite") || "";
  const hasAutoJoinedRef = useRef(false);

  const [inviteLink, setInviteLink] = useState(inviteFromUrl);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    accentColor: "#2563eb",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    accentColor: "#2563eb",
    inviteEnabled: true,
  });
  const [members, setMembers] = useState([]);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRotatingInvite, setIsRotatingInvite] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isSwitchingId, setIsSwitchingId] = useState("");
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const organizations = user?.organizations || [];
  const activeOrganization = user?.activeOrganization || null;
  const activeOrganizationId = getOrganizationId(activeOrganization);
  const inviteUrl =
    activeOrganization?.inviteEnabled === false
      ? ""
      : activeOrganization?.inviteLink || "";
  const canManageActiveOrganization = ["owner", "admin"].includes(
    activeOrganization?.role,
  );

  const activeOrganizationStats = useMemo(() => {
    const ownerCount = members.filter((member) => member.role === "owner").length;
    const adminCount = members.filter((member) => member.role === "admin").length;
    return {
      members: members.length,
      owners: ownerCount,
      admins: adminCount,
    };
  }, [members]);

  const handleJoin = useCallback(
    async (value = inviteLink) => {
      const normalizedInvite = normalizeInviteValue(value);
      if (!normalizedInvite || isJoining) return;

      setIsJoining(true);
      try {
        await joinOrganization(normalizedInvite);
        setInviteLink("");
        message.success("Đã tham gia tổ chức");
        if (params.inviteCode) navigate("/organization", { replace: true });
      } catch (error) {
        console.error("Failed to join organization:", error);
        message.error(
          error?.response?.data?.message || "Không thể tham gia bằng link này",
        );
      } finally {
        setIsJoining(false);
      }
    },
    [inviteLink, isJoining, joinOrganization, message, navigate, params.inviteCode],
  );

  const handleCreate = useCallback(
    async (event) => {
      event.preventDefault();
      if (!createForm.name.trim() || isCreating) return;

      setIsCreating(true);
      try {
        await createOrganization(createForm);
        setCreateForm({ name: "", description: "", accentColor: "#2563eb" });
        message.success("Đã tạo tổ chức mới");
      } catch (error) {
        console.error("Failed to create organization:", error);
        message.error(error?.response?.data?.message || "Không thể tạo tổ chức");
      } finally {
        setIsCreating(false);
      }
    },
    [createForm, createOrganization, isCreating, message],
  );

  const handleSwitch = useCallback(
    async (organizationId) => {
      if (!organizationId || organizationId === activeOrganizationId) return;

      setIsSwitchingId(organizationId);
      try {
        await switchActiveOrganization(organizationId);
        message.success("Đã chuyển tổ chức");
      } catch (error) {
        console.error("Failed to switch organization:", error);
        message.error(
          error?.response?.data?.message || "Không thể chuyển tổ chức",
        );
      } finally {
        setIsSwitchingId("");
      }
    },
    [activeOrganizationId, message, switchActiveOrganization],
  );

  const handleCopyInvite = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      message.success("Đã sao chép link mời");
    } catch {
      message.error("Không thể sao chép link");
    }
  }, [inviteUrl, message]);

  const handleUpdateActiveOrganization = useCallback(
    async (event) => {
      event.preventDefault();
      if (!activeOrganizationId || !canManageActiveOrganization || isUpdating) {
        return;
      }

      setIsUpdating(true);
      try {
        await updateOrganization(activeOrganizationId, editForm);
        message.success("Đã cập nhật tổ chức");
      } catch (error) {
        console.error("Failed to update organization:", error);
        message.error(error?.response?.data?.message || "Không thể cập nhật");
      } finally {
        setIsUpdating(false);
      }
    },
    [
      activeOrganizationId,
      canManageActiveOrganization,
      editForm,
      isUpdating,
      message,
      updateOrganization,
    ],
  );

  const handleToggleInvite = useCallback(async () => {
    if (!activeOrganizationId || !canManageActiveOrganization || isUpdating) {
      return;
    }

    const nextInviteEnabled = !editForm.inviteEnabled;
    setIsUpdating(true);
    try {
      await updateOrganization(activeOrganizationId, {
        ...editForm,
        inviteEnabled: nextInviteEnabled,
      });
      setEditForm((current) => ({
        ...current,
        inviteEnabled: nextInviteEnabled,
      }));
      message.success(
        nextInviteEnabled ? "Đã bật link mời" : "Đã tắt link mời",
      );
    } catch (error) {
      console.error("Failed to toggle invite:", error);
      message.error(error?.response?.data?.message || "Không thể cập nhật link");
    } finally {
      setIsUpdating(false);
    }
  }, [
    activeOrganizationId,
    canManageActiveOrganization,
    editForm,
    isUpdating,
    message,
    updateOrganization,
  ]);

  const handleRotateInvite = useCallback(async () => {
    if (!activeOrganizationId || !canManageActiveOrganization || isRotatingInvite) {
      return;
    }

    setIsRotatingInvite(true);
    try {
      await updateOrganization(activeOrganizationId, {
        ...editForm,
        rotateInviteCode: true,
      });
      message.success("Đã đổi link mời");
    } catch (error) {
      console.error("Failed to rotate invite:", error);
      message.error(error?.response?.data?.message || "Không thể đổi link mời");
    } finally {
      setIsRotatingInvite(false);
    }
  }, [
    activeOrganizationId,
    canManageActiveOrganization,
    editForm,
    isRotatingInvite,
    message,
    updateOrganization,
  ]);

  const handleLeaveOrganization = useCallback(async () => {
    if (!activeOrganizationId || activeOrganization?.role === "owner" || isLeaving) {
      return;
    }

    setIsLeaving(true);
    try {
      await leaveOrganization(activeOrganizationId);
      setMembers([]);
      message.success("Đã rời tổ chức");
    } catch (error) {
      console.error("Failed to leave organization:", error);
      message.error(error?.response?.data?.message || "Không thể rời tổ chức");
    } finally {
      setIsLeaving(false);
    }
  }, [
    activeOrganization?.role,
    activeOrganizationId,
    isLeaving,
    leaveOrganization,
    message,
  ]);

  useEffect(() => {
    refreshOrganizations?.().catch((error) => {
      console.error("Failed to refresh organizations:", error);
    });
  }, [refreshOrganizations]);

  useEffect(() => {
    if (!inviteFromUrl || hasAutoJoinedRef.current) return;
    hasAutoJoinedRef.current = true;
    setInviteLink(inviteFromUrl);
    handleJoin(inviteFromUrl);
  }, [handleJoin, inviteFromUrl]);

  useEffect(() => {
    setEditForm({
      name: activeOrganization?.name || "",
      description: activeOrganization?.description || "",
      accentColor: activeOrganization?.accentColor || "#2563eb",
      inviteEnabled: activeOrganization?.inviteEnabled !== false,
    });
  }, [activeOrganization]);

  useEffect(() => {
    if (!activeOrganizationId) {
      setMembers([]);
      return undefined;
    }

    let ignore = false;
    setIsLoadingMembers(true);
    getOrganizationMembers(activeOrganizationId)
      .then((payload) => {
        if (!ignore) setMembers(payload.content || []);
      })
      .catch((error) => {
        console.error("Failed to load organization members:", error);
        if (!ignore) setMembers([]);
      })
      .finally(() => {
        if (!ignore) setIsLoadingMembers(false);
      });

    return () => {
      ignore = true;
    };
  }, [activeOrganizationId]);

  return (
    <div className="min-h-full bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_48%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 sm:p-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-blue-700">
                <span className="material-symbols-outlined text-base leading-none">
                  hub
                </span>
                Organization workspace
              </span>
              <h1 className="mt-5 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
                Quản lý tổ chức làm việc
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-slate-600">
                Tạo tổ chức riêng, tham gia bằng link mời và chuyển nhanh giữa
                các không gian. Mỗi tổ chức có bảng tin, tin nhắn, tài liệu,
                công việc và cuộc họp tách biệt.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ["groups", `${organizations.length}`, "Tổ chức của bạn"],
                  ["badge", `${activeOrganizationStats.members}`, "Thành viên hiện tại"],
                  ["shield_person", `${activeOrganizationStats.admins + activeOrganizationStats.owners}`, "Quản trị"],
                ].map(([icon, value, label]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <span className="material-symbols-outlined text-xl leading-none text-blue-600">
                      {icon}
                    </span>
                    <p className="mt-2 text-2xl font-black text-slate-950">
                      {value}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0 sm:p-8">
              <p className="text-xs font-extrabold uppercase tracking-wide text-blue-200">
                Đang hoạt động
              </p>
              {activeOrganization ? (
                <div className="mt-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex size-12 items-center justify-center rounded-2xl text-lg font-black text-white shadow-lg"
                      style={{ background: activeOrganization.accentColor }}
                    >
                      {activeOrganization.name?.charAt(0)?.toUpperCase() || "O"}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-black">
                        {activeOrganization.name}
                      </h2>
                      <p className="text-sm font-medium text-slate-300">
                        Vai trò: {activeOrganization.role || "member"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    {activeOrganization.description ||
                      "Tổ chức này chưa có mô tả."}
                  </p>
                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-blue-50"
                    >
                      <span className="material-symbols-outlined text-xl leading-none">
                        link
                      </span>
                      Sao chép link mời
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <span className="material-symbols-outlined text-4xl text-blue-200">
                    domain_add
                  </span>
                  <p className="mt-4 text-lg font-black">
                    Bạn chưa tham gia tổ chức nào
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Tạo tổ chức đầu tiên hoặc dán link mời để bắt đầu dùng hệ
                    thống.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
              <span className="material-symbols-outlined text-blue-600">
                add_business
              </span>
              Tạo tổ chức mới
            </h2>
            <form className="mt-5 space-y-4" onSubmit={handleCreate}>
              <label className="block">
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
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
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white"
                  placeholder="Ví dụ: WorkHub Core Team"
                />
              </label>
              <label className="block">
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
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
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white"
                  placeholder="Không gian dành cho nhóm, lớp học, cộng đồng hoặc dự án của bạn."
                />
              </label>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span>
                  <span className="block text-xs font-extrabold uppercase tracking-wide text-slate-500">
                    Màu nhận diện
                  </span>
                  <span className="mt-1 block text-sm font-bold text-slate-800">
                    Dùng cho avatar và điểm nhấn
                  </span>
                </span>
                <input
                  type="color"
                  value={createForm.accentColor}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      accentColor: event.target.value,
                    }))
                  }
                  className="size-11 rounded-lg border border-slate-200 bg-white p-1"
                  aria-label="Màu nhận diện tổ chức"
                />
              </label>
              <button
                type="submit"
                disabled={!createForm.name.trim() || isCreating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-xl leading-none">
                  {isCreating ? "progress_activity" : "add"}
                </span>
                Tạo tổ chức
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
              <span className="material-symbols-outlined text-emerald-600">
                login
              </span>
              Tham gia bằng link mời
            </h2>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={inviteLink}
                onChange={(event) => setInviteLink(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-white"
                placeholder="Dán link mời hoặc mã invite"
              />
              <button
                type="button"
                onClick={() => handleJoin()}
                disabled={!inviteLink.trim() || isJoining}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-xl leading-none">
                  {isJoining ? "progress_activity" : "group_add"}
                </span>
                Tham gia
              </button>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
                Tổ chức của bạn
              </h3>
              <div className="mt-3 grid gap-3">
                {organizations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300">
                      inventory_2
                    </span>
                    <p className="mt-2 text-sm font-bold text-slate-500">
                      Chưa có tổ chức nào
                    </p>
                  </div>
                ) : (
                  organizations.map((organization) => {
                    const organizationId = getOrganizationId(organization);
                    const isActive = organizationId === activeOrganizationId;
                    return (
                      <article
                        key={organizationId}
                        className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                          isActive
                            ? "border-blue-200 bg-blue-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                          style={{ background: organization.accentColor }}
                        >
                          {organization.name?.charAt(0)?.toUpperCase() || "O"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-black text-slate-950">
                            {organization.name}
                          </h4>
                          <p className="truncate text-xs font-semibold text-slate-500">
                            {organization.role || "member"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSwitch(organizationId)}
                          disabled={isActive || isSwitchingId === organizationId}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold transition ${
                            isActive
                              ? "bg-white text-blue-700"
                              : "bg-slate-950 text-white hover:bg-slate-800"
                          } disabled:opacity-70`}
                        >
                          <span className="material-symbols-outlined text-base leading-none">
                            {isActive ? "check" : "sync_alt"}
                          </span>
                          {isActive ? "Đang dùng" : "Chuyển"}
                        </button>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>

        {activeOrganization && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
                  <span className="material-symbols-outlined text-indigo-600">
                    tune
                  </span>
                  Thiết lập tổ chức hiện tại
                </h2>
                <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                  Các thay đổi này áp dụng cho không gian đang active. Dữ liệu
                  bảng tin, tin nhắn, tài liệu và công việc vẫn tách biệt theo
                  từng tổ chức.
                </p>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide ${
                  canManageActiveOrganization
                    ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
                    : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                }`}
              >
                <span className="material-symbols-outlined text-base leading-none">
                  {canManageActiveOrganization ? "admin_panel_settings" : "lock"}
                </span>
                {canManageActiveOrganization
                  ? "Có quyền quản lý"
                  : "Chỉ xem thông tin"}
              </span>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.95fr]">
              <form
                className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
                onSubmit={handleUpdateActiveOrganization}
              >
                <label className="block">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                    Tên tổ chức
                  </span>
                  <input
                    value={editForm.name}
                    disabled={!canManageActiveOrganization}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-indigo-300 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                    Màu nhận diện
                  </span>
                  <span className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                    <input
                      type="color"
                      value={editForm.accentColor}
                      disabled={!canManageActiveOrganization}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          accentColor: event.target.value,
                        }))
                      }
                      className="size-9 rounded-lg border border-slate-200 bg-white p-1"
                      aria-label="Màu nhận diện tổ chức hiện tại"
                    />
                    <span className="text-sm font-bold text-slate-700">
                      {editForm.accentColor}
                    </span>
                  </span>
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                    Mô tả
                  </span>
                  <textarea
                    value={editForm.description}
                    disabled={!canManageActiveOrganization}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={3}
                    className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-300 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    !canManageActiveOrganization ||
                    !editForm.name.trim() ||
                    isUpdating
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-60 sm:col-span-2"
                >
                  <span className="material-symbols-outlined text-xl leading-none">
                    {isUpdating ? "progress_activity" : "save"}
                  </span>
                  Lưu thay đổi
                </button>
              </form>

              <div className="grid gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-600">
                    <span className="material-symbols-outlined text-emerald-600">
                      link
                    </span>
                    Link mời
                  </h3>
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold leading-5 text-slate-600">
                    <span className="line-clamp-2 break-all">
                      {inviteUrl || "Link mời đang tắt"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      disabled={!inviteUrl}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-lg leading-none">
                        content_copy
                      </span>
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleInvite}
                      disabled={!canManageActiveOrganization || isUpdating}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-lg leading-none">
                        {editForm.inviteEnabled ? "link_off" : "add_link"}
                      </span>
                      {editForm.inviteEnabled ? "Tắt" : "Bật"}
                    </button>
                    <button
                      type="button"
                      onClick={handleRotateInvite}
                      disabled={
                        !canManageActiveOrganization ||
                        !editForm.inviteEnabled ||
                        isRotatingInvite
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-lg leading-none">
                        sync
                      </span>
                      Đổi
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-red-700">
                    <span className="material-symbols-outlined text-red-600">
                      exit_to_app
                    </span>
                    Rời tổ chức
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-red-700/80">
                    Owner không thể rời tổ chức. Thành viên rời tổ chức sẽ mất
                    quyền xem dữ liệu trong không gian này.
                  </p>
                  <button
                    type="button"
                    onClick={handleLeaveOrganization}
                    disabled={activeOrganization.role === "owner" || isLeaving}
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-xl leading-none">
                      {isLeaving ? "progress_activity" : "logout"}
                    </span>
                    Rời tổ chức này
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
                <span className="material-symbols-outlined text-cyan-600">
                  groups
                </span>
                Thành viên tổ chức hiện tại
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {activeOrganization
                  ? activeOrganization.name
                  : "Chọn hoặc tạo một tổ chức để xem thành viên"}
              </p>
            </div>
            {inviteUrl && (
              <button
                type="button"
                onClick={handleCopyInvite}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-slate-800 transition hover:bg-white"
              >
                <span className="material-symbols-outlined text-xl leading-none">
                  content_copy
                </span>
                Copy invite
              </button>
            )}
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            {isLoadingMembers ? (
              <div className="flex items-center justify-center gap-3 px-4 py-10 text-sm font-bold text-slate-500">
                <span className="size-5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                Đang tải thành viên...
              </div>
            ) : members.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300">
                  group_off
                </span>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  Chưa có thành viên để hiển thị
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700">
                      {member.user?.fullName?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">
                        {member.user?.fullName || "Người dùng"}
                      </p>
                      <p className="truncate text-xs font-semibold text-slate-500">
                        {member.user?.email}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default OrganizationPage;
