import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAX_QUESTION_LENGTH = 200;
const MAX_OPTION_LENGTH = 100;
const MAX_OPTIONS = 20;
const DEFAULT_EXPIRY_TIME = "23:59";
const TIME_INPUT_STEP_SECONDS = 60;
const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const timePresets = ["09:00", "12:00", "17:30", "23:59"];

const helpText = {
  multiple: "Người tham gia có thể chọn nhiều phương án khác nhau",
  allowOptions: "Người tham gia có thể thêm phương án mới",
  hideResultsUntilVoted:
    "Người tham gia chỉ có thể thấy kết quả sau khi bình chọn",
  hideVoters: "Người tham gia không thể thấy người khác bình chọn",
};

const createOption = (index) => ({
  id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
  text: "",
});

const pad = (value) => String(value).padStart(2, "0");

const toDateInputValue = (date) => {
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const toTimeInputValue = (date) => {
  if (!date) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toTimeValue = ({ hours, minutes }) => `${pad(hours)}:${pad(minutes)}`;

const parseTimeValue = (value) => {
  const [hourPart, minutePart] = String(value || DEFAULT_EXPIRY_TIME).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);

  return {
    hours: Number.isInteger(hours) && hours >= 0 && hours <= 23 ? hours : 23,
    minutes:
      Number.isInteger(minutes) && minutes >= 0 && minutes <= 59 ? minutes : 59,
  };
};

const startOfCalendarDate = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getEarliestSelectableDate = (referenceDate = new Date()) => {
  const earliestDate = new Date(referenceDate);
  earliestDate.setSeconds(0, 0);
  earliestDate.setMinutes(earliestDate.getMinutes() + 1);
  return earliestDate;
};

const isSameCalendarDate = (date, otherDate) =>
  date.getFullYear() === otherDate.getFullYear() &&
  date.getMonth() === otherDate.getMonth() &&
  date.getDate() === otherDate.getDate();

const isBeforeCalendarDate = (date, minDate) =>
  startOfCalendarDate(date).getTime() <
  startOfCalendarDate(minDate).getTime();

const getMinimumTimeForDate = (dateValue, referenceDate = new Date()) => {
  if (!dateValue) return "00:00";

  const selectedDate = new Date(`${dateValue}T00:00`);
  if (Number.isNaN(selectedDate.getTime())) return "00:00";

  const earliestDate = getEarliestSelectableDate(referenceDate);
  return isSameCalendarDate(selectedDate, earliestDate)
    ? toTimeInputValue(earliestDate)
    : "00:00";
};

const normalizeTimeForDate = (
  dateValue,
  timeValue,
  referenceDate = new Date(),
) => {
  const nextTime = toTimeValue(parseTimeValue(timeValue));
  const minimumTime = getMinimumTimeForDate(dateValue, referenceDate);
  return nextTime < minimumTime ? minimumTime : nextTime;
};

const isFutureSchedule = (
  dateValue,
  timeValue,
  referenceDate = new Date(),
) => {
  if (!dateValue || !timeValue) return false;

  const candidate = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(candidate.getTime())) return false;

  return candidate.getTime() >= getEarliestSelectableDate(referenceDate).getTime();
};

const getDefaultScheduleDraft = (expiresAt) => {
  const now = new Date();
  if (expiresAt && expiresAt.getTime() > now.getTime()) return expiresAt;

  const earliestDate = getEarliestSelectableDate(now);
  const dateValue = toDateInputValue(earliestDate);
  const timeValue = normalizeTimeForDate(dateValue, DEFAULT_EXPIRY_TIME, now);
  return new Date(`${dateValue}T${timeValue}`);
};

const formatExpiryLabel = (date) => {
  if (!date) return "Không thời hạn";

  return `${toTimeInputValue(date)} ${date.getDate()} Tháng ${
    date.getMonth() + 1
  }, ${date.getFullYear()}`;
};

const buildCalendarDays = (monthDate) => {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};

const PollHelp = ({ tooltip }) => (
  <span className="poll-help" data-tooltip={tooltip} tabIndex={0}>
    ?
  </span>
);

const ToggleRow = ({ label, checked, onChange, tooltip }) => (
  <div className="poll-create-toggle-row">
    <span className="poll-create-toggle-label">
      {label}
      {tooltip && <PollHelp tooltip={tooltip} />}
    </span>
    <button
      type="button"
      className={`poll-toggle ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      aria-label={label}
    >
      <span />
    </button>
  </div>
);

const PollCreateModal = ({ isOpen, onClose, onCreatePoll, disabled = false }) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState([createOption(1), createOption(2)]);
  const [expiresAt, setExpiresAt] = useState(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [draftDate, setDraftDate] = useState(() => toDateInputValue(new Date()));
  const [draftTime, setDraftTime] = useState("");
  const [pinOnCreate, setPinOnCreate] = useState(false);
  const [multiple, setMultiple] = useState(true);
  const [allowOptions, setAllowOptions] = useState(true);
  const [hideResultsUntilVoted, setHideResultsUntilVoted] = useState(false);
  const [hideVoters, setHideVoters] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dateFieldRef = useRef(null);

  const trimmedOptions = useMemo(
    () => options.map((option) => option.text.trim()).filter(Boolean),
    [options],
  );
  const duplicateOption = useMemo(() => {
    const keys = new Set();
    return trimmedOptions.some((option) => {
      const key = option.toLowerCase();
      if (keys.has(key)) return true;
      keys.add(key);
      return false;
    });
  }, [trimmedOptions]);
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth),
    [calendarMonth],
  );
  const selectedDraftDate = draftDate ? new Date(`${draftDate}T00:00`) : null;
  const hasValidSchedule = useMemo(() => {
    return isFutureSchedule(draftDate, draftTime);
  }, [draftDate, draftTime]);
  const canSubmit =
    question.trim().length > 0 &&
    trimmedOptions.length >= 2 &&
    !duplicateOption &&
    !disabled &&
    !isSubmitting;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !isDatePickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (dateFieldRef.current?.contains(event.target)) return;
      setIsDatePickerOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, isDatePickerOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setQuestion("");
    setOptions([createOption(1), createOption(2)]);
    setExpiresAt(null);
    setIsDatePickerOpen(false);
    setCalendarMonth(new Date());
    setDraftDate(toDateInputValue(new Date()));
    setDraftTime("");
    setPinOnCreate(false);
    setMultiple(true);
    setAllowOptions(true);
    setHideResultsUntilVoted(false);
    setHideVoters(false);
    setFormError("");
    setIsSubmitting(false);
    setIsSettingsOpen(false);
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const updateOptionText = (id, text) => {
    setOptions((current) =>
      current.map((option) =>
        option.id === id
          ? { ...option, text: text.slice(0, MAX_OPTION_LENGTH) }
          : option,
      ),
    );
  };

  const addOptionInput = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((current) => [...current, createOption(current.length + 1)]);
  };

  const removeOptionInput = (id) => {
    if (options.length <= 2) return;
    setOptions((current) => current.filter((option) => option.id !== id));
  };

  const openDatePicker = () => {
    if (isDatePickerOpen) {
      setIsDatePickerOpen(false);
      return;
    }

    const baseDate = getDefaultScheduleDraft(expiresAt);
    setCalendarMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
    setDraftDate(toDateInputValue(baseDate));
    setDraftTime(toTimeInputValue(baseDate));
    setIsDatePickerOpen(true);
    setFormError("");
  };

  const toggleSettingsPanel = () => {
    const nextIsOpen = !isSettingsOpen;
    setIsSettingsOpen(nextIsOpen);
    if (!nextIsOpen) setIsDatePickerOpen(false);
  };

  const updateDraftDate = (dateValue) => {
    setDraftDate(dateValue);
    setDraftTime((currentTime) => normalizeTimeForDate(dateValue, currentTime));
    setFormError("");
  };

  const updateDraftTime = (timeValue) => {
    if (!timeValue) {
      setDraftTime("");
      return;
    }

    setDraftTime(normalizeTimeForDate(draftDate, timeValue));
    setFormError("");
  };

  const confirmSchedule = () => {
    const normalizedTime = normalizeTimeForDate(draftDate, draftTime);

    if (normalizedTime !== draftTime) {
      setDraftTime(normalizedTime);
      setFormError("Vui lòng chọn thời điểm trong tương lai.");
      return;
    }

    if (!isFutureSchedule(draftDate, normalizedTime)) {
      setFormError("Thời hạn bình chọn phải nằm trong tương lai.");
      return;
    }

    setExpiresAt(new Date(`${draftDate}T${normalizedTime}`));
    setIsDatePickerOpen(false);
    setFormError("");
  };

  const clearSchedule = () => {
    setExpiresAt(null);
    setIsDatePickerOpen(false);
    setFormError("");
  };

  const handleSubmit = async () => {
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      setFormError("Thời hạn bình chọn phải nằm trong tương lai.");
      return;
    }

    if (!canSubmit) {
      setFormError(
        duplicateOption
          ? "Các lựa chọn không được trùng nhau."
          : "Vui lòng nhập chủ đề và ít nhất 2 lựa chọn.",
      );
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      await onCreatePoll?.({
        question: question.trim(),
        options: trimmedOptions,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        pinOnCreate,
        settings: {
          multiple,
          allowOptions,
          hideResultsUntilVoted,
          hideVoters,
        },
      });
      onClose?.();
    } catch (error) {
      console.error("Failed to create poll:", error);
      setFormError("Không thể tạo bình chọn.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const earliestSelectableDate = getEarliestSelectableDate();
  const minimumDraftTime = getMinimumTimeForDate(draftDate);
  const selectedDraftTime = draftTime || "";
  const minimumMonth = new Date(
    earliestSelectableDate.getFullYear(),
    earliestSelectableDate.getMonth(),
    1,
  );
  const currentCalendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1,
  );
  const canGoToPreviousMonth =
    currentCalendarMonth.getTime() > minimumMonth.getTime();

  const modal = (
    <div className="poll-create-backdrop" role="presentation">
      <div
        className={`poll-create-modal ${isSettingsOpen ? "is-settings-open" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <header className="poll-create-header">
          <h2>Tạo bình chọn</h2>
          <button
            type="button"
            className="poll-create-close"
            onClick={onClose}
            aria-label="Đóng"
            title="Đóng"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="poll-create-body">
          <section className="poll-create-main">
            <label className="poll-create-field">
              <span>Chủ đề bình chọn</span>
              <textarea
                value={question}
                onChange={(event) =>
                  setQuestion(event.target.value.slice(0, MAX_QUESTION_LENGTH))
                }
                placeholder="Đặt câu hỏi bình chọn"
                rows={4}
              />
              <span className="poll-create-counter">
                {question.length}/{MAX_QUESTION_LENGTH}
              </span>
            </label>

            <div className="poll-create-options">
              <span className="poll-create-section-title">Các lựa chọn</span>
              {options.map((option, index) => (
                <div className="poll-create-option-row" key={option.id}>
                  <input
                    type="text"
                    value={option.text}
                    onChange={(event) =>
                      updateOptionText(option.id, event.target.value)
                    }
                    placeholder={`Lựa chọn ${index + 1}`}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOptionInput(option.id)}
                      title="Xóa lựa chọn"
                      aria-label="Xóa lựa chọn"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="poll-create-add-option"
                onClick={addOptionInput}
                disabled={options.length >= MAX_OPTIONS}
              >
                <span className="material-symbols-outlined">add</span>
                Thêm lựa chọn
              </button>
            </div>
          </section>

          {isSettingsOpen && (
          <aside className="poll-create-settings">
            <div className="poll-create-date-field" ref={dateFieldRef}>
              <span className="poll-create-section-title">
                Thời hạn bình chọn
              </span>
              <button
                type="button"
                className={`poll-create-date-button ${
                  isDatePickerOpen ? "is-active" : ""
                }`}
                onClick={openDatePicker}
              >
                <span>{formatExpiryLabel(expiresAt)}</span>
                <span className="material-symbols-outlined">calendar_month</span>
              </button>

              {isDatePickerOpen && (
                <div className="poll-date-popover">
                  <div className="poll-date-popover-header">
                    <strong>
                      Tháng {calendarMonth.getMonth() + 1},{" "}
                      {calendarMonth.getFullYear()}
                    </strong>
                    <span>
                      <button
                        type="button"
                        disabled={!canGoToPreviousMonth}
                        onClick={() =>
                          setCalendarMonth(
                            new Date(
                              calendarMonth.getFullYear(),
                              calendarMonth.getMonth() - 1,
                              1,
                            ),
                          )
                        }
                        aria-label="Tháng trước"
                      >
                        <span className="material-symbols-outlined">
                          chevron_left
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCalendarMonth(
                            new Date(
                              calendarMonth.getFullYear(),
                              calendarMonth.getMonth() + 1,
                              1,
                            ),
                          )
                        }
                        aria-label="Tháng sau"
                      >
                        <span className="material-symbols-outlined">
                          chevron_right
                        </span>
                      </button>
                    </span>
                  </div>
                  <div className="poll-calendar-grid poll-calendar-weekdays">
                    {weekdays.map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="poll-calendar-grid">
                    {calendarDays.map((date) => {
                      const dateValue = toDateInputValue(date);
                      const isCurrentMonth =
                        date.getMonth() === calendarMonth.getMonth();
                      const isSelected =
                        selectedDraftDate &&
                        isSameCalendarDate(date, selectedDraftDate);
                      const isDisabled = isBeforeCalendarDate(
                        date,
                        earliestSelectableDate,
                      );

                      return (
                        <button
                          type="button"
                          key={dateValue}
                          className={`poll-calendar-day ${
                            isCurrentMonth ? "" : "is-muted"
                          } ${isSelected ? "is-selected" : ""} ${
                            isDisabled ? "is-disabled" : ""
                          }`}
                          disabled={isDisabled}
                          onClick={() => {
                            updateDraftDate(dateValue);
                            setCalendarMonth(
                              new Date(date.getFullYear(), date.getMonth(), 1),
                            );
                          }}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                  <div className="poll-time-picker">
                    <div className="poll-time-picker-label">
                      <span>Thời gian</span>
                      {minimumDraftTime !== "00:00" && (
                        <small>Sớm nhất {minimumDraftTime}</small>
                      )}
                    </div>
                    <div className="poll-time-input-row">
                      <input
                        type="time"
                        className="poll-time-input"
                        value={selectedDraftTime}
                        min={minimumDraftTime}
                        step={TIME_INPUT_STEP_SECONDS}
                        onChange={(event) => updateDraftTime(event.target.value)}
                        onBlur={() =>
                          setDraftTime((currentTime) =>
                            normalizeTimeForDate(draftDate, currentTime),
                          )
                        }
                        aria-label="Chọn giờ kết thúc bình chọn"
                      />
                    </div>
                    <div className="poll-time-presets" aria-label="Mốc giờ nhanh">
                      {timePresets.map((time) => {
                        const isDisabled = !isFutureSchedule(draftDate, time);

                        return (
                          <button
                            type="button"
                            key={time}
                            className={draftTime === time ? "is-selected" : ""}
                            onClick={() => updateDraftTime(time)}
                            disabled={isDisabled}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="poll-date-actions">
                    <button type="button" onClick={clearSchedule}>
                      Xóa thời hạn
                    </button>
                    <button
                      type="button"
                      className="is-primary"
                      onClick={confirmSchedule}
                      disabled={!hasValidSchedule}
                    >
                      Xác nhận
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="poll-create-setting-group">
              <span className="poll-create-section-title">Thiết lập nâng cao</span>
              <ToggleRow
                label="Ghim lên đầu trò chuyện"
                checked={pinOnCreate}
                onChange={setPinOnCreate}
              />
              <ToggleRow
                label="Chọn nhiều phương án"
                checked={multiple}
                onChange={setMultiple}
                tooltip={helpText.multiple}
              />
              <ToggleRow
                label="Có thể thêm phương án"
                checked={allowOptions}
                onChange={setAllowOptions}
                tooltip={helpText.allowOptions}
              />
            </div>

            <div className="poll-create-setting-group">
              <span className="poll-create-section-title">Bình chọn ẩn danh</span>
              <ToggleRow
                label="Ẩn kết quả khi chưa bình chọn"
                checked={hideResultsUntilVoted}
                onChange={setHideResultsUntilVoted}
                tooltip={helpText.hideResultsUntilVoted}
              />
              <ToggleRow
                label="Ẩn người bình chọn"
                checked={hideVoters}
                onChange={setHideVoters}
                tooltip={helpText.hideVoters}
              />
            </div>
          </aside>
          )}
        </div>

        <footer className="poll-create-footer">
          <button
            type="button"
            className={`poll-create-gear ${isSettingsOpen ? "is-active" : ""}`}
            title={isSettingsOpen ? "Đóng thiết lập" : "Mở thiết lập"}
            aria-label={isSettingsOpen ? "Đóng thiết lập" : "Mở thiết lập"}
            aria-pressed={isSettingsOpen}
            onClick={toggleSettingsPanel}
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
          <span className="poll-create-error" role="status">
            {formError}
          </span>
          <button
            type="button"
            className="poll-create-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Hủy
          </button>
          <button
            type="button"
            className="poll-create-submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? "Đang tạo..." : "Tạo bình chọn"}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default PollCreateModal;
