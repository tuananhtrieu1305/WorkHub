import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { getAvatarUrl } from "../../utils/avatar";
import { sortPollOptionsByVotesAndText } from "./pollOptionSorting";

const formatPollExpiry = (expiresAt, isClosed) => {
  if (isClosed) return "Đã kết thúc";
  if (!expiresAt) return "Không thời hạn";

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "Không thời hạn";

  return `Kết thúc ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")} ${date.getDate()} Tháng ${
    date.getMonth() + 1
  }, ${date.getFullYear()}`;
};

const getSelectedOptionIds = (poll) => {
  if (Array.isArray(poll?.currentUserOptionIds)) {
    return poll.currentUserOptionIds.map(String);
  }

  return (poll?.options || [])
    .filter((option) => option.isSelectedByCurrentUser)
    .map((option) => String(option.id));
};

const getTotalVotes = (poll) => {
  if (typeof poll?.totalVotes === "number") return poll.totalVotes;
  return (poll?.options || []).reduce(
    (sum, option) => sum + (Number(option.voteCount) || 0),
    0,
  );
};

const formatPollDetailDate = (dateValue) => {
  if (!dateValue) return "Không rõ";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Không rõ";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getOptionVoteCount = (option) => {
  if (typeof option?.voteCount === "number") return option.voteCount;
  return Array.isArray(option?.voters) ? option.voters.length : 0;
};

const getTotalVoters = (poll) => {
  if (typeof poll?.totalVoters === "number") return poll.totalVoters;

  const voterIds = new Set();
  (poll?.options || []).forEach((option) => {
    (option.voters || []).forEach((voter) => {
      const voterId = voter?.id || voter?._id || voter?.fullName;
      if (voterId) voterIds.add(String(voterId));
    });
  });

  return voterIds.size;
};

const getOptionId = (option) => String(option?.id || option?._id || "");

const getVoterId = (voter) => String(voter?.id || voter?._id || "");

const normalizeOptionIds = (optionIds = []) =>
  [...new Set(optionIds.map(String).filter(Boolean))].sort();

const getSelectionKey = (optionIds = []) =>
  normalizeOptionIds(optionIds).join("|");

const parseSelectionKey = (selectionKey) =>
  selectionKey ? selectionKey.split("|").filter(Boolean) : [];

const getUserInitial = (name = "") => {
  const trimmedName = name.trim();
  return (trimmedName || "N").charAt(0).toUpperCase();
};

const getDefaultPollOptionId = (options = []) => {
  const firstOption =
    options.find((option) => getOptionVoteCount(option) > 0) || options[0];
  return firstOption ? String(firstOption.id) : "";
};

const PollVoterAvatar = ({ voter }) => {
  const avatarUrl = getAvatarUrl(voter?.avatar);
  const name = voter?.fullName || "Người dùng";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="poll-detail-voter-avatar"
        loading="lazy"
      />
    );
  }

  return (
    <span className="poll-detail-voter-avatar poll-detail-voter-avatar-fallback">
      {getUserInitial(name)}
    </span>
  );
};

const PollOptionAvatarStack = ({ voters = [], voteCount = 0 }) => {
  if (!voteCount || voters.length === 0) return null;

  const visibleVoters = voters.slice(0, 2);
  const hiddenCount = Math.max(0, voters.length - visibleVoters.length);

  return (
    <span className="poll-detail-option-avatar-stack" aria-hidden="true">
      {visibleVoters.map((voter) => {
        const avatarUrl = getAvatarUrl(voter?.avatar);
        const name = voter?.fullName || "Người dùng";

        if (avatarUrl) {
          return (
            <img
              key={voter?.id || voter?._id || name}
              src={avatarUrl}
              alt=""
              loading="lazy"
            />
          );
        }

        return (
          <span key={voter?.id || voter?._id || name}>
            {getUserInitial(name)}
          </span>
        );
      })}
      {hiddenCount > 0 && (
        <span className="poll-detail-option-overflow">+{hiddenCount}</span>
      )}
    </span>
  );
};

const getVoterKey = (voter, index) =>
  voter?.id || voter?._id || voter?.fullName || `voter-${index}`;

export const PollDetailModal = ({
  message,
  poll,
  onClose,
  onVote,
  onAddOption,
}) => {
  const { user } = useAuth();
  const options = useMemo(
    () =>
      sortPollOptionsByVotesAndText(poll?.options || [], {
        getVoteCount: (option) =>
          poll?.resultsVisible ? getOptionVoteCount(option) : 0,
      }),
    [poll],
  );
  const currentUser = useMemo(() => {
    const userId = user?._id || user?.id;
    if (!userId) return null;

    return {
      ...user,
      _id: user._id || userId,
      id: user.id || userId,
      fullName: user.fullName || "Bạn",
    };
  }, [user]);
  const currentSelectionKey = useMemo(
    () => getSelectionKey(getSelectedOptionIds(poll)),
    [poll],
  );
  const currentOptionIds = useMemo(
    () => parseSelectionKey(currentSelectionKey),
    [currentSelectionKey],
  );
  const currentOptionSet = useMemo(
    () => new Set(currentOptionIds),
    [currentOptionIds],
  );
  const [activeOptionId, setActiveOptionId] = useState(() =>
    getDefaultPollOptionId(options),
  );
  const [draftOptionIds, setDraftOptionIds] = useState(() =>
    currentOptionIds,
  );
  const [viewMode, setViewMode] = useState("vote");
  const [visibleVoterCount, setVisibleVoterCount] = useState(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isAddOptionOpen, setIsAddOptionOpen] = useState(false);
  const [newOptionText, setNewOptionText] = useState("");
  const [isAddingOption, setIsAddingOption] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setDraftOptionIds(parseSelectionKey(currentSelectionKey));
  }, [currentSelectionKey]);

  useEffect(() => {
    if (activeOptionId || !options.length) return;
    setActiveOptionId(getDefaultPollOptionId(options));
  }, [activeOptionId, options]);

  if (!poll || typeof document === "undefined") return null;

  const creatorName = message?.sender?.fullName || "Người dùng";
  const pollTypeLabel = poll.settings?.multiple
    ? "Chọn nhiều phương án"
    : "Chọn một phương án";
  const emptyVoterText = !poll.resultsVisible
    ? "Kết quả sẽ hiển thị sau khi bạn bình chọn."
    : poll.settings?.hideVoters
      ? "Người tạo bình chọn đã ẩn danh sách người bình chọn."
      : "Chưa có ai chọn phương án này.";
  const totalVotes = getTotalVotes(poll);
  const totalVoters = getTotalVoters(poll);
  const draftSelectionKey = getSelectionKey(draftOptionIds);
  const selectedDraftOptionSet = new Set(draftOptionIds);
  const currentUserId = getVoterId(currentUser);
  const hasSelectionChanged = draftSelectionKey !== currentSelectionKey;
  const isMultiple = Boolean(poll.settings?.multiple);
  const canVote = !poll.isClosed && Boolean(onVote);
  const canAddOption =
    !poll.isClosed && Boolean(poll.settings?.allowOptions) && Boolean(onAddOption);
  const canInspectVoters = poll.resultsVisible && !poll.settings?.hideVoters;
  const displayTotalVotes = Math.max(
    0,
    totalVotes + draftOptionIds.length - currentOptionIds.length,
  );
  const displayTotalVoters = Math.max(
    0,
    totalVoters +
      (currentOptionIds.length === 0 && draftOptionIds.length > 0 ? 1 : 0) -
      (currentOptionIds.length > 0 && draftOptionIds.length === 0 ? 1 : 0),
  );
  const summaryText = poll.resultsVisible
    ? `${displayTotalVoters} người bình chọn, ${displayTotalVotes} lượt bình chọn`
    : "Kết quả sẽ hiển thị sau khi bạn bình chọn";
  const footerConfirmDisabled =
    !canVote || !hasSelectionChanged || isSubmitting;
  const getDisplayedOptionVoteCount = (option) => {
    const optionId = getOptionId(option);
    const voteCount = getOptionVoteCount(option);
    const wasSelected = currentOptionSet.has(optionId);
    const isSelected = selectedDraftOptionSet.has(optionId);

    if (wasSelected === isSelected) return voteCount;

    return Math.max(0, voteCount + (isSelected ? 1 : -1));
  };

  const getDisplayedOptionVoters = (option) => {
    const optionId = getOptionId(option);
    const voters = option?.voters || [];
    const wasSelected = currentOptionSet.has(optionId);
    const isSelected = selectedDraftOptionSet.has(optionId);

    if (wasSelected === isSelected || !currentUserId) return voters;

    if (isSelected) {
      const hasCurrentUser = voters.some(
        (voter) => getVoterId(voter) === currentUserId,
      );
      return hasCurrentUser || !currentUser ? voters : [...voters, currentUser];
    }

    return voters.filter((voter) => getVoterId(voter) !== currentUserId);
  };
  const displayOptions = sortPollOptionsByVotesAndText(options, {
    getVoteCount: getDisplayedOptionVoteCount,
  });
  const activeOption =
    displayOptions.find((option) => getOptionId(option) === activeOptionId) ||
    displayOptions.find((option) => getDisplayedOptionVoteCount(option) > 0) ||
    displayOptions[0];

  const handleToggleDraftOption = (optionId) => {
    if (!canVote || isSubmitting) return;

    const optionIdText = String(optionId);
    setError("");
    setDraftOptionIds((currentIds) => {
      const isSelected = currentIds.includes(optionIdText);

      if (isMultiple) {
        return isSelected
          ? currentIds.filter((id) => id !== optionIdText)
          : [...currentIds, optionIdText];
      }

      return isSelected ? [] : [optionIdText];
    });
  };

  const handleOpenVoters = (optionId) => {
    setActiveOptionId(String(optionId));
    setViewMode("voters");
    setVisibleVoterCount(6);
  };

  const handleConfirm = async () => {
    if (footerConfirmDisabled) return;

    setIsSubmitting(true);
    setError("");

    try {
      await onVote(message, draftOptionIds);
      onClose?.();
    } catch {
      setError("Không thể cập nhật bình chọn.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddOption = async () => {
    const text = newOptionText.trim();
    if (!text || !canAddOption || isAddingOption) return;

    setIsAddingOption(true);
    setError("");

    try {
      await onAddOption(message, text);
      setNewOptionText("");
      setIsAddOptionOpen(false);
    } catch {
      setError("Không thể thêm phương án.");
    } finally {
      setIsAddingOption(false);
    }
  };

  const renderVoteView = () => (
    <>
      <div className="poll-detail-question-block">
        <h3>{poll.question || message?.content}</h3>
        <p>
          Tạo bởi <strong>{creatorName}</strong> -{" "}
          {formatPollDetailDate(message?.createdAt)}
        </p>
      </div>

      <div className="poll-detail-type-row">
        <span className="material-symbols-outlined" aria-hidden="true">
          {isMultiple ? "checklist" : "radio_button_checked"}
        </span>
        <span>{pollTypeLabel}</span>
      </div>

      <button
        type="button"
        className="poll-detail-total-row"
        onClick={() => {
          const targetOption =
            activeOption ||
            displayOptions.find(
              (option) => getDisplayedOptionVoteCount(option) > 0,
            );
          if (targetOption) handleOpenVoters(getOptionId(targetOption));
        }}
        disabled={!canInspectVoters || displayTotalVotes === 0}
      >
        <span>{summaryText}</span>
        {canInspectVoters && displayTotalVotes > 0 && (
          <span className="material-symbols-outlined" aria-hidden="true">
            chevron_right
          </span>
        )}
      </button>

      <div className="poll-detail-vote-options" aria-label="Các phương án">
        {displayOptions.map((option) => {
          const optionId = getOptionId(option);
          const isSelected = selectedDraftOptionSet.has(optionId);
          const voteCount = getDisplayedOptionVoteCount(option);
          const optionVoters = getDisplayedOptionVoters(option);

          return (
            <div
              className={`poll-detail-vote-option ${
                isSelected ? "is-selected" : ""
              }`}
              key={optionId}
            >
              <button
                type="button"
                className="poll-detail-option-select"
                onClick={() => handleToggleDraftOption(optionId)}
                disabled={!canVote || isSubmitting}
              >
                <span className="poll-detail-option-check">
                  <span className="material-symbols-outlined">
                    {isMultiple
                      ? isSelected
                        ? "check_circle"
                        : "radio_button_unchecked"
                      : isSelected
                        ? "radio_button_checked"
                        : "radio_button_unchecked"}
                  </span>
                </span>
                <span className="poll-detail-option-label">{option.text}</span>
              </button>
              {canInspectVoters && optionVoters.length > 0 && (
                <button
                  type="button"
                  className="poll-detail-option-voters-button"
                  onClick={() => handleOpenVoters(optionId)}
                  title={`Xem người đã chọn ${option.text}`}
                  aria-label={`Xem người đã chọn ${option.text}`}
                >
                  <PollOptionAvatarStack
                    voters={optionVoters}
                    voteCount={voteCount}
                  />
                </button>
              )}
              <span className="poll-detail-option-count">{voteCount}</span>
            </div>
          );
        })}
      </div>

      {canAddOption && (
        <div className="poll-detail-add-option">
          {isAddOptionOpen ? (
            <div className="poll-detail-add-option-form">
              <input
                type="text"
                value={newOptionText}
                onChange={(event) => setNewOptionText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddOption();
                  }
                }}
                placeholder="Nhập lựa chọn"
                maxLength={100}
                disabled={isAddingOption}
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddOption}
                disabled={!newOptionText.trim() || isAddingOption}
                aria-label="Thêm lựa chọn"
              >
                <span className="material-symbols-outlined">
                  {isAddingOption ? "progress_activity" : "check"}
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="poll-detail-add-option-trigger"
              onClick={() => setIsAddOptionOpen(true)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                add
              </span>
              Thêm lựa chọn
            </button>
          )}
        </div>
      )}
    </>
  );

  const renderVoterView = () => {
    return (
      <section className="poll-detail-voter-view">
        <h3>Chi tiết lựa chọn</h3>
        <p className="poll-detail-voter-summary">{summaryText}</p>
        <div className="poll-detail-voter-options">
          {displayOptions.map((option) => {
            const optionId = getOptionId(option);
            const optionVoters = getDisplayedOptionVoters(option);
            const visibleVoters = optionVoters.slice(0, visibleVoterCount);
            const voteCount = getDisplayedOptionVoteCount(option);
            const canShowOptionVoters =
              canInspectVoters && optionVoters.length > 0;

            return (
              <section className="poll-detail-voter-option" key={optionId}>
                <div className="poll-detail-voter-option-title">
                  <span>{option.text || "Phương án"}</span>
                  <strong>{voteCount}</strong>
                </div>
                {canShowOptionVoters ? (
                  <>
                    <div className="poll-detail-voter-grid">
                      {visibleVoters.map((voter, index) => (
                        <div
                          className="poll-detail-voter"
                          key={getVoterKey(voter, index)}
                        >
                          <PollVoterAvatar voter={voter} />
                          <span>{voter.fullName || "Người dùng"}</span>
                        </div>
                      ))}
                    </div>
                    {visibleVoterCount < optionVoters.length && (
                      <button
                        type="button"
                        className="poll-detail-show-more"
                        onClick={() => setVisibleVoterCount((count) => count + 8)}
                      >
                        Xem thêm
                      </button>
                    )}
                  </>
                ) : (
                  <p className="poll-detail-empty">{emptyVoterText}</p>
                )}
              </section>
            );
          })}
        </div>
      </section>
    );
  };

  return createPortal(
    <div
      className="poll-detail-backdrop"
      role="presentation"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className="poll-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="poll-detail-title"
      >
        <header className="poll-detail-header">
          {viewMode === "voters" ? (
            <button
              type="button"
              className="poll-detail-icon-button"
              onClick={() => setViewMode("vote")}
              aria-label="Quay lại bình chọn"
              title="Quay lại"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          <h2 id="poll-detail-title">
            {viewMode === "voters" ? "Chi tiết bình chọn" : "Bình chọn"}
          </h2>
          <button
            type="button"
            className="poll-detail-icon-button"
            onClick={onClose}
            aria-label="Đóng chi tiết bình chọn"
            title="Đóng"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="poll-detail-body">
          {viewMode === "voters" ? renderVoterView() : renderVoteView()}
          {error && (
            <p className="poll-detail-error" role="status">
              {error}
            </p>
          )}
        </div>

        <footer className="poll-detail-footer">
          <span
            className="poll-detail-footer-icon material-symbols-outlined"
            aria-hidden="true"
          >
            settings
          </span>
          <button
            type="button"
            className="poll-detail-cancel"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="poll-detail-confirm"
            onClick={handleConfirm}
            disabled={footerConfirmDisabled}
          >
            {isSubmitting ? "Đang lưu..." : "Xác nhận"}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};

const PollMessage = ({ message, isMine, onVote, onAddOption }) => {
  const poll = message?.poll;
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const selectedOptionIds = useMemo(() => getSelectedOptionIds(poll), [poll]);
  const selectedOptionSet = useMemo(
    () => new Set(selectedOptionIds),
    [selectedOptionIds],
  );
  const totalVotes = getTotalVotes(poll);
  const isMultiple = Boolean(poll?.settings?.multiple);
  const expiresLabel = formatPollExpiry(poll?.expiresAt, poll?.isClosed);
  const previewOptions = useMemo(
    () =>
      sortPollOptionsByVotesAndText(poll?.options || [], {
        getVoteCount: (option) =>
          poll?.resultsVisible ? getOptionVoteCount(option) : 0,
      }),
    [poll],
  );

  if (!poll) return null;

  const handleCardKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (
      event.target.closest?.(
        "button, input, textarea, select, a, [data-poll-interactive]",
      )
    ) {
      return;
    }

    event.preventDefault();
    setIsDetailOpen(true);
  };

  return (
    <div
      className={`chat-poll-card ${isMine ? "chat-poll-card-mine" : ""}`}
      onClick={() => setIsDetailOpen(true)}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      title="Xem chi tiết bình chọn"
    >
      <div className="chat-poll-header">
        <span className="chat-poll-icon" aria-hidden="true">
          <span className="material-symbols-outlined">bar_chart</span>
        </span>
        <span className="min-w-0">
          <span className="chat-poll-eyebrow">Bình chọn</span>
          <strong>{poll.question || message.content}</strong>
        </span>
      </div>

      <div className="chat-poll-options">
        {previewOptions.map((option) => {
          const optionId = getOptionId(option);
          const isSelected = selectedOptionSet.has(optionId);
          const voteCount = Number(option.voteCount) || 0;
          const percent =
            poll.resultsVisible && totalVotes > 0
              ? Math.round((voteCount / totalVotes) * 100)
              : 0;
          const voterNames = (option.voters || [])
            .map((voter) => voter.fullName)
            .filter(Boolean);

          return (
            <div
              key={optionId}
              className={`chat-poll-option chat-poll-option-preview ${
                isSelected ? "is-selected" : ""
              }`}
              style={{ "--poll-option-percent": `${percent}%` }}
            >
              <span className="chat-poll-option-fill" aria-hidden="true" />
              <span className="chat-poll-option-content">
                <span className="chat-poll-option-choice">
                  <span className="material-symbols-outlined">
                    {isMultiple
                      ? isSelected
                        ? "check_box"
                        : "check_box_outline_blank"
                      : isSelected
                        ? "radio_button_checked"
                        : "radio_button_unchecked"}
                  </span>
                </span>
                <span className="chat-poll-option-text">
                  <span>{option.text}</span>
                  {poll.resultsVisible && voterNames.length > 0 && (
                    <small>
                      {voterNames.slice(0, 3).join(", ")}
                      {voterNames.length > 3
                        ? ` +${voterNames.length - 3}`
                        : ""}
                    </small>
                  )}
                </span>
                {poll.resultsVisible && (
                  <span className="chat-poll-option-result">
                    <strong>{percent}%</strong>
                    <small>{voteCount} lượt</small>
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {!poll.resultsVisible && (
        <p className="chat-poll-hidden-note">
          Kết quả sẽ hiển thị sau khi bạn bình chọn.
        </p>
      )}

      <div className="chat-poll-footer">
        <span>{expiresLabel}</span>
        <span>
          {poll.resultsVisible
            ? `${poll.totalVoters || 0} người tham gia`
            : "Chưa hiển thị kết quả"}
        </span>
      </div>

      {isDetailOpen && (
        <PollDetailModal
          message={message}
          poll={poll}
          onVote={onVote}
          onAddOption={onAddOption}
          onClose={() => setIsDetailOpen(false)}
        />
      )}
    </div>
  );
};

export default PollMessage;
