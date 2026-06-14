import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { App } from "antd";
import { getOrganizationMembers } from "../../api/organizationApi";
import { useAuth } from "../../context/AuthContext";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";

const normalizeInviteValue = (value) => String(value || "").trim();

const getOrganizationId = (organization) => organization?.id || organization?._id;

const getInitials = (value = "") => {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "WH";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
};

const roleLabels = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const OrganizationLogo = ({ organization, className = "size-14", labelClassName = "text-base" }) => {
  const logoUrl = getAvatarUrl(organization?.logoUrl);

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={organization?.name || "Organization"}
        referrerPolicy={getAvatarReferrerPolicy(logoUrl)}
        className={`${className} shrink-0 rounded-2xl object-cover ring-1 ring-slate-200`}
      />
    );
  }

  return (
    <div
      className={`${className} ${labelClassName} flex shrink-0 items-center justify-center rounded-2xl bg-slate-950 font-black text-white ring-1 ring-slate-800`}
    >
      {getInitials(organization?.name)}
    </div>
  );
};

const MemberAvatar = ({ member }) => {
  const user = member?.user || {};
  const avatarUrl = getAvatarUrl(user.avatar);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={user.fullName || "Member"}
        referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
        className="size-10 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
      />
    );
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-700 ring-1 ring-slate-200">
      {getInitials(user.fullName || user.email || "U")}
    </div>
  );
};

const OrganizationPage = () => {
  const {
    user,
    createOrganization,
    joinOrganization,
    leaveOrganization,
    switchActiveOrganization,
    refreshOrganizations,
    updateOrganization,
    updateOrganizationLogo,
  } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const inviteFromUrl = params.inviteCode || searchParams.get("invite") || "";
  const hasAutoJoinedRef = useRef(false);
  const logoInputRef = useRef(null);

  const [inviteLink, setInviteLink] = useState(inviteFromUrl);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    inviteEnabled: true,
  });
  const [members, setMembers] = useState([]);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
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
        setCreateForm({ name: "", description: "" });
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

  const handleLogoFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !activeOrganizationId || !canManageActiveOrganization) return;

      const allowedTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ]);
      if (!allowedTypes.has(file.type)) {
        message.error("Logo phải là ảnh JPG, PNG, GIF hoặc WebP");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        message.error("Logo phải nhỏ hơn 5MB");
        return;
      }

      setIsUploadingLogo(true);
      try {
        await updateOrganizationLogo(activeOrganizationId, file);
        message.success("Đã cập nhật ảnh tổ chức");
      } catch (error) {
        console.error("Failed to update organization logo:", error);
        message.error(error?.response?.data?.message || "Không thể tải ảnh lên");
      } finally {
        setIsUploadingLogo(false);
      }
    },
    [
      activeOrganizationId,
      canManageActiveOrganization,
      message,
      updateOrganizationLogo,
    ],
  );

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
    <main className="min-h-full bg-[#f6f7f4] px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200 ring-1 ring-white/10">
                <span className="material-symbols-outlined text-base leading-none">
                  domain
                </span>
                Không gian làm việc
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight text-white sm:text-4xl">
                Tổ chức tách biệt cho từng nhóm, từng dự án
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-slate-300">
                Mỗi tổ chức có hội thoại, bản tin, tài liệu, công việc và cuộc
                họp riêng. Chọn đúng tổ chức trước khi thao tác để giữ dữ liệu
                đúng ngữ cảnh.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ["business", organizations.length, "Tổ chức"],
                  ["groups", activeOrganizationStats.members, "Thành viên"],
                  [
                    "admin_panel_settings",
                    activeOrganizationStats.admins + activeOrganizationStats.owners,
                    "Quản trị",
                  ],
                ].map(([icon, value, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl bg-white/[0.08] px-4 py-3 ring-1 ring-white/10"
                  >
                    <span className="material-symbols-outlined text-lg text-slate-300">
                      {icon}
                    </span>
                    <p className="mt-2 text-2xl font-black tabular-nums">
                      {value}
                    </p>
                    <p className="text-xs font-bold text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="border-t border-white/10 bg-white/[0.04] p-6 sm:p-8 lg:border-l lg:border-t-0">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Đang sử dụng
              </p>
              {activeOrganization ? (
                <div className="mt-4">
                  <div className="flex items-center gap-4">
                    <OrganizationLogo
                      organization={activeOrganization}
                      className="size-16"
                      labelClassName="text-lg"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-black">
                        {activeOrganization.name}
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-slate-300">
                        {roleLabels[activeOrganization.role] ||
                          activeOrganization.role ||
                          "Member"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    {activeOrganization.description || "Chưa có mô tả tổ chức."}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      disabled={!inviteUrl}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-lg leading-none">
                        content_copy
                      </span>
                      Copy invite
                    </button>
                    {canManageActiveOrganization && (
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isUploadingLogo}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-black text-white ring-1 ring-white/10 transition hover:bg-slate-700 disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-lg leading-none">
                          {isUploadingLogo ? "progress_activity" : "add_photo_alternate"}
                        </span>
                        Upload ảnh
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl bg-white/[0.08] p-5 ring-1 ring-white/10">
                  <span className="material-symbols-outlined text-4xl text-slate-300">
                    domain_add
                  </span>
                  <p className="mt-4 text-lg font-black">Chưa có tổ chức</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Tạo tổ chức đầu tiên hoặc tham gia bằng link mời.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </section>

        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleLogoFileChange}
        />

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Tổ chức của bạn
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Chọn một thẻ để chuyển context làm việc.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
                <span className="material-symbols-outlined text-base leading-none">
                  verified
                </span>
                Tenant scoped
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {organizations.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-300">
                    inventory_2
                  </span>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    Bạn chưa tham gia tổ chức nào
                  </p>
                </div>
              ) : (
                organizations.map((organization) => {
                  const organizationId = getOrganizationId(organization);
                  const isActive = organizationId === activeOrganizationId;
                  return (
                    <article
                      key={organizationId}
                      className={`flex min-h-[168px] flex-col justify-between rounded-2xl p-4 ring-1 transition ${
                        isActive
                          ? "bg-slate-950 text-white ring-slate-950"
                          : "bg-white text-slate-950 ring-slate-200 hover:-translate-y-0.5 hover:ring-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <OrganizationLogo
                          organization={organization}
                          className="size-12"
                          labelClassName="text-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-black">
                            {organization.name}
                          </h3>
                          <p
                            className={`mt-1 line-clamp-2 text-xs font-medium leading-5 ${
                              isActive ? "text-slate-300" : "text-slate-500"
                            }`}
                          >
                            {organization.description || "Chưa có mô tả"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                            isActive
                              ? "bg-white/10 text-slate-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {roleLabels[organization.role] || organization.role || "Member"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSwitch(organizationId)}
                          disabled={isActive || isSwitchingId === organizationId}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition ${
                            isActive
                              ? "bg-white text-slate-950"
                              : "bg-slate-950 text-white hover:bg-slate-800"
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                        >
                          <span className="material-symbols-outlined text-base leading-none">
                            {isActive ? "check" : "sync_alt"}
                          </span>
                          {isActive ? "Active" : "Chuyển"}
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <aside className="grid gap-5">
            <form
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
              onSubmit={handleCreate}
            >
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
                <span className="material-symbols-outlined text-slate-700">
                  add_business
                </span>
                Tạo tổ chức
              </h2>
              <label className="mt-5 block">
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
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="VD: WorkHub Core Team"
                />
              </label>
              <label className="mt-4 block">
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
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Nhóm, lớp học, cộng đồng hoặc dự án."
                />
              </label>
              <button
                type="submit"
                disabled={!createForm.name.trim() || isCreating}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  {isCreating ? "progress_activity" : "add"}
                </span>
                Tạo tổ chức
              </button>
            </form>

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
                <span className="material-symbols-outlined text-slate-700">
                  group_add
                </span>
                Tham gia
              </h2>
              <div className="mt-5 flex flex-col gap-3">
                <input
                  value={inviteLink}
                  onChange={(event) => setInviteLink(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Dán link mời hoặc mã invite"
                />
                <button
                  type="button"
                  onClick={() => handleJoin()}
                  disabled={!inviteLink.trim() || isJoining}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-lg leading-none">
                    {isJoining ? "progress_activity" : "login"}
                  </span>
                  Tham gia tổ chức
                </button>
              </div>
            </div>
          </aside>
        </section>

        {activeOrganization && (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Cài đặt tổ chức hiện tại
                  </h2>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                    Chỉnh tên, mô tả, ảnh đại diện và link mời của tổ chức đang
                    active.
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${
                    canManageActiveOrganization
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                      : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                  }`}
                >
                  <span className="material-symbols-outlined text-base leading-none">
                    {canManageActiveOrganization ? "lock_open" : "lock"}
                  </span>
                  {canManageActiveOrganization ? "Có quyền sửa" : "Chỉ xem"}
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-5 lg:flex-row">
                <div className="flex w-full flex-col items-center rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 lg:w-64">
                  <OrganizationLogo
                    organization={activeOrganization}
                    className="size-24"
                    labelClassName="text-2xl"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={!canManageActiveOrganization || isUploadingLogo}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg leading-none">
                      {isUploadingLogo ? "progress_activity" : "upload"}
                    </span>
                    Đổi ảnh
                  </button>
                  <p className="mt-3 text-center text-xs font-medium leading-5 text-slate-500">
                    JPG, PNG, GIF hoặc WebP. Tối đa 5MB.
                  </p>
                </div>

                <form
                  className="grid min-w-0 flex-1 gap-4"
                  onSubmit={handleUpdateActiveOrganization}
                >
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
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
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
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
                      rows={4}
                      className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={
                      !canManageActiveOrganization ||
                      !editForm.name.trim() ||
                      isUpdating
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-lg leading-none">
                      {isUpdating ? "progress_activity" : "save"}
                    </span>
                    Lưu thay đổi
                  </button>
                </form>
              </div>
            </div>

            <aside className="grid gap-5">
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
                  <span className="material-symbols-outlined text-slate-700">
                    link
                  </span>
                  Link mời
                </h2>
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold leading-5 text-slate-600 ring-1 ring-slate-200">
                  <span className="line-clamp-2 break-all">
                    {inviteUrl || "Link mời đang tắt"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    disabled={!inviteUrl}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base leading-none">
                      content_copy
                    </span>
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleInvite}
                    disabled={!canManageActiveOrganization || isUpdating}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base leading-none">
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
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base leading-none">
                      sync
                    </span>
                    Đổi
                  </button>
                </div>
              </div>

              <div className="rounded-3xl bg-red-50 p-5 ring-1 ring-red-100">
                <h2 className="flex items-center gap-2 text-lg font-black text-red-800">
                  <span className="material-symbols-outlined text-red-700">
                    logout
                  </span>
                  Rời tổ chức
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-red-700/80">
                  Owner không thể rời tổ chức. Thành viên rời tổ chức sẽ mất
                  quyền truy cập dữ liệu trong không gian này.
                </p>
                <button
                  type="button"
                  onClick={handleLeaveOrganization}
                  disabled={activeOrganization.role === "owner" || isLeaving}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg leading-none">
                    {isLeaving ? "progress_activity" : "exit_to_app"}
                  </span>
                  Rời tổ chức này
                </button>
              </div>
            </aside>
          </section>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Thành viên tổ chức
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {activeOrganization
                  ? activeOrganization.name
                  : "Chọn hoặc tạo một tổ chức để xem thành viên"}
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
              <span className="material-symbols-outlined text-base leading-none">
                groups
              </span>
              {members.length} members
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-slate-200">
            {isLoadingMembers ? (
              <div className="grid gap-0 divide-y divide-slate-100">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="flex items-center gap-3 px-4 py-4">
                    <span className="size-10 animate-pulse rounded-xl bg-slate-100" />
                    <span className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                    <span className="h-7 w-20 animate-pulse rounded-lg bg-slate-100" />
                  </div>
                ))}
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
                    className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <MemberAvatar member={member} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {member.user?.fullName || "Người dùng"}
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-500">
                          {member.user?.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      {member.user?.position && (
                        <span className="truncate rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                          {member.user.position}
                        </span>
                      )}
                      <span className="rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-white">
                        {roleLabels[member.role] || member.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default OrganizationPage;
