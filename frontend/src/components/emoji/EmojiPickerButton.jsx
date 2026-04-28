import { useEffect, useRef, useState } from "react";
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

const EmojiPickerButton = ({
  align = "right",
  buttonClassName = "",
  className = "",
  label = "Chèn biểu tượng cảm xúc",
  onEmojiSelect,
  placement = "bottom",
  popoverClassName = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const rootRef = useRef(null);
  const pickerSlotRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !pickerSlotRef.current) return undefined;

    let picker;
    let isCancelled = false;
    const loadingNode = document.createElement("span");
    loadingNode.className = "workhub-emoji-loading";
    loadingNode.textContent = "Đang tải biểu tượng...";
    pickerSlotRef.current.replaceChildren(loadingNode);

    loadEmojiMart()
      .then(({ Picker, data, vi }) => {
        if (isCancelled || !pickerSlotRef.current) return;

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
        picker.style.height = "21.75rem";
        pickerSlotRef.current.replaceChildren(picker);
      })
      .catch(() => {
        if (!isCancelled && pickerSlotRef.current) {
          loadingNode.textContent = "Không tải được biểu tượng";
        }
      });

    return () => {
      isCancelled = true;
      picker?.remove();
      pickerSlotRef.current?.replaceChildren();
    };
  }, [isOpen, onEmojiSelect]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
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
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="material-symbols-outlined">sentiment_satisfied</span>
      </button>

      {isOpen && (
        <span
          className={`workhub-emoji-popover ${popoverClassName}`.trim()}
          data-align={align}
          data-placement={placement}
        >
          <span ref={pickerSlotRef} className="workhub-emoji-picker-slot" />
        </span>
      )}
    </span>
  );
};

export default EmojiPickerButton;
