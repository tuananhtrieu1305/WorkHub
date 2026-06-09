import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getNativeEmoji } from "./emojiText.js";
import "./EmojiPickerButton.css";

let emojiMartLoader;

const loadEmojiMart = () => {
  emojiMartLoader ??= Promise.all([
    import("emoji-mart"),
    import("@emoji-mart/data"),
    import("@emoji-mart/data/i18n/vi.json"),
  ]).then(([emojiMart, emojiData, viMessages]) => ({
    Picker: emojiMart.Picker,
    data: emojiData.default,
    vi: viMessages.default,
  }));

  return emojiMartLoader;
};

const pickerOptions = {
  locale: "vi",
  set: "native",
  theme: "light",
  icons: "outline",
  searchPosition: "sticky",
  navPosition: "top",
  previewPosition: "none",
  skinTonePosition: "search",
  dynamicWidth: true,
  maxFrequentRows: 2,
  emojiButtonRadius: "10px",
  emojiButtonSize: 34,
  emojiSize: 22,
  emojiButtonColors: [
    "rgba(244, 114, 182, 0.18)",
    "rgba(236, 72, 153, 0.2)",
  ],
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const EmojiPickerButton = ({
  align = "right",
  buttonClassName = "",
  className = "",
  label = "Chèn biểu tượng cảm xúc",
  onEmojiSelect,
  placement = "bottom",
  popoverMode = "inline",
  popoverClassName = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverLayout, setPopoverLayout] = useState({
    isSheet: false,
    style: undefined,
  });
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const rootRef = useRef(null);
  const pickerSlotRef = useRef(null);
  const shouldUseFixedPopover = popoverMode === "fixed";

  const updatePopoverLayout = useCallback(() => {
    if (!shouldUseFixedPopover || !buttonRef.current) {
      setPopoverLayout({ isSheet: false, style: undefined });
      return;
    }

    const isSmallViewport = window.matchMedia("(max-width: 1023px)").matches;
    if (isSmallViewport) {
      setPopoverLayout({ isSheet: true, style: undefined });
      return;
    }

    const margin = 12;
    const gap = 10;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(336, window.innerWidth - margin * 2);
    const targetHeight = Math.min(364, window.innerHeight - margin * 2);
    const preferredLeft =
      align === "left" ? buttonRect.left : buttonRect.right - width;
    const left = clamp(
      preferredLeft,
      margin,
      window.innerWidth - width - margin
    );
    const belowTop = buttonRect.bottom + gap;
    const aboveTop = buttonRect.top - targetHeight - gap;
    const top =
      belowTop + targetHeight <= window.innerHeight - margin
        ? belowTop
        : clamp(aboveTop, margin, window.innerHeight - targetHeight - margin);
    const maxHeight = Math.max(240, window.innerHeight - top - margin);

    setPopoverLayout({
      isSheet: false,
      style: {
        left,
        top,
        width,
        maxHeight,
        "--workhub-emoji-popover-max-height": `${maxHeight}px`,
      },
    });
  }, [align, shouldUseFixedPopover]);

  useEffect(() => {
    if (!isOpen || !pickerSlotRef.current) return undefined;

    let picker;
    let isCancelled = false;
    const pickerSlot = pickerSlotRef.current;
    const loadingNode = document.createElement("span");
    loadingNode.className = "workhub-emoji-loading";
    loadingNode.textContent = "Đang tải biểu tượng...";
    pickerSlot.replaceChildren(loadingNode);

    loadEmojiMart()
      .then(({ Picker, data, vi }) => {
        if (isCancelled || !pickerSlot) return;

        picker = new Picker({
          ...pickerOptions,
          data,
          i18n: vi,
          onEmojiSelect: (emoji) => {
            const nativeEmoji = getNativeEmoji(emoji);
            if (!nativeEmoji) return;
            onEmojiSelect?.(nativeEmoji, emoji);
            setIsOpen(false);
            window.requestAnimationFrame(() => buttonRef.current?.focus());
          },
        });

        picker.classList.add("workhub-emoji-picker");
        picker.style.width = "100%";
        picker.style.height = shouldUseFixedPopover
          ? "min(21.75rem, calc(var(--workhub-emoji-popover-max-height, 22.75rem) - 1rem))"
          : "21.75rem";
        pickerSlot.replaceChildren(picker);
      })
      .catch(() => {
        if (!isCancelled && pickerSlot) {
          loadingNode.textContent = "Không tải được biểu tượng";
        }
      });

    return () => {
      isCancelled = true;
      picker?.remove();
      pickerSlot.replaceChildren();
    };
  }, [isOpen, onEmojiSelect, shouldUseFixedPopover]);

  useEffect(() => {
    if (!isOpen || !shouldUseFixedPopover) return undefined;

    const frameId = window.requestAnimationFrame(updatePopoverLayout);
    window.addEventListener("resize", updatePopoverLayout);
    window.addEventListener("scroll", updatePopoverLayout, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePopoverLayout);
      window.removeEventListener("scroll", updatePopoverLayout, true);
    };
  }, [isOpen, shouldUseFixedPopover, updatePopoverLayout]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (
        !rootRef.current?.contains(event.target) &&
        !popoverRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const popover = isOpen ? (
    <span
      ref={popoverRef}
      className={`workhub-emoji-popover ${popoverClassName}`.trim()}
      data-align={align}
      data-placement={placement}
      data-mode={
        shouldUseFixedPopover
          ? popoverLayout.isSheet
            ? "sheet"
            : "fixed"
          : "inline"
      }
      style={popoverLayout.style}
    >
      {popoverLayout.isSheet && (
        <span className="workhub-emoji-sheet-handle" aria-hidden="true" />
      )}
      <span ref={pickerSlotRef} className="workhub-emoji-picker-slot" />
    </span>
  ) : null;

  return (
    <span
      ref={rootRef}
      className={`workhub-emoji-picker-root ${className}`.trim()}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        className={`workhub-emoji-trigger ${buttonClassName}`.trim()}
        data-open={isOpen}
        title={label}
        onClick={() => {
          if (!isOpen && shouldUseFixedPopover) {
            updatePopoverLayout();
          }
          setIsOpen((open) => !open);
        }}
      >
        <span className="material-symbols-outlined">sentiment_satisfied</span>
      </button>

      {shouldUseFixedPopover && typeof document !== "undefined"
        ? createPortal(popover, document.body)
        : popover}
    </span>
  );
};

export default EmojiPickerButton;
