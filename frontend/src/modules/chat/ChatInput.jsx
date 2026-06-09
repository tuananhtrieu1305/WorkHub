import { useEffect, useRef, useState } from "react";
import { EmojiPickerButton } from "../../components/emoji";
import { applyComposerFormat } from "./chatComposerUtils";

const pendingComposerActions = [
  { icon: "emoji_symbols", title: "Chọn nhãn dán" },
  { icon: "gif_box", title: "Chọn file GIF" },
  { icon: "contact_page", title: "Gửi danh thiếp" },
  { icon: "mic", title: "Gửi voice" },
];

const formatToolbarItems = [
  { label: "B", title: "In đậm", action: "bold", className: "font-bold" },
  { label: "I", title: "In nghiêng", action: "italic", className: "italic" },
  { label: "U", title: "Gạch chân", action: "underline", className: "underline" },
  { label: "S", title: "Gạch ngang", action: "strike", className: "line-through" },
  { label: "aA", title: "Đổi kiểu chữ", action: "case", className: "font-semibold" },
  {
    label: "A",
    title: "Màu chữ",
    disabled: true,
    className: "underline decoration-2 underline-offset-4",
  },
  { icon: "ink_eraser", title: "Xóa định dạng", action: "clear" },
  { divider: true },
  { icon: "format_list_bulleted", title: "Danh sách dấu đầu dòng", action: "list" },
  { icon: "format_list_numbered", title: "Danh sách đánh số", action: "orderedList" },
  { icon: "format_indent_increase", title: "Tăng thụt lề", action: "indent" },
  { icon: "format_indent_decrease", title: "Giảm thụt lề", action: "outdent" },
  { icon: "undo", title: "Hoàn tác", disabled: true },
  { icon: "redo", title: "Làm lại", disabled: true },
  { divider: true },
  { icon: "open_in_full", title: "Mở rộng trình soạn thảo", disabled: true },
];

const ChatInput = ({
  onSend,
  onUploadAttachment,
  onTypingChange,
  onCancelDraft,
  initialContent = "",
  mode = "send",
  draftPreview = null,
  placeholder = "Nhập tin nhắn...",
  disabled = false,
}) => {
  const [content, setContent] = useState(initialContent);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [renderedDraftPreview, setRenderedDraftPreview] =
    useState(draftPreview);
  const [isDraftExiting, setIsDraftExiting] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const draftIdentityRef = useRef(
    draftPreview
      ? `${draftPreview.variant}-${draftPreview.id}`
      : `mode-${mode}`
  );

  const focusSelection = (selectionStart, selectionEnd) => {
    queueMicrotask(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const updateContent = (nextContent) => {
    setContent(nextContent);
    onTypingChange?.(Boolean(nextContent.trim()));
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if ((!trimmed && attachments.length === 0) || disabled || isUploading) return;
    onSend?.(trimmed, { attachments });
    setContent("");
    setAttachments([]);
    setAttachmentError("");
    onTypingChange?.(false);
    textareaRef.current?.focus();
  };

  const handleChange = (e) => {
    updateContent(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "x") {
      e.preventDefault();
      setShowFormattingToolbar((value) => !value);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    if (e.key === "Escape" && mode !== "send") {
      onCancelDraft?.();
    }
  };

  const handleFormat = (action) => {
    if (!action) return;

    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? content.length;
    const selectionEnd = textarea?.selectionEnd ?? content.length;
    const result = applyComposerFormat({
      text: content,
      selectionStart,
      selectionEnd,
      action,
    });

    updateContent(result.text);
    focusSelection(result.selectionStart, result.selectionEnd);
  };

  const insertText = (value) => {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? content.length;
    const selectionEnd = textarea?.selectionEnd ?? content.length;
    const nextContent = `${content.slice(0, selectionStart)}${value}${content.slice(selectionEnd)}`;
    const cursor = selectionStart + value.length;

    updateContent(nextContent);
    focusSelection(cursor, cursor);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadAttachment) return;

    setIsUploading(true);
    setAttachmentError("");

    try {
      const attachment = await onUploadAttachment(file);
      setAttachments((prev) => [...prev, attachment]);
    } catch {
      setAttachmentError("Không thể tải file đính kèm.");
    } finally {
      setIsUploading(false);
    }
  };

  const canAttach = Boolean(onUploadAttachment) && mode !== "edit";
  const visibleDraftPreview = renderedDraftPreview;

  useEffect(() => {
    const nextDraftIdentity = draftPreview
      ? `${draftPreview.variant}-${draftPreview.id}`
      : `mode-${mode}`;

    if (draftIdentityRef.current !== nextDraftIdentity) {
      draftIdentityRef.current = nextDraftIdentity;
      setContent(mode === "edit" ? initialContent : "");
      setAttachments([]);
      setAttachmentError("");
      onTypingChange?.(false);
    }
  }, [draftPreview, initialContent, mode, onTypingChange]);

  useEffect(() => {
    if (draftPreview) {
      setRenderedDraftPreview(draftPreview);
      setIsDraftExiting(false);
      return undefined;
    }

    if (!renderedDraftPreview) return undefined;

    setIsDraftExiting(true);
    const timeoutId = window.setTimeout(() => {
      setRenderedDraftPreview(null);
      setIsDraftExiting(false);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [draftPreview, renderedDraftPreview]);

  return (
    <div
      className={`bg-white px-3 pb-3 pt-3 sm:px-6 sm:pb-4 ${
        visibleDraftPreview
          ? "chat-composer-draft-shell"
          : "border-t border-slate-200"
      }`}
    >
      <div className="flex flex-col overflow-visible rounded-2xl border border-slate-300 bg-white shadow-sm transition-all focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20">
        {visibleDraftPreview && (
          <div
            className={`chat-draft-toast-slot ${
              isDraftExiting ? "is-exiting" : "is-entering"
            }`}
          >
            <div className="chat-draft-toast-slot-inner">
              <div className="px-3 pt-3">
                <div
                  key={visibleDraftPreview.id}
                  className={`chat-draft-toast chat-draft-toast-${visibleDraftPreview.variant} ${
                    isDraftExiting ? "is-exiting" : "is-entering"
                  } flex items-center justify-between gap-3 rounded-xl px-3 py-2.5`}
                >
                  <span className="chat-draft-toast-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                    <span className="material-symbols-outlined text-[17px]">
                      {visibleDraftPreview.icon}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold">
                      {visibleDraftPreview.title}
                    </span>
                    <span className="block truncate text-xs font-medium">
                      {visibleDraftPreview.text}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={onCancelDraft}
                    className="chat-draft-toast-close inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
                    title="Hủy"
                    aria-label="Hủy"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      close
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          className={`flex items-center justify-between gap-2 overflow-x-auto bg-slate-50/80 px-3 py-2 ${
            visibleDraftPreview ? "" : "rounded-t-2xl"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading || !canAttach}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
              title="Đính kèm file"
              aria-label="Đính kèm file"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isUploading ? "sync" : "attach_file"}
              </span>
            </button>

            {pendingComposerActions.map((item) => (
              <button
                key={item.title}
                type="button"
                disabled
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300"
                title={`${item.title} (sắp có)`}
                aria-label={item.title}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {item.icon}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowFormattingToolbar((value) => !value)}
            className={`inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold transition-colors ${
              showFormattingToolbar
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            }`}
            title="Định dạng tin nhắn"
            aria-pressed={showFormattingToolbar}
          >
            <span className="material-symbols-outlined text-[20px]">
              format_bold
            </span>
            <span className="hidden sm:inline">Định dạng tin nhắn</span>
          </button>
        </div>

        {(attachments.length > 0 || attachmentError) && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map((attachment, index) => (
              <span
                key={`${attachment.fileUrl}-${index}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                <span className="material-symbols-outlined text-[14px]">
                  attach_file
                </span>
                <span className="max-w-40 truncate">{attachment.fileName}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) =>
                      prev.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  className="text-slate-500 hover:text-red-600"
                  title="Gỡ file đính kèm"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    close
                  </span>
                </button>
              </span>
            ))}
            {attachmentError && (
              <span className="text-xs font-semibold text-red-600">
                {attachmentError}
              </span>
            )}
          </div>
        )}

        <div className="chat-composer-input-shell relative flex items-start">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => onTypingChange?.(false)}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="chat-composer-textarea w-full resize-none overflow-y-auto border-none bg-transparent px-4 py-3.5 pr-12 text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-500 focus:ring-0 disabled:text-slate-400"
          />
          <EmojiPickerButton
            align="right"
            buttonClassName="chat-composer-emoji-button"
            className="absolute right-2 top-2"
            label="Biểu tượng cảm xúc"
            onEmojiSelect={insertText}
            placement="top"
            popoverClassName="chat-composer-emoji-popover"
          />
        </div>

        {showFormattingToolbar && (
          <div className="chat-format-panel border-t border-slate-800 bg-slate-950 px-3 py-3 text-slate-300">
            <p className="mb-3 text-sm font-semibold text-slate-300">
              Nhấn Ctrl + Shift + X để định dạng tin nhắn
            </p>
            <div className="flex flex-wrap items-center gap-1">
              {formatToolbarItems.map((item, index) =>
                item.divider ? (
                  <span
                    key={`format-divider-${index}`}
                    className="mx-1 h-6 w-px bg-slate-600"
                  />
                ) : (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => handleFormat(item.action)}
                    disabled={item.disabled}
                    className="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    title={item.title}
                    aria-label={item.title}
                  >
                    {item.icon ? (
                      <span className="material-symbols-outlined text-[20px]">
                        {item.icon}
                      </span>
                    ) : (
                      <span className={item.className}>{item.label}</span>
                    )}
                  </button>
                )
              )}
            </div>
            {mode !== "send" && (
              <button
                type="button"
                onClick={onCancelDraft}
                className="mt-3 text-sm font-semibold text-slate-400 transition-colors hover:text-white"
              >
                Hủy
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
