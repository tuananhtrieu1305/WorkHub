import { useEffect, useRef, useState } from "react";
import { EmojiPickerButton } from "../../components/emoji";
import { applyComposerFormat } from "./chatComposerUtils";
import { formatAudioDuration } from "./chatMessagePreview";
import PollCreateModal from "./PollCreateModal";
import ReminderCreateModal from "./ReminderCreateModal";

const secondaryComposerActions = [
  { icon: "contact_page", title: "Gửi danh thiếp" },
];

const MAX_VOICE_DURATION_SECONDS = 120;
const audioMimeTypeCandidates = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];
const recorderWaveformBars = [
  24, 48, 34, 72, 42, 88, 58, 36, 78, 96, 45, 68, 84, 52, 74, 40, 62, 30,
];

const getSupportedAudioMimeType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    audioMimeTypeCandidates.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    ) || ""
  );
};

const getBaseMimeType = (mimeType = "") =>
  String(mimeType).split(";")[0].trim() || "audio/webm";

const getAudioExtension = (mimeType = "") => {
  const baseMimeType = getBaseMimeType(mimeType);
  if (baseMimeType === "audio/ogg") return "ogg";
  if (baseMimeType === "audio/mp4") return "m4a";
  if (baseMimeType === "audio/mpeg") return "mp3";
  if (baseMimeType === "audio/wav") return "wav";
  return "webm";
};

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
  onCreatePoll,
  onCreateReminder,
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
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVoiceSending, setIsVoiceSending] = useState(false);
  const [isPreparingRecording, setIsPreparingRecording] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [attachmentError, setAttachmentError] = useState("");
  const [recordingError, setRecordingError] = useState("");
  const [renderedDraftPreview, setRenderedDraftPreview] =
    useState(draftPreview);
  const [isDraftExiting, setIsDraftExiting] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef(null);
  const pendingRecordingActionRef = useRef("cancel");
  const recordingRequestCancelledRef = useRef(false);
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

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopRecordingStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const resetRecordingState = () => {
    stopRecordingTimer();
    stopRecordingStream();
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    recordingStartedAtRef.current = 0;
    setIsPreparingRecording(false);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const getRecordingDurationSeconds = () => {
    const startedAt = recordingStartedAtRef.current;
    if (!startedAt) return Math.max(1, recordingSeconds);
    const elapsedSeconds = Math.ceil((Date.now() - startedAt) / 1000);
    return Math.min(
      Math.max(1, elapsedSeconds),
      MAX_VOICE_DURATION_SECONDS,
    );
  };

  const uploadVoiceRecording = async (blob, mimeType, durationSeconds) => {
    if (!onUploadAttachment || !onSend) return;

    const baseMimeType = getBaseMimeType(mimeType);
    const extension = getAudioExtension(baseMimeType);
    const voiceFile = new File([blob], `voice-${Date.now()}.${extension}`, {
      type: baseMimeType,
    });

    setIsVoiceSending(true);
    setAttachmentError("");
    setRecordingError("");
    setShowFormattingToolbar(false);

    try {
      const attachment = await onUploadAttachment(voiceFile, {
        purpose: "voice",
      });
      const voiceAttachment = {
        ...attachment,
        mimeType: attachment.mimeType || baseMimeType,
        kind: "voice",
        durationSeconds,
      };

      await onSend("", {
        type: "audio",
        attachments: [voiceAttachment],
        metadata: {
          durationSeconds,
          attachmentKind: "voice",
        },
      });
      onTypingChange?.(false);
    } catch (error) {
      console.error("Failed to send voice message:", error);
      setAttachmentError("Không thể gửi tin nhắn thoại.");
    } finally {
      setIsVoiceSending(false);
      textareaRef.current?.focus();
    }
  };

  const stopRecording = (action) => {
    const recorder = mediaRecorderRef.current;
    pendingRecordingActionRef.current = action;

    if (!recorder || recorder.state === "inactive") {
      resetRecordingState();
      return;
    }

    recorder.stop();
  };

  const stopAndSendRecording = () => {
    stopRecording("send");
  };

  const cancelRecording = () => {
    if (isPreparingRecording) {
      recordingRequestCancelledRef.current = true;
      setIsPreparingRecording(false);
      setRecordingSeconds(0);
      return;
    }

    stopRecording("cancel");
  };

  const startRecordingTimer = () => {
    stopRecordingTimer();
    recordingTimerRef.current = window.setInterval(() => {
      const elapsedSeconds = getRecordingDurationSeconds();
      setRecordingSeconds(elapsedSeconds);

      if (elapsedSeconds >= MAX_VOICE_DURATION_SECONDS) {
        stopAndSendRecording();
      }
    }, 250);
  };

  const startRecording = async () => {
    if (
      disabled ||
      isUploading ||
      isVoiceSending ||
      isPreparingRecording ||
      mode === "edit"
    ) {
      return;
    }
    if (!onUploadAttachment || !onSend) return;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecordingError("Trình duyệt không hỗ trợ thu âm trực tiếp.");
      return;
    }

    setAttachmentError("");
    setRecordingError("");
    setShowFormattingToolbar(false);
    setRecordingSeconds(0);
    setIsPreparingRecording(true);
    recordingRequestCancelledRef.current = false;

    let stream = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recordingRequestCancelledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      mediaStreamRef.current = stream;
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      pendingRecordingActionRef.current = "cancel";
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const action = pendingRecordingActionRef.current;
        const durationSeconds = getRecordingDurationSeconds();
        const recorderMimeType = recorder.mimeType || mimeType || "audio/webm";
        const voiceBlob = new Blob(recordingChunksRef.current, {
          type: getBaseMimeType(recorderMimeType),
        });

        resetRecordingState();

        if (action === "send") {
          if (voiceBlob.size === 0) {
            setAttachmentError("Không có dữ liệu thu âm.");
            return;
          }
          void uploadVoiceRecording(
            voiceBlob,
            recorderMimeType,
            durationSeconds,
          );
        }
      };

      recorder.start(250);
      setIsPreparingRecording(false);
      setIsRecording(true);
      setRecordingSeconds(0);
      startRecordingTimer();
    } catch (error) {
      console.error("Failed to start voice recording:", error);
      stream?.getTracks().forEach((track) => track.stop());
      stopRecordingStream();
      if (recordingRequestCancelledRef.current) return;
      setIsPreparingRecording(false);
      setRecordingError("Không thể truy cập microphone.");
    }
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if (
      (!trimmed && attachments.length === 0) ||
      disabled ||
      isUploading ||
      isVoiceSending ||
      isPreparingRecording ||
      isRecording
    ) {
      return;
    }
    onSend?.(trimmed, { type: "text", attachments });
    setContent("");
    setAttachments([]);
    setAttachmentError("");
    setRecordingError("");
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

  const hasComposerContent = Boolean(content.trim()) || attachments.length > 0;
  const composerBusy =
    disabled || isUploading || isVoiceSending || isPreparingRecording;
  const canAttach =
    Boolean(onUploadAttachment) &&
    mode !== "edit" &&
    !isPreparingRecording &&
    !isRecording &&
    !isVoiceSending;
  const canRecord =
    Boolean(onUploadAttachment) &&
    Boolean(onSend) &&
    mode !== "edit" &&
    !disabled &&
    !isUploading &&
    !isPreparingRecording &&
    !isVoiceSending &&
    !hasComposerContent;
  const canCreatePoll =
    Boolean(onCreatePoll) &&
    mode === "send" &&
    !disabled &&
    !isUploading &&
    !isPreparingRecording &&
    !isRecording &&
    !isVoiceSending;
  const canCreateReminder =
    Boolean(onCreateReminder) &&
    mode === "send" &&
    !disabled &&
    !isUploading &&
    !isPreparingRecording &&
    !isRecording &&
    !isVoiceSending;
  const canSend =
    hasComposerContent && !composerBusy && !isRecording;
  const isRecorderVisible = isPreparingRecording || isRecording;
  const recordingProgress = Math.min(
    100,
    (recordingSeconds / MAX_VOICE_DURATION_SECONDS) * 100,
  );
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
      setRecordingError("");
      recordingRequestCancelledRef.current = true;
      setIsPreparingRecording(false);
      const recorder = mediaRecorderRef.current;
      if (recorder?.state === "recording") {
        pendingRecordingActionRef.current = "cancel";
        recorder.stop();
      }
      onTypingChange?.(false);
    }
  }, [draftPreview, initialContent, mode, onTypingChange]);

  useEffect(() => {
    if (mode !== "send") {
      setIsPollModalOpen(false);
      setIsReminderModalOpen(false);
    }
  }, [mode]);

  useEffect(() => {
    return () => {
      recordingRequestCancelledRef.current = true;
      stopRecordingTimer();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      stopRecordingStream();
    };
  }, []);

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
    <>
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
              disabled={composerBusy || !canAttach}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
              title="Đính kèm file"
              aria-label="Đính kèm file"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isUploading ? "sync" : "attach_file"}
              </span>
            </button>

            {secondaryComposerActions.map((item) => (
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

            <button
              type="button"
              onClick={() => setIsPollModalOpen(true)}
              disabled={!canCreatePoll}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
              title="Tạo bình chọn"
              aria-label="Tạo bình chọn"
            >
              <span className="material-symbols-outlined text-[20px]">
                bar_chart
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsReminderModalOpen(true)}
              disabled={!canCreateReminder}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
              title="Tạo nhắc hẹn"
              aria-label="Tạo nhắc hẹn"
            >
              <span className="material-symbols-outlined text-[20px]">
                alarm
              </span>
            </button>

            <button
              type="button"
              onClick={startRecording}
              disabled={!canRecord || isRecorderVisible}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed ${
                isRecorderVisible
                  ? "bg-red-50 text-red-600"
                  : "text-slate-600 hover:bg-violet-50 hover:text-violet-700 disabled:text-slate-300"
              }`}
              title={
                hasComposerContent
                  ? "Gửi hoặc xóa nội dung hiện tại trước khi thu âm"
                  : "Thu âm voice"
              }
              aria-label="Thu âm voice"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isRecorderVisible ? "graphic_eq" : "mic"}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowFormattingToolbar((value) => !value)}
            disabled={isRecorderVisible || isVoiceSending}
            className={`inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold transition-colors ${
              showFormattingToolbar
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            } disabled:cursor-not-allowed disabled:text-slate-300`}
            title="Định dạng tin nhắn"
            aria-pressed={showFormattingToolbar}
          >
            <span className="material-symbols-outlined text-[20px]">
              format_bold
            </span>
            <span className="hidden sm:inline">Định dạng tin nhắn</span>
          </button>
        </div>

        {(attachments.length > 0 || attachmentError || recordingError) && (
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
            {recordingError && (
              <span className="text-xs font-semibold text-red-600">
                {recordingError}
              </span>
            )}
          </div>
        )}

        <div className="chat-composer-input-shell relative flex items-center">
          {isRecorderVisible ? (
            <div className="chat-voice-recorder flex w-full items-center gap-3 px-3 py-3">
              <button
                type="button"
                onClick={cancelRecording}
                className="chat-voice-recorder-trash inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Hủy thu âm"
                aria-label="Hủy thu âm"
              >
                <span className="material-symbols-outlined text-[22px]">
                  delete
                </span>
              </button>
              <div
                className={`chat-voice-recorder-track min-w-0 flex-1 ${
                  isPreparingRecording ? "is-preparing" : "is-recording"
                }`}
              >
                <span
                  className="chat-voice-recorder-progress"
                  style={{ width: `${recordingProgress}%` }}
                />
                <div className="relative z-10 flex min-w-0 items-center gap-3">
                  <span className="chat-voice-recorder-live" aria-hidden="true" />
                  <span className="w-11 shrink-0 text-sm font-extrabold text-white">
                    {isPreparingRecording
                      ? "0:00"
                      : formatAudioDuration(recordingSeconds)}
                  </span>
                  {isPreparingRecording && (
                    <span className="chat-voice-recorder-status">
                      Đang bật mic...
                    </span>
                  )}
                  <span
                    className="chat-voice-recorder-waveform"
                    aria-hidden="true"
                  >
                    {recorderWaveformBars.map((height, index) => (
                      <span
                        key={`${height}-${index}`}
                        style={{
                          "--bar-height": `${height}%`,
                          "--bar-index": index,
                        }}
                      />
                    ))}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={stopAndSendRecording}
                disabled={isPreparingRecording}
                className="chat-voice-recorder-send inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm shadow-violet-900/20 transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                title="Gửi voice"
                aria-label="Gửi voice"
              >
                <span className="material-symbols-outlined text-[22px]">
                  send
                </span>
              </button>
            </div>
          ) : isVoiceSending ? (
            <div className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600">
              <span className="material-symbols-outlined animate-spin text-[20px] text-violet-600">
                progress_activity
              </span>
              <span>Đang gửi tin nhắn thoại...</span>
            </div>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={() => onTypingChange?.(false)}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
                className="chat-composer-textarea w-full resize-none overflow-y-auto border-none bg-transparent px-4 py-3.5 pr-24 text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-500 focus:ring-0 disabled:text-slate-400"
              />
              <EmojiPickerButton
                align="right"
                buttonClassName="chat-composer-emoji-button"
                className="absolute right-12 top-2"
                label="Biểu tượng cảm xúc"
                onEmojiSelect={insertText}
                placement="top"
                popoverClassName="chat-composer-emoji-popover"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-900/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                title={mode === "edit" ? "Lưu chỉnh sửa" : "Gửi tin nhắn"}
                aria-label={mode === "edit" ? "Lưu chỉnh sửa" : "Gửi tin nhắn"}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {mode === "edit" ? "check" : "send"}
                </span>
              </button>
            </>
          )}
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
    <PollCreateModal
      isOpen={isPollModalOpen}
      onClose={() => setIsPollModalOpen(false)}
      onCreatePoll={onCreatePoll}
      disabled={!canCreatePoll}
    />
    <ReminderCreateModal
      isOpen={isReminderModalOpen}
      onClose={() => setIsReminderModalOpen(false)}
      onCreateReminder={onCreateReminder}
      disabled={!canCreateReminder}
    />
    </>
  );
};

export default ChatInput;
