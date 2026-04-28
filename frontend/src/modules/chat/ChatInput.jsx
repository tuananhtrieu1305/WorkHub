import { useRef, useState } from "react";
import { applyComposerFormat } from "./chatComposerUtils";

const toolbarItems = [
  { icon: "format_bold", title: "In đậm", action: "bold" },
  { icon: "format_italic", title: "In nghiêng", action: "italic" },
  { icon: "strikethrough_s", title: "Gạch ngang", action: "strike" },
  { divider: true },
  { icon: "link", title: "Liên kết", action: "link" },
  { icon: "format_list_bulleted", title: "Danh sách", action: "list" },
  { icon: "code", title: "Code", action: "code" },
];

const quickEmojis = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "✅", "👀"];

const ChatInput = ({
  onSend,
  onUploadAttachment,
  onTypingChange,
  onCancelDraft,
  initialContent = "",
  mode = "send",
  placeholder = "Nhập tin nhắn...",
  disabled = false,
}) => {
  const [content, setContent] = useState(initialContent);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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
    setShowEmojiPicker(false);
    onTypingChange?.(false);
    textareaRef.current?.focus();
  };

  const handleChange = (e) => {
    updateContent(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    if (e.key === "Escape" && mode !== "send") {
      onCancelDraft?.();
    }
  };

  const handleFormat = (action) => {
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

  const handleCancel = () => {
    setContent("");
    setAttachments([]);
    setAttachmentError("");
    setShowEmojiPicker(false);
    onTypingChange?.(false);
    onCancelDraft?.();
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

  const sendLabel = mode === "edit" ? "Lưu" : "Gửi";
  const canSend = Boolean(content.trim()) || attachments.length > 0;

  return (
    <div className="px-4 sm:px-6 pb-4 pt-2 bg-white">
      <div className="flex flex-col border border-slate-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500 transition-all shadow-sm">
        <div className="bg-slate-50/80 border-b border-slate-200 px-3 py-1.5 flex items-center gap-0.5 rounded-t-xl">
          {toolbarItems.map((item, idx) =>
            item.divider ? (
              <div
                key={`div-${idx}`}
                className="w-px h-4 bg-slate-300 mx-1"
              />
            ) : (
              <button
                key={item.icon}
                type="button"
                onClick={() => handleFormat(item.action)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
                title={item.title}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {item.icon}
                </span>
              </button>
            )
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => onTypingChange?.(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="chat-composer-textarea w-full bg-transparent border-none focus:ring-0 px-4 py-3 text-[15px] placeholder:text-slate-400 resize-none overflow-y-auto outline-none"
        />

        {(attachments.length > 0 || attachmentError) && (
          <div className="px-3 pb-2 flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <span
                key={`${attachment.fileUrl}-${index}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
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
                  className="text-slate-400 hover:text-red-500"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    close
                  </span>
                </button>
              </span>
            ))}
            {attachmentError && (
              <span className="text-xs font-medium text-red-600">
                {attachmentError}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-2 pb-2 pt-0 border-t border-slate-100 mt-1">
          <div className="flex items-center gap-0.5 relative">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading || mode === "edit"}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Đính kèm file"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isUploading ? "sync" : "add_circle"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowEmojiPicker((value) => !value)}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Biểu tượng cảm xúc"
            >
              <span className="material-symbols-outlined text-[20px]">
                mood
              </span>
            </button>
            <button
              type="button"
              onClick={() => insertText("@")}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Nhắc đến ai đó"
            >
              <span className="material-symbols-outlined text-[20px]">
                alternate_email
              </span>
            </button>

            {showEmojiPicker && (
              <div className="absolute bottom-11 left-8 z-20 rounded-xl border border-slate-200 bg-white shadow-xl p-2 grid grid-cols-4 gap-1">
                {quickEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      insertText(emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="w-9 h-9 rounded-lg hover:bg-slate-100 text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pr-1">
            {mode !== "send" && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors font-medium text-sm"
              >
                Hủy
              </button>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || disabled || isUploading}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{sendLabel}</span>
              <span className="material-symbols-outlined text-[16px]">
                {mode === "edit" ? "check" : "send"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
