import { useEffect, useMemo, useRef, useState } from "react";
import {
  addConversationMember,
  getConversationDetail,
  updateConversation,
  updateConversationSettings,
  uploadConversationAttachment,
} from "../../api/conversationApi";
import { searchUsers } from "../../api/userApi";
import {
  getActivityStatusMeta,
  getEffectiveActivityStatus,
} from "./activityStatus";
import ActivityStatusIcon from "./ActivityStatusIcon";
import { getChatDetailDisplay } from "./chatDetailPanelState";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";

const toComparableId = (value) => {
  if (value == null) return "";
  if (typeof value === "object") return String(value.id || value._id || "");
  return String(value);
};

const getConversationId = (conversation) =>
  toComparableId(conversation?.id || conversation?._id);

const formatDateTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
};

const formatFileSize = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const muteDurations = [
  { key: "1h", label: "1 giờ" },
  { key: "8h", label: "8 giờ" },
  { key: "24h", label: "24 giờ" },
  { key: "7d", label: "7 ngày" },
  { key: "forever", label: "Luôn tắt" },
];

const sectionShellClass =
  "border-b border-slate-200 bg-white px-4 py-4 last:border-b-0";

const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

const EmptySection = ({ icon, text }) => (
  <div className="flex min-h-[4.75rem] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-center">
    <span className="material-symbols-outlined mb-1 text-2xl text-slate-400">
      {icon}
    </span>
    <p className="text-xs font-bold text-slate-500">{text}</p>
  </div>
);

const SectionHeader = ({ icon, title, action }) => (
  <div className="mb-3 flex items-center justify-between gap-3">
    <h3 className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-900">
      <span className="material-symbols-outlined text-[18px] text-blue-600">
        {icon}
      </span>
      <span className="truncate">{title}</span>
    </h3>
    {action}
  </div>
);

const MessageMiniRow = ({ message, icon, title, meta }) => (
  <div className="flex min-w-0 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
    <span className="material-symbols-outlined mt-0.5 text-[18px] text-blue-600">
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <p className="line-clamp-2 text-sm font-extrabold leading-snug text-slate-900">
        {title || message?.content || "Không có tiêu đề"}
      </p>
      <p className="mt-1 truncate text-[11px] font-bold text-slate-500">
        {meta || `${message?.sender?.fullName || "Người dùng"} · ${formatDateTime(message?.createdAt)}`}
      </p>
    </div>
  </div>
);

const ChatDetailPanel = ({
  conversation,
  currentUserId,
  onClose,
  onConversationUpdated,
  className = "hidden w-80 border-l border-slate-200 bg-white xl:flex",
}) => {
  const conversationId = getConversationId(conversation);
  const conversationDetailVersion = [
    conversationId,
    conversation?.lastActivityAt,
    conversation?.updatedAt,
    conversation?.lastMessage?.createdAt,
  ].join("|");
  const avatarInputRef = useRef(null);
  const [detail, setDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [showMuteChoices, setShowMuteChoices] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberCandidates, setMemberCandidates] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isAddingMemberId, setIsAddingMemberId] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!conversationId) {
      setDetail(null);
      return undefined;
    }

    let ignore = false;
    setIsLoadingDetail(true);
    setErrorText("");

    getConversationDetail(conversationId)
      .then((payload) => {
        if (ignore) return;
        setDetail(payload);
        if (payload?.conversation) {
          onConversationUpdated?.(payload.conversation);
        }
      })
      .catch((error) => {
        if (!ignore) {
          console.error("Failed to load conversation detail:", error);
          setErrorText("Không thể tải chi tiết hội thoại");
        }
      })
      .finally(() => {
        if (!ignore) setIsLoadingDetail(false);
      });

    return () => {
      ignore = true;
    };
  }, [conversationDetailVersion, conversationId, onConversationUpdated]);

  const activeConversation = detail?.conversation || conversation;
  const display = getChatDetailDisplay(activeConversation, currentUserId);
  const {
    isPrivate,
    participantCount,
    displayName,
    displayInitial,
    originalName,
    email,
    avatar,
    activityStatus,
    isOnline,
  } = display || {};
  const displayAvatar = getAvatarUrl(avatar);
  const settings = activeConversation?.currentParticipant || {};
  const isPinned = Boolean(settings.isPinned);
  const isMuted = Boolean(settings.isMuted);
  const board = detail?.board || {};
  const shared = detail?.shared || {};
  const memberIds = useMemo(
    () =>
      new Set(
        (activeConversation?.participants || []).map((participant) =>
          toComparableId(participant.userId || participant.user),
        ),
      ),
    [activeConversation?.participants],
  );
  const visibleCandidates = memberCandidates.filter(
    (item) => !memberIds.has(toComparableId(item.id || item._id)),
  );
  const activityStatusMeta = getActivityStatusMeta(
    getEffectiveActivityStatus({ activityStatus, isOnline }),
  );

  useEffect(() => {
    setNameDraft(displayName || "");
    setEditingName(false);
    setShowMuteChoices(false);
    setShowMemberPicker(false);
    setMemberQuery("");
    setMemberCandidates([]);
  }, [conversationId, displayName]);

  useEffect(() => {
    if (!showMemberPicker) return undefined;

    let ignore = false;
    setIsLoadingMembers(true);
    searchUsers({ keyword: memberQuery, size: 12 })
      .then((payload) => {
        if (!ignore) setMemberCandidates(payload.content || []);
      })
      .catch((error) => {
        if (!ignore) {
          console.error("Failed to search members:", error);
          setMemberCandidates([]);
        }
      })
      .finally(() => {
        if (!ignore) setIsLoadingMembers(false);
      });

    return () => {
      ignore = true;
    };
  }, [showMemberPicker, memberQuery]);

  const mergeConversation = (updatedConversation) => {
    if (!updatedConversation) return;
    setDetail((prev) => ({
      ...(prev || {}),
      conversation: updatedConversation,
    }));
    onConversationUpdated?.(updatedConversation);
  };

  const handleSaveName = async (event) => {
    event?.preventDefault?.();
    if (!conversationId) return;
    const trimmedName = nameDraft.trim();
    if (!isPrivate && !trimmedName) return;

    setIsSavingName(true);
    setErrorText("");
    try {
      const payload = isPrivate
        ? await updateConversationSettings(conversationId, {
            nickname: trimmedName,
          })
        : await updateConversation(conversationId, {
            name: trimmedName,
          });
      mergeConversation(payload);
      setEditingName(false);
    } catch (error) {
      console.error("Failed to update conversation name:", error);
      setErrorText("Không thể lưu tên hội thoại");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !conversationId || isPrivate) return;

    if (!file.type.startsWith("image/")) {
      setErrorText("Ảnh đoạn chat phải là tệp hình ảnh");
      return;
    }

    setIsSavingAvatar(true);
    setErrorText("");
    try {
      const uploaded = await uploadConversationAttachment(conversationId, file, {
        purpose: "avatar",
      });
      const payload = await updateConversation(conversationId, {
        avatar: uploaded.fileUrl,
      });
      mergeConversation(payload);
    } catch (error) {
      console.error("Failed to update conversation avatar:", error);
      setErrorText("Không thể đổi ảnh đoạn chat");
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleSettingsUpdate = async (payload) => {
    if (!conversationId) return;
    setIsSavingSettings(true);
    setErrorText("");
    try {
      const updatedConversation = await updateConversationSettings(
        conversationId,
        payload,
      );
      mergeConversation(updatedConversation);
      setShowMuteChoices(false);
    } catch (error) {
      console.error("Failed to update conversation settings:", error);
      setErrorText("Không thể cập nhật thiết lập hội thoại");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddMember = async (userId) => {
    if (!conversationId || !userId) return;
    setIsAddingMemberId(toComparableId(userId));
    setErrorText("");
    try {
      const updatedConversation = await addConversationMember(
        conversationId,
        userId,
      );
      mergeConversation(updatedConversation);
      setMemberQuery("");
      setShowMemberPicker(false);
    } catch (error) {
      console.error("Failed to add member:", error);
      setErrorText("Không thể thêm thành viên vào nhóm");
    } finally {
      setIsAddingMemberId("");
    }
  };

  if (!activeConversation || !display) return null;

  return (
    <aside
      className={`chat-detail-panel h-full shrink-0 flex-col overflow-hidden ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h2 className="text-sm font-black text-slate-900">Chi tiết hội thoại</h2>
        <button
          onClick={onClose}
          className={iconButtonClass}
          title="Đóng"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto chat-conversations-scroll">
        <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-5">
          <div className="flex flex-col items-center text-center">
            <button
              type="button"
              className={`relative ${isPrivate ? "cursor-default" : "cursor-pointer"}`}
              onClick={() => {
                if (!isPrivate) avatarInputRef.current?.click();
              }}
              title={isPrivate ? originalName || displayName : "Đổi ảnh đoạn chat"}
              disabled={isSavingAvatar}
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={displayName}
                  referrerPolicy={getAvatarReferrerPolicy(displayAvatar)}
                  className={`h-24 w-24 object-cover shadow-md ring-4 ring-white ${
                    isPrivate ? "rounded-full" : "rounded-2xl"
                  }`}
                />
              ) : (
                <div
                  className={`flex h-24 w-24 items-center justify-center bg-blue-600 text-3xl font-black text-white shadow-md ring-4 ring-white ${
                    isPrivate ? "rounded-full" : "rounded-2xl"
                  }`}
                >
                  {displayInitial}
                </div>
              )}
              {isPrivate && (
                <div
                  className={`activity-status-badge activity-status-badge--large absolute bottom-1 right-1 ${activityStatusMeta.badgeClassName}`}
                  title={activityStatusMeta.menuLabel}
                >
                  <ActivityStatusIcon meta={activityStatusMeta} size="sm" />
                </div>
              )}
              {!isPrivate && (
                <span className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-700 shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">
                    photo_camera
                  </span>
                </span>
              )}
              {isSavingAvatar && (
                <span className="absolute inset-0 inline-flex items-center justify-center rounded-2xl bg-slate-950/45 text-xs font-black text-white">
                  Đang lưu
                </span>
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />

            <form className="mt-4 w-full" onSubmit={handleSaveName}>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-center text-base font-black text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                    autoFocus
                    maxLength={isPrivate ? 80 : 120}
                  />
                  <button
                    type="submit"
                    className={iconButtonClass}
                    disabled={isSavingName}
                    title="Lưu tên"
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      check
                    </span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="group inline-flex max-w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-lg font-black text-slate-950 transition-colors hover:bg-blue-50 hover:text-blue-700"
                  onClick={() => {
                    setNameDraft(displayName);
                    setEditingName(true);
                  }}
                  title={isPrivate ? "Đổi tên gợi nhớ" : "Đổi tên đoạn chat"}
                >
                  <span className="truncate">{displayName}</span>
                  <span className="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-blue-600">
                    edit
                  </span>
                </button>
              )}
            </form>

            {isPrivate && email && (
              <p className="mt-1 max-w-full break-all text-xs font-bold text-slate-500">
                {originalName !== displayName ? `${originalName} · ${email}` : email}
              </p>
            )}

            {!isPrivate && (
              <p className="mt-1 text-xs font-bold text-slate-500">
                {participantCount} thành viên
              </p>
            )}

            {errorText && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                {errorText}
              </p>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-black transition-colors ${
                isMuted
                  ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              }`}
              disabled={isSavingSettings}
              onClick={() =>
                isMuted
                  ? handleSettingsUpdate({ muteDuration: "off" })
                  : setShowMuteChoices((value) => !value)
              }
            >
              <span className="material-symbols-outlined text-[19px]">
                {isMuted ? "notifications_off" : "notifications"}
              </span>
              {isMuted ? "Bật thông báo" : "Tắt thông báo"}
            </button>
            <button
              type="button"
              className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-black transition-colors ${
                isPinned
                  ? "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              }`}
              disabled={isSavingSettings}
              onClick={() => handleSettingsUpdate({ isPinned: !isPinned })}
            >
              <span className="material-symbols-outlined text-[19px]">
                push_pin
              </span>
              {isPinned ? "Bỏ ghim" : "Ghim hội thoại"}
            </button>
          </div>

          {showMuteChoices && !isMuted && (
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
              {muteDurations.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={isSavingSettings}
                  onClick={() => handleSettingsUpdate({ muteDuration: item.key })}
                  className="rounded-md px-2 py-2 text-xs font-black text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {!isPrivate && (
          <section className={sectionShellClass}>
            <SectionHeader
              icon="groups"
              title={`Thành viên (${participantCount})`}
              action={
                <button
                  type="button"
                  className={iconButtonClass}
                  onClick={() => setShowMemberPicker((value) => !value)}
                  title="Thêm thành viên"
                >
                  <span className="material-symbols-outlined text-[19px]">
                    person_add
                  </span>
                </button>
              }
            />

            {showMemberPicker && (
              <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <input
                  value={memberQuery}
                  onChange={(event) => setMemberQuery(event.target.value)}
                  placeholder="Tìm thành viên..."
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
                <div className="mt-2 grid gap-1.5">
                  {isLoadingMembers ? (
                    <p className="py-2 text-center text-xs font-bold text-slate-500">
                      Đang tìm...
                    </p>
                  ) : visibleCandidates.length === 0 ? (
                    <p className="py-2 text-center text-xs font-bold text-slate-500">
                      Không có thành viên phù hợp
                    </p>
                  ) : (
                    visibleCandidates.map((candidate) => {
                      const candidateId = toComparableId(
                        candidate.id || candidate._id,
                      );
                      const avatarUrl = getAvatarUrl(candidate.avatar);
                      return (
                        <button
                          key={candidateId}
                          type="button"
                          onClick={() => handleAddMember(candidateId)}
                          disabled={isAddingMemberId === candidateId}
                          className="flex items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-white"
                        >
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={candidate.fullName}
                              referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">
                              {(candidate.fullName || "N").charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-900">
                              {candidate.fullName || "Người dùng"}
                            </span>
                            <span className="block truncate text-[11px] font-bold text-slate-500">
                              {candidate.email}
                            </span>
                          </span>
                          <span className="material-symbols-outlined text-[18px] text-blue-600">
                            add
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-2">
              {(activeConversation.participants || []).map((participant, idx) => {
                const user = participant.user;
                const name = user?.fullName || "Người dùng";
                const avatarUrl = getAvatarUrl(user?.avatar);
                return (
                  <div
                    key={user?._id || participant.userId || idx}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2"
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={name}
                        referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-black text-slate-700">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-800">
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className={sectionShellClass}>
          <SectionHeader
            icon="dashboard"
            title={isPrivate ? "Bảng tin" : "Bảng tin nhóm"}
          />
          {isLoadingDetail ? (
            <EmptySection icon="sync" text="Đang tải bảng tin..." />
          ) : (
            <div className="grid gap-3">
              <div>
                <p className="mb-2 text-xs font-black text-slate-500">
                  Nhắc hẹn
                </p>
                <div className="grid gap-2">
                  {(board.reminders || []).length > 0 ? (
                    board.reminders.map((message) => (
                        <MessageMiniRow
                          key={message.id}
                          message={message}
                          icon="event"
                          title={message.reminder?.title || message.content}
                          meta={formatDateTime(
                            message.reminder?.scheduledAt || message.createdAt,
                          )}
                        />
                      ))
                  ) : (
                    <EmptySection icon="event_busy" text="Chưa có nhắc hẹn" />
                  )}
                </div>
              </div>

              {!isPrivate && (
                <div>
                  <p className="mb-2 text-xs font-black text-slate-500">
                    Bình chọn
                  </p>
                  <div className="grid gap-2">
                    {(board.polls || []).length > 0 ? (
                      board.polls.map((message) => (
                          <MessageMiniRow
                            key={message.id}
                            message={message}
                            icon="poll"
                            title={message.poll?.question || message.content}
                            meta={`${message.poll?.totalVoters ?? 0} người đã bình chọn`}
                          />
                        ))
                    ) : (
                      <EmptySection icon="ballot" text="Chưa có bình chọn" />
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-black text-slate-500">
                  Tin nhắn được ghim
                </p>
                <div className="grid gap-2">
                  {(board.pinnedMessages || []).length > 0 ? (
                    board.pinnedMessages.map((message) => (
                        <MessageMiniRow
                          key={message.id}
                          message={message}
                          icon="push_pin"
                          title={message.content || message.poll?.question || message.reminder?.title || "Tin nhắn đã ghim"}
                          meta={`Ghim lúc ${formatDateTime(message.pinnedAt || message.createdAt)}`}
                        />
                      ))
                  ) : (
                    <EmptySection icon="keep_off" text="Chưa ghim tin nhắn" />
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className={sectionShellClass}>
          <SectionHeader icon="photo_library" title="Ảnh/Video" />
          {(shared.media || []).length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {shared.media.map((item) => (
                <a
                  key={item.id}
                  href={item.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="aspect-square overflow-hidden rounded-lg bg-slate-100"
                  title={item.fileName}
                >
                  {String(item.mimeType).startsWith("video/") ||
                  item.kind === "video" ? (
                    <span className="flex h-full w-full items-center justify-center bg-slate-900 text-white">
                      <span className="material-symbols-outlined">play_circle</span>
                    </span>
                  ) : (
                    <img
                      src={item.fileUrl}
                      alt={item.fileName || "Ảnh đã chia sẻ"}
                      className="h-full w-full object-cover"
                    />
                  )}
                </a>
              ))}
            </div>
          ) : (
            <EmptySection icon="perm_media" text="Chưa có ảnh hoặc video" />
          )}
        </section>

        <section className={sectionShellClass}>
          <SectionHeader icon="folder" title="File" />
          {(shared.files || []).length > 0 ? (
            <div className="grid gap-2">
              {shared.files.map((item) => (
                <a
                  key={item.id}
                  href={item.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 transition-colors hover:border-blue-200 hover:bg-blue-50"
                >
                  <span className="material-symbols-outlined text-[20px] text-blue-600">
                    description
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-900">
                      {item.fileName || "Tệp đã chia sẻ"}
                    </span>
                    <span className="block text-[11px] font-bold text-slate-500">
                      {formatFileSize(item.fileSize) || formatDateTime(item.createdAt)}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <EmptySection icon="draft" text="Chưa có file" />
          )}
        </section>

        <section className={sectionShellClass}>
          <SectionHeader icon="link" title="Link" />
          {(shared.links || []).length > 0 ? (
            <div className="grid gap-2">
              {shared.links.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5 transition-colors hover:border-blue-200 hover:bg-blue-50"
                >
                  <span className="block truncate text-sm font-black text-blue-700">
                    {item.title}
                  </span>
                  <span className="mt-1 line-clamp-2 text-[11px] font-bold text-slate-500">
                    {item.contentPreview || formatDateTime(item.createdAt)}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <EmptySection icon="link_off" text="Chưa có link" />
          )}
        </section>
      </div>
    </aside>
  );
};

export default ChatDetailPanel;
