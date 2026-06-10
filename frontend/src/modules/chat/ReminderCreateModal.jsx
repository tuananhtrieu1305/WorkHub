import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAX_REMINDER_LENGTH = 500;
const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const recurrenceOptions = [
  { value: "none", label: "Không lặp lại" },
  { value: "daily", label: "Hàng ngày" },
  { value: "weekly", label: "Hàng tuần" },
  { value: "monthly", label: "Hàng tháng" },
];

const pad = (value) => String(value).padStart(2, "0");

const cloneDate = (date) => new Date(date.getTime());

const toDateInputValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toDisplayDateValue = (date) =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

const toTimeInputValue = (date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const addMinutes = (date, minutes) => {
  const next = cloneDate(date);
  next.setMinutes(next.getMinutes() + minutes);
  next.setSeconds(0, 0);
  return next;
};

const getMinimumDateTime = (referenceDate = new Date()) => {
  const minimumDate = cloneDate(referenceDate);
  minimumDate.setSeconds(0, 0);
  if (
    referenceDate.getSeconds() > 0 ||
    referenceDate.getMilliseconds() > 0
  ) {
    minimumDate.setMinutes(minimumDate.getMinutes() + 1);
  }
  return minimumDate;
};

const roundUpToFiveMinutes = (date) => {
  const next = cloneDate(date);
  const remainder = next.getMinutes() % 5;
  if (remainder > 0) {
    next.setMinutes(next.getMinutes() + (5 - remainder));
  }
  next.setSeconds(0, 0);
  return next;
};

const isSameCalendarDate = (date, otherDate) =>
  date.getFullYear() === otherDate.getFullYear() &&
  date.getMonth() === otherDate.getMonth() &&
  date.getDate() === otherDate.getDate();

const startOfCalendarDate = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const buildCalendarDays = (monthDate) => {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = cloneDate(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = cloneDate(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};

const parseDateText = (value) => {
  const rawValue = String(value || "").trim();
  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const displayMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  if (displayMatch) {
    const [, day, month, year] = displayMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return null;
};

const parseTimeText = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
};

const combineDateAndTime = (dateValue, timeValue) => {
  const date = parseDateText(dateValue);
  const time = parseTimeText(timeValue);
  if (!date || !time || Number.isNaN(date.getTime())) return null;

  date.setHours(time.hours, time.minutes, 0, 0);
  return date;
};

const isSelectableDateTime = (date) =>
  date instanceof Date &&
  !Number.isNaN(date.getTime()) &&
  date.getTime() >= getMinimumDateTime().getTime();

const formatReminderScheduleLabel = (date) => {
  if (!date) return "Chọn ngày nhắc hẹn";

  const now = new Date();
  const time = toTimeInputValue(date);
  if (isSameCalendarDate(date, now)) {
    return `Hôm nay lúc ${time}`;
  }

  const tomorrow = addMinutes(startOfCalendarDate(now), 24 * 60);
  if (isSameCalendarDate(date, tomorrow)) {
    return `Ngày mai lúc ${time}`;
  }

  return `${toDisplayDateValue(date)} lúc ${time}`;
};

const getTomorrowAtNine = () => {
  const tomorrow = startOfCalendarDate(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
};

const toValidDate = (dateValue) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getInitialReminderTime = (initialReminder) => {
  const existingDate = toValidDate(
    initialReminder?.scheduledAt || initialReminder?.nextTriggerAt,
  );

  if (existingDate && isSelectableDateTime(existingDate)) {
    return existingDate;
  }

  return addMinutes(new Date(), 15);
};

const ReminderCreateModal = ({
  isOpen,
  onClose,
  onCreateReminder,
  initialReminder = null,
  mode = "create",
  disabled = false,
}) => {
  const defaultReminderTime = useMemo(
    () => getInitialReminderTime(initialReminder),
    [initialReminder],
  );
  const [title, setTitle] = useState(initialReminder?.title || "");
  const [scheduledAt, setScheduledAt] = useState(defaultReminderTime);
  const [recurrence, setRecurrence] = useState(
    initialReminder?.recurrence || "none",
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(defaultReminderTime.getFullYear(), defaultReminderTime.getMonth(), 1),
  );
  const [draftDate, setDraftDate] = useState(toDisplayDateValue(defaultReminderTime));
  const [draftTime, setDraftTime] = useState(toTimeInputValue(defaultReminderTime));
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const datePickerRef = useRef(null);

  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth),
    [calendarMonth],
  );
  const selectedDraftDate = parseDateText(draftDate);
  const minimumDateTime = getMinimumDateTime();
  const minimumCalendarDate = startOfCalendarDate(minimumDateTime);
  const draftDateTime = combineDateAndTime(draftDate, draftTime);
  const hasValidSchedule = isSelectableDateTime(draftDateTime);
  const canSubmit =
    title.trim().length > 0 &&
    scheduledAt &&
    scheduledAt.getTime() >= getMinimumDateTime().getTime() &&
    !disabled &&
    !isSubmitting;

  const timeSuggestions = useMemo(() => {
    const selectedDate = parseDateText(draftDate) || minimumDateTime;
    const dayStart = startOfCalendarDate(selectedDate);
    let cursor = cloneDate(dayStart);
    const isToday = isSameCalendarDate(selectedDate, minimumDateTime);
    if (isToday) {
      cursor = roundUpToFiveMinutes(minimumDateTime);
    }

    const suggestions = [];
    while (isSameCalendarDate(cursor, selectedDate)) {
      suggestions.push(toTimeInputValue(cursor));
      cursor = addMinutes(cursor, 5);
    }
    return suggestions;
  }, [draftDate, minimumDateTime]);

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
      if (datePickerRef.current?.contains(event.target)) return;
      setIsDatePickerOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isDatePickerOpen, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const nextDefault = getInitialReminderTime(initialReminder);
    setTitle(initialReminder?.title || "");
    setScheduledAt(nextDefault);
    setRecurrence(initialReminder?.recurrence || "none");
    setIsDatePickerOpen(false);
    setCalendarMonth(new Date(nextDefault.getFullYear(), nextDefault.getMonth(), 1));
    setDraftDate(toDisplayDateValue(nextDefault));
    setDraftTime(toTimeInputValue(nextDefault));
    setFormError("");
    setIsSubmitting(false);
  }, [initialReminder, isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const syncDraftFromDate = (date) => {
    const safeDate =
      date.getTime() < getMinimumDateTime().getTime()
        ? getMinimumDateTime()
        : date;
    setDraftDate(toDisplayDateValue(safeDate));
    setDraftTime(toTimeInputValue(safeDate));
    setCalendarMonth(new Date(safeDate.getFullYear(), safeDate.getMonth(), 1));
  };

  const applyPreset = (date) => {
    setScheduledAt(date);
    syncDraftFromDate(date);
    setFormError("");
    setIsDatePickerOpen(false);
  };

  const openCustomPicker = () => {
    syncDraftFromDate(scheduledAt || getMinimumDateTime());
    setIsDatePickerOpen(true);
    setFormError("");
  };

  const handleSelectCalendarDate = (date) => {
    const nextDate = cloneDate(date);
    const currentTime = parseTimeText(draftTime) || {
      hours: minimumDateTime.getHours(),
      minutes: minimumDateTime.getMinutes(),
    };
    nextDate.setHours(currentTime.hours, currentTime.minutes, 0, 0);
    if (nextDate.getTime() < minimumDateTime.getTime()) {
      nextDate.setHours(minimumDateTime.getHours(), minimumDateTime.getMinutes(), 0, 0);
    }
    syncDraftFromDate(nextDate);
    setFormError("");
  };

  const confirmSchedule = () => {
    const candidate = combineDateAndTime(draftDate, draftTime);
    if (!isSelectableDateTime(candidate)) {
      setFormError("Vui lòng chọn thời điểm từ hiện tại trở đi.");
      return;
    }

    setScheduledAt(candidate);
    setIsDatePickerOpen(false);
    setFormError("");
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !canSubmit) {
      setFormError("Vui lòng nhập nội dung và thời gian nhắc hẹn hợp lệ.");
      return;
    }

    if (scheduledAt.getTime() < getMinimumDateTime().getTime()) {
      setFormError("Không thể tạo nhắc hẹn trong quá khứ.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      await onCreateReminder?.({
        title: trimmedTitle,
        scheduledAt: scheduledAt.toISOString(),
        recurrence,
      });
      onClose?.();
    } catch (error) {
      console.error("Failed to create reminder:", error);
      setFormError(
        mode === "edit"
          ? "Không thể chỉnh sửa nhắc hẹn."
          : "Không thể tạo nhắc hẹn.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const canGoToPreviousMonth =
    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getTime() >
    new Date(minimumCalendarDate.getFullYear(), minimumCalendarDate.getMonth(), 1).getTime();

  return createPortal(
    <div className="reminder-create-backdrop" role="presentation">
      <section
        className="reminder-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-create-title"
      >
        <header className="reminder-create-header">
          <h2 id="reminder-create-title">
            {mode === "edit" ? "Chỉnh sửa nhắc hẹn" : "Tạo nhắc hẹn"}
          </h2>
          <button
            type="button"
            className="reminder-create-close"
            onClick={onClose}
            aria-label="Đóng"
            title="Đóng"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="reminder-create-body">
          <label className="reminder-create-field">
            <span>Nhập nội dung</span>
            <textarea
              value={title}
              onChange={(event) =>
                setTitle(event.target.value.slice(0, MAX_REMINDER_LENGTH))
              }
              placeholder="Nhập nội dung mới hoặc dán link"
              rows={5}
              autoFocus
            />
          </label>

          <div className="reminder-create-section">
            <span className="reminder-create-section-title">Chọn thời gian</span>
            <div className="reminder-quick-actions">
              <button type="button" onClick={() => applyPreset(addMinutes(new Date(), 15))}>
                15 phút nữa
              </button>
              <button type="button" onClick={() => applyPreset(addMinutes(new Date(), 30))}>
                30 phút nữa
              </button>
              <button type="button" onClick={() => applyPreset(getTomorrowAtNine())}>
                9:00 ngày mai
              </button>
              <button type="button" onClick={openCustomPicker}>
                Khác
              </button>
            </div>
          </div>

          <div className="reminder-create-section" ref={datePickerRef}>
            <span className="reminder-create-section-title">
              Chọn ngày nhắc hẹn
            </span>
            <button
              type="button"
              className={`reminder-date-button ${isDatePickerOpen ? "is-active" : ""}`}
              onClick={() =>
                isDatePickerOpen ? setIsDatePickerOpen(false) : openCustomPicker()
              }
            >
              <span>{formatReminderScheduleLabel(scheduledAt)}</span>
              <span className="material-symbols-outlined">calendar_month</span>
            </button>

            {isDatePickerOpen && (
              <div className="reminder-date-popover">
                <div className="reminder-date-popover-header">
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

                <div className="reminder-calendar-grid reminder-calendar-weekdays">
                  {weekdays.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="reminder-calendar-grid">
                  {calendarDays.map((date) => {
                    const dateValue = toDateInputValue(date);
                    const isCurrentMonth =
                      date.getMonth() === calendarMonth.getMonth();
                    const isSelected =
                      selectedDraftDate &&
                      isSameCalendarDate(date, selectedDraftDate);
                    const isDisabled =
                      startOfCalendarDate(date).getTime() <
                      minimumCalendarDate.getTime();

                    return (
                      <button
                        type="button"
                        key={dateValue}
                        className={`reminder-calendar-day ${
                          isCurrentMonth ? "" : "is-muted"
                        } ${isSelected ? "is-selected" : ""} ${
                          isDisabled ? "is-disabled" : ""
                        }`}
                        disabled={isDisabled}
                        onClick={() => handleSelectCalendarDate(date)}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>

                <div className="reminder-manual-time">
                  <label>
                    <span>Ngày</span>
                    <input
                      type="text"
                      value={draftDate}
                      onChange={(event) => setDraftDate(event.target.value)}
                      onBlur={() => {
                        const parsedDate = parseDateText(draftDate);
                        if (!parsedDate) {
                          setFormError("Ngày nhắc hẹn không hợp lệ.");
                          return;
                        }
                        handleSelectCalendarDate(parsedDate);
                      }}
                      placeholder="dd/mm/yyyy"
                    />
                  </label>
                  <label>
                    <span>Thời gian</span>
                    <input
                      type="text"
                      value={draftTime}
                      onChange={(event) => setDraftTime(event.target.value)}
                      onBlur={() => {
                        if (!parseTimeText(draftTime)) {
                          setFormError("Thời gian nhắc hẹn không hợp lệ.");
                        }
                      }}
                      placeholder="HH:mm"
                    />
                  </label>
                </div>

                <div className="reminder-time-suggestions" aria-label="Gợi ý thời gian">
                  {timeSuggestions.map((time) => (
                    <button
                      type="button"
                      key={time}
                      className={draftTime === time ? "is-selected" : ""}
                      onClick={() => {
                        setDraftTime(time);
                        setFormError("");
                      }}
                    >
                      {time}
                    </button>
                  ))}
                </div>

                <div className="reminder-date-actions">
                  <button type="button" onClick={() => setIsDatePickerOpen(false)}>
                    Hủy
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

          <label className="reminder-create-field reminder-repeat-field">
            <span>Chọn kiểu lặp lại</span>
            <select
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value)}
            >
              {recurrenceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {formError && (
            <p className="reminder-create-error" role="status">
              {formError}
            </p>
          )}
        </div>

        <footer className="reminder-create-footer">
          <button
            type="button"
            className="reminder-create-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Hủy
          </button>
          <button
            type="button"
            className="reminder-create-submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting
              ? mode === "edit"
                ? "Đang lưu..."
                : "Đang tạo..."
              : mode === "edit"
                ? "Lưu thay đổi"
                : "Tạo nhắc hẹn"}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};

export default ReminderCreateModal;
