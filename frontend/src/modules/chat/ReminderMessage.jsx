import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { getAvatarUrl } from "../../utils/avatar";
import ReminderCreateModal from "./ReminderCreateModal";

const recurrenceLabels = {
  none: "Nhắc 1 lần",
  daily: "Lặp lại hàng ngày",
  weekly: "Lặp lại hàng tuần",
  monthly: "Lặp lại hàng tháng",
};

const responseLabels = {
  accepted: "Tham gia",
  declined: "Từ chối",
};

const getComparableId = (value) => {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || "");
  }
  return String(value);
};

const toValidDate = (dateValue) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isSameCalendarDay = (date, otherDate) =>
  date.getFullYear() === otherDate.getFullYear() &&
  date.getMonth() === otherDate.getMonth() &&
  date.getDate() === otherDate.getDate();

const formatClockTime = (date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;

const formatReminderSchedule = (dateValue, { now = new Date() } = {}) => {
  const date = toValidDate(dateValue);
  if (!date) return "Không rõ thời gian";

  const time = formatClockTime(date);
  if (isSameCalendarDay(date, now)) {
    return `Hôm nay lúc ${time}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameCalendarDay(date, tomorrow)) {
    return `Ngày mai lúc ${time}`;
  }

  return `${date.getDate()} Tháng ${date.getMonth() + 1}, ${
    date.getFullYear()
  } lúc ${time}`;
};

const formatFullDateTime = (dateValue) => {
  const date = toValidDate(dateValue);
  if (!date) return "Không rõ";

  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getDateTile = (dateValue) => {
  const date = toValidDate(dateValue) || new Date();
  return {
    weekday: new Intl.DateTimeFormat("vi-VN", {
      weekday: "short",
    }).format(date),
    day: String(date.getDate()).padStart(2, "0"),
    month: `Tháng ${date.getMonth() + 1}`,
  };
};

const getParticipantUser = (participant) =>
  participant?.user || participant || {};

const getResponseUserId = (response) =>
  getComparableId(response?.userId || response?.user);

const getCurrentReminderStatus = (reminder, currentUserId) => {
  if (!reminder || !currentUserId) return reminder?.currentUserStatus || "";

  if (
    (reminder.accepted || []).some(
      (response) => getResponseUserId(response) === currentUserId,
    )
  ) {
    return "accepted";
  }

  if (
    (reminder.declined || []).some(
      (response) => getResponseUserId(response) === currentUserId,
    )
  ) {
    return "declined";
  }

  const response = (reminder.responses || []).find(
    (item) => getResponseUserId(item) === currentUserId,
  );

  return response?.status || reminder.currentUserStatus || "";
};

const getParticipantKey = (participant, index) => {
  const user = getParticipantUser(participant);
  return user.id || user._id || participant?.userId || `participant-${index}`;
};

const ParticipantAvatar = ({ participant }) => {
  const user = getParticipantUser(participant);
  const name = user.fullName || "Người dùng";
  const avatarUrl = getAvatarUrl(user.avatar);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="reminder-detail-participant-avatar"
        loading="lazy"
      />
    );
  }

  return (
    <span className="reminder-detail-participant-avatar reminder-detail-participant-avatar-fallback">
      {(name || "N").charAt(0).toUpperCase()}
    </span>
  );
};

export const ReminderDetailModal = ({
  message,
  reminder,
  onClose,
  onRespond,
  onCancelReminder,
  onEditReminder,
}) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState("detail");
  const [activeTab, setActiveTab] = useState("accepted");
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!reminder || typeof document === "undefined") return null;

  const currentUserId = getComparableId(user?._id || user?.id);
  const creatorId = getComparableId(message?.sender);
  const isCreator = currentUserId && creatorId && currentUserId === creatorId;
  const title = reminder.title || message?.content || "Nhắc hẹn";
  const dateTile = getDateTile(reminder.scheduledAt);
  const accepted = reminder.accepted || [];
  const declined = reminder.declined || [];
  const visibleParticipants = activeTab === "accepted" ? accepted : declined;
  const currentUserStatus = getCurrentReminderStatus(reminder, currentUserId);
  const canRespond = !reminder.isCancelled && reminder.status !== "completed";
  const canCancel = isCreator && !reminder.isCancelled;
  const canEdit =
    isCreator && !reminder.isCancelled && canRespond && Boolean(onEditReminder);
  const scheduleLabel = formatReminderSchedule(reminder.scheduledAt);
  const recurrenceLabel =
    recurrenceLabels[reminder.recurrence] || recurrenceLabels.none;

  const handleRespond = async (status) => {
    if (!canRespond || pendingAction) return;

    setPendingAction(status);
    setError("");
    try {
      await onRespond?.(message, status);
    } catch {
      setError("Không thể cập nhật xác nhận.");
    } finally {
      setPendingAction("");
    }
  };

  const handleCancelReminder = async () => {
    if (!canCancel || pendingAction) return;

    setPendingAction("cancel");
    setError("");
    try {
      await onCancelReminder?.(message);
      onClose?.();
    } catch {
      setError("Không thể hủy nhắc hẹn.");
    } finally {
      setPendingAction("");
    }
  };

  const handleEditReminder = async (nextReminder) => {
    if (!canEdit || pendingAction) return;

    setPendingAction("edit");
    setError("");
    try {
      await onEditReminder?.(message, nextReminder);
      setIsEditOpen(false);
    } catch {
      setError("Không thể chỉnh sửa nhắc hẹn.");
      throw new Error("Failed to edit reminder");
    } finally {
      setPendingAction("");
    }
  };

  const renderParticipantView = () => (
    <section className="reminder-participant-view">
      <div className="reminder-participant-tabs">
        <button
          type="button"
          className={activeTab === "accepted" ? "is-active" : ""}
          onClick={() => setActiveTab("accepted")}
        >
          Tham gia <span>{accepted.length}</span>
        </button>
        <button
          type="button"
          className={activeTab === "declined" ? "is-active" : ""}
          onClick={() => setActiveTab("declined")}
        >
          Từ chối <span>{declined.length}</span>
        </button>
      </div>
      <div className="reminder-participant-list">
        {visibleParticipants.length > 0 ? (
          visibleParticipants.map((participant, index) => {
            const participantUser = getParticipantUser(participant);
            return (
              <div
                className="reminder-detail-participant"
                key={getParticipantKey(participant, index)}
              >
                <ParticipantAvatar participant={participant} />
                <span>{participantUser.fullName || "Người dùng"}</span>
              </div>
            );
          })
        ) : (
          <p className="reminder-detail-empty">
            {activeTab === "accepted"
              ? "Chưa có người tham gia."
              : "Chưa có người từ chối."}
          </p>
        )}
      </div>
    </section>
  );

  const renderDetailView = () => (
    <>
      <div className="reminder-detail-summary">
        <div className="reminder-date-tile" aria-hidden="true">
          <span>{dateTile.weekday}</span>
          <strong>{dateTile.day}</strong>
          <small>{dateTile.month}</small>
        </div>
        <div className="reminder-detail-copy">
          <h3>{title}</h3>
          <p>
            Tạo bởi <strong>{message?.sender?.fullName || "Người dùng"}</strong>{" "}
            - {formatFullDateTime(message?.createdAt)}
          </p>
          <span>
            <span className="material-symbols-outlined">schedule</span>
            {scheduleLabel}
          </span>
          <span>
            <span className="material-symbols-outlined">sync</span>
            {recurrenceLabel}
          </span>
          {reminder.isCancelled && (
            <span className="reminder-cancelled-note">
              <span className="material-symbols-outlined">event_busy</span>
              Đã hủy lúc {formatFullDateTime(reminder.cancelledAt)}
            </span>
          )}
          <button
            type="button"
            className="reminder-detail-participant-link"
            onClick={() => setViewMode("participants")}
          >
            {accepted.length} người tham gia
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      <div
        className={`reminder-response-panel ${
          currentUserStatus ? `is-${currentUserStatus}` : ""
        }`}
      >
        <div className="reminder-response-status">
          <span className="material-symbols-outlined">
            {currentUserStatus === "declined" ? "close" : "check"}
          </span>
          <strong>
            {currentUserStatus
              ? `Bạn xác nhận: ${responseLabels[currentUserStatus]}.`
              : "Bạn chưa xác nhận."}
          </strong>
        </div>
        <div className="reminder-response-actions">
          <button
            type="button"
            className={currentUserStatus === "accepted" ? "is-active" : ""}
            onClick={() => handleRespond("accepted")}
            disabled={!canRespond || pendingAction === "accepted"}
          >
            Tham gia
          </button>
          <button
            type="button"
            className={currentUserStatus === "declined" ? "is-active" : ""}
            onClick={() => handleRespond("declined")}
            disabled={!canRespond || pendingAction === "declined"}
          >
            Từ chối
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(
    <div
      className="reminder-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose?.();
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <section
        className="reminder-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="reminder-detail-header">
          {viewMode === "participants" ? (
            <button
              type="button"
              className="reminder-detail-icon-button"
              onClick={() => setViewMode("detail")}
              aria-label="Quay lại chi tiết nhắc hẹn"
              title="Quay lại"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          <h2 id="reminder-detail-title">
            {viewMode === "participants" ? "Xác nhận" : "Chi tiết nhắc hẹn"}
          </h2>
          <button
            type="button"
            className="reminder-detail-icon-button"
            onClick={onClose}
            aria-label="Đóng chi tiết nhắc hẹn"
            title="Đóng"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="reminder-detail-body">
          {viewMode === "participants" ? renderParticipantView() : renderDetailView()}
          {error && (
            <p className="reminder-detail-error" role="status">
              {error}
            </p>
          )}
        </div>

        {viewMode === "detail" && isCreator && (
          <footer className="reminder-detail-footer reminder-detail-owner-actions">
            <button
              type="button"
              className="reminder-detail-secondary"
              onClick={() => setIsEditOpen(true)}
              disabled={!canEdit || pendingAction === "edit"}
            >
              <span className="material-symbols-outlined">edit</span>
              Chỉnh sửa
            </button>
            <button
              type="button"
              className="reminder-detail-danger"
              onClick={handleCancelReminder}
              disabled={!canCancel || pendingAction === "cancel"}
            >
              <span className="material-symbols-outlined">event_busy</span>
              {pendingAction === "cancel" ? "Đang hủy..." : "Hủy nhắc hẹn"}
            </button>
          </footer>
        )}
      </section>
      <ReminderCreateModal
        isOpen={isEditOpen}
        mode="edit"
        initialReminder={reminder}
        onClose={() => setIsEditOpen(false)}
        onCreateReminder={handleEditReminder}
        disabled={!canEdit || pendingAction === "edit"}
      />
    </div>,
    document.body,
  );
};

const ReminderMessage = ({
  message,
  onRespond,
  onCancelReminder,
  onEditReminder,
}) => {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { user } = useAuth();
  const reminder = message?.reminder;
  const dateTile = getDateTile(reminder?.scheduledAt);
  const title = reminder?.title || message?.content || "Nhắc hẹn";
  const currentUserId = getComparableId(user?._id || user?.id);
  const currentStatus = getCurrentReminderStatus(reminder, currentUserId);
  const acceptedCount = reminder?.acceptedCount || reminder?.accepted?.length || 0;
  const scheduleLabel = formatReminderSchedule(reminder?.scheduledAt);
  const recurrenceLabel =
    recurrenceLabels[reminder?.recurrence] || recurrenceLabels.none;

  const statusMeta = useMemo(() => {
    if (reminder?.isCancelled) {
      return {
        icon: "event_busy",
        text: "Nhắc hẹn đã hủy",
        className: "is-cancelled",
      };
    }

    if (currentStatus === "declined") {
      return {
        icon: "close",
        text: "Bạn xác nhận: Từ chối.",
        className: "is-declined",
      };
    }

    if (currentStatus === "accepted") {
      return {
        icon: "check",
        text: "Bạn xác nhận: Tham gia.",
        className: "is-accepted",
      };
    }

    return {
      icon: "help",
      text: "Bạn chưa xác nhận.",
      className: "",
    };
  }, [currentStatus, reminder?.isCancelled]);

  if (!reminder) return null;

  const handleCardKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest?.("button, a, [data-reminder-interactive]")) {
      return;
    }

    event.preventDefault();
    setIsDetailOpen(true);
  };

  return (
    <div
      className={`chat-reminder-card ${reminder.isCancelled ? "is-cancelled" : ""}`}
      onClick={() => setIsDetailOpen(true)}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      title="Xem chi tiết nhắc hẹn"
    >
      <div className="chat-reminder-main">
        <div className="reminder-date-tile" aria-hidden="true">
          <span>{dateTile.weekday}</span>
          <strong>{dateTile.day}</strong>
          <small>{dateTile.month}</small>
        </div>
        <div className="chat-reminder-copy">
          <strong>{title}</strong>
          <span>
            <span className="material-symbols-outlined">schedule</span>
            {scheduleLabel}
          </span>
          <span>
            <span className="material-symbols-outlined">sync</span>
            {recurrenceLabel}
          </span>
          <button
            type="button"
            data-reminder-interactive
            className="chat-reminder-participant-link"
            onClick={(event) => {
              event.stopPropagation();
              setIsDetailOpen(true);
            }}
          >
            {acceptedCount} người tham gia
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      <div className={`chat-reminder-response ${statusMeta.className}`}>
        <span className="material-symbols-outlined">{statusMeta.icon}</span>
        <strong>{statusMeta.text}</strong>
        {!reminder.isCancelled && (
          <button
            type="button"
            data-reminder-interactive
            onClick={(event) => {
              event.stopPropagation();
              setIsDetailOpen(true);
            }}
          >
            Thay đổi
          </button>
        )}
      </div>

      {isDetailOpen && (
        <ReminderDetailModal
          message={message}
          reminder={reminder}
          onRespond={onRespond}
          onCancelReminder={onCancelReminder}
          onEditReminder={onEditReminder}
          onClose={() => setIsDetailOpen(false)}
        />
      )}
    </div>
  );
};

export default ReminderMessage;
