import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  REACTION_OPTIONS,
  getReactionOption,
  getReactionSummaryLabel,
} from "./reactionOptions";
import {
  REACTION_SELECTION_GUARD_MS,
  REACTION_TRAY_CLOSE_DELAY_MS,
  REACTION_TRAY_IDLE_TIMEOUT_MS,
  REACTION_TRAY_OPEN_EVENT,
  shouldAutoCloseReactionTrayAfterIdle,
  shouldCloseReactionTrayForActivePickerChange,
  shouldCloseReactionTrayOnOutsidePointer,
  shouldDelayReactionTrayClose,
  shouldIgnoreTriggerClickAfterTraySelection,
  shouldSuppressTrayOpenAfterSelection,
} from "./reactionHoverBehavior";

const LONG_PRESS_MS = 350;

const ReactionPicker = ({
  reactionType,
  isActive,
  count = 0,
  onSelect,
  variant = "post",
}) => {
  const pickerId = useId();
  const pickerRootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const selectionGuardTimerRef = useRef(null);
  const didLongPressRef = useRef(false);
  const didJustSelectReactionRef = useRef(false);
  const didSelectReactionRef = useRef(false);
  const ignoreNextTriggerClickRef = useRef(false);
  const hoverStateRef = useRef({
    isTriggerHovered: false,
    isTrayHovered: false,
  });
  const selectedReaction = getReactionOption(
    isActive ? reactionType || "like" : "like"
  );

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const closeTray = useCallback(() => {
    hoverStateRef.current = {
      isTriggerHovered: false,
      isTrayHovered: false,
    };
    clearLongPressTimer();
    clearCloseTimer();
    clearIdleTimer();
    isOpenRef.current = false;
    setIsOpen(false);
  }, [clearCloseTimer, clearIdleTimer, clearLongPressTimer]);

  const startIdleAutoClose = useCallback(() => {
    clearIdleTimer();
    didSelectReactionRef.current = false;
    idleTimerRef.current = window.setTimeout(() => {
      if (
        shouldAutoCloseReactionTrayAfterIdle({
          isOpen: isOpenRef.current,
          didSelectReaction: didSelectReactionRef.current,
        })
      ) {
        closeTray();
      }
    }, REACTION_TRAY_IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, closeTray]);

  const announceTrayOpen = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent(REACTION_TRAY_OPEN_EVENT, {
        detail: { pickerId },
      })
    );
  }, [pickerId]);

  const openTray = useCallback((hoverTarget) => {
    if (
      shouldSuppressTrayOpenAfterSelection({
        didJustSelectReaction: didJustSelectReactionRef.current,
      })
    ) {
      return;
    }

    hoverStateRef.current = {
      ...hoverStateRef.current,
      [hoverTarget]: true,
    };
    announceTrayOpen();
    clearCloseTimer();
    isOpenRef.current = true;
    setIsOpen(true);
    startIdleAutoClose();
  }, [announceTrayOpen, clearCloseTimer, startIdleAutoClose]);

  const scheduleTrayClose = useCallback((hoverTarget) => {
    hoverStateRef.current = {
      ...hoverStateRef.current,
      [hoverTarget]: false,
    };

    if (!shouldDelayReactionTrayClose(hoverStateRef.current)) {
      return;
    }

    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      if (shouldDelayReactionTrayClose(hoverStateRef.current)) {
        closeTray();
      }
    }, REACTION_TRAY_CLOSE_DELAY_MS);
  }, [clearCloseTimer, closeTray]);

  const resetPostSelectionGuards = () => {
    didJustSelectReactionRef.current = false;
    ignoreNextTriggerClickRef.current = false;
    if (selectionGuardTimerRef.current) {
      window.clearTimeout(selectionGuardTimerRef.current);
      selectionGuardTimerRef.current = null;
    }
  };

  const startPostSelectionGuard = () => {
    resetPostSelectionGuards();
    didJustSelectReactionRef.current = true;
    ignoreNextTriggerClickRef.current = true;
    selectionGuardTimerRef.current = window.setTimeout(() => {
      resetPostSelectionGuards();
    }, REACTION_SELECTION_GUARD_MS);
  };

  const closeTrayAfterSelection = () => {
    didSelectReactionRef.current = true;
    startPostSelectionGuard();
    closeTray();
  };

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const handleOutsidePointerDown = (event) => {
      const isInsidePicker = !!pickerRootRef.current?.contains(event.target);

      if (
        shouldCloseReactionTrayOnOutsidePointer({
          isOpen: isOpenRef.current,
          isInsidePicker,
        })
      ) {
        closeTray();
      }
    };

    const handleReactionTrayOpen = (event) => {
      const nextPickerId = event.detail?.pickerId;

      if (
        shouldCloseReactionTrayForActivePickerChange({
          currentPickerId: isOpenRef.current ? pickerId : null,
          nextPickerId,
        })
      ) {
        closeTray();
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    window.addEventListener(REACTION_TRAY_OPEN_EVENT, handleReactionTrayOpen);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
      window.removeEventListener(REACTION_TRAY_OPEN_EVENT, handleReactionTrayOpen);
    };
  }, [closeTray, pickerId]);

  useEffect(
    () => () => {
      clearLongPressTimer();
      clearCloseTimer();
      clearIdleTimer();
      if (selectionGuardTimerRef.current) {
        window.clearTimeout(selectionGuardTimerRef.current);
      }
    },
    [clearCloseTimer, clearIdleTimer, clearLongPressTimer]
  );

  const handlePointerDown = () => {
    clearLongPressTimer();
    didLongPressRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true;
      openTray("isTriggerHovered");
    }, LONG_PRESS_MS);
  };

  const handlePointerEnd = () => {
    clearLongPressTimer();
  };

  const handleTriggerClick = (event) => {
    if (
      shouldIgnoreTriggerClickAfterTraySelection({
        didJustSelectReaction: ignoreNextTriggerClickRef.current,
      })
    ) {
      event.preventDefault();
      event.stopPropagation();
      ignoreNextTriggerClickRef.current = false;
      return;
    }

    if (didLongPressRef.current) {
      event.preventDefault();
      didLongPressRef.current = false;
      return;
    }

    onSelect?.(isActive ? selectedReaction.type : "like");
  };

  const handleReactionSelect = (nextReactionType, event) => {
    event?.preventDefault();
    event?.stopPropagation();
    onSelect?.(nextReactionType);
    closeTrayAfterSelection();
  };

  const triggerProps = {
    type: "button",
    onClick: handleTriggerClick,
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerEnd,
    onPointerCancel: handlePointerEnd,
    onPointerLeave: handlePointerEnd,
    onFocus: () => openTray("isTriggerHovered"),
    "aria-haspopup": "menu",
    "aria-expanded": isOpen,
  };

  const renderPostTrigger = () => (
    <button
      {...triggerProps}
      className={`group flex items-center gap-1.5 transition-colors text-sm font-bold ${
        isActive
          ? selectedReaction.textClassName
          : "text-slate-500 hover:text-blue-600"
      }`}
      aria-label={`${getReactionSummaryLabel(selectedReaction.type)} bài viết`}
    >
      <span
        className={`inline-flex size-8 items-center justify-center rounded-full transition-colors ${
          isActive
            ? `${selectedReaction.bgClassName} ${selectedReaction.textClassName}`
            : "text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600"
        }`}
      >
        {isActive ? (
          <span className="workhub-reaction-emoji text-[20px] leading-none">
            {selectedReaction.emoji}
          </span>
        ) : (
          <span className="material-symbols-outlined text-[20px] leading-none">
            thumb_up
          </span>
        )}
      </span>
      <span>{count}</span>
    </button>
  );

  const renderCommentTrigger = () => (
    <button
      {...triggerProps}
      className={`text-xs font-bold transition-colors ${
        isActive
          ? selectedReaction.textClassName
          : "text-slate-500 hover:text-blue-600"
      }`}
      aria-label={`${getReactionSummaryLabel(selectedReaction.type)} bình luận`}
    >
      {isActive ? selectedReaction.label : "Thích"}
    </button>
  );

  return (
    <div
      ref={pickerRootRef}
      className="relative inline-flex"
      onMouseEnter={() => openTray("isTriggerHovered")}
      onMouseLeave={() => {
        clearLongPressTimer();
        scheduleTrayClose("isTriggerHovered");
      }}
    >
      {variant === "comment" ? renderCommentTrigger() : renderPostTrigger()}

      {isOpen && (
        <div
          className={`workhub-reaction-tray absolute bottom-full z-30 mb-2 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2 py-1.5 shadow-xl shadow-slate-900/10 backdrop-blur ${
            variant === "comment" ? "left-0" : "-left-2"
          }`}
          onMouseEnter={() => openTray("isTrayHovered")}
          onMouseLeave={() => scheduleTrayClose("isTrayHovered")}
          role="menu"
          aria-label="Chọn cảm xúc"
        >
          {REACTION_OPTIONS.map((reaction, index) => (
            <button
              key={reaction.type}
              type="button"
              className="workhub-reaction-option group/reaction relative inline-flex size-10 items-center justify-center rounded-full transition-transform hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              style={{ "--reaction-index": index }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => handleReactionSelect(reaction.type, event)}
              title={reaction.label}
              aria-label={reaction.label}
              role="menuitem"
            >
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white opacity-0 shadow-lg shadow-slate-900/20 transition-opacity group-hover/reaction:opacity-100 group-focus-visible/reaction:opacity-100">
                {reaction.label}
              </span>
              <span className="workhub-reaction-emoji text-[24px] leading-none">
                {reaction.emoji}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReactionPicker;
