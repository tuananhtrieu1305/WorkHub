import { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { createPost } from "../../api/postApi";
import { searchUsers } from "../../api/userApi";
import { EmojiPickerButton, appendEmojiToText } from "../../components/emoji";
import SendIcon from "../../components/icons/SendIcon";
import {
  formatFileSize,
  getAttachmentIcon,
  getAttachmentIconClass,
  getAttachmentType,
} from "./attachmentUtils";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";

const FEELINGS = [
  { emoji: "😀", label: "Vui vẻ" },
  { emoji: "😍", label: "Yêu thích" },
  { emoji: "🎉", label: "Ăn mừng" },
  { emoji: "🤔", label: "Suy nghĩ" },
  { emoji: "😢", label: "Buồn" },
  { emoji: "😠", label: "Tức giận" },
  { emoji: "🤩", label: "Phấn khích" },
  { emoji: "😴", label: "Mệt mỏi" },
  { emoji: "🥳", label: "Lễ hội" },
  { emoji: "💪", label: "Có động lực" },
  { emoji: "🙏", label: "Biết ơn" },
  { emoji: "☕", label: "Đang uống cà phê" },
];

const ACTIVITIES = [
  { emoji: "🏢", label: "Đang làm việc" },
  { emoji: "📚", label: "Đang học" },
  { emoji: "✈️", label: "Đang đi du lịch" },
  { emoji: "🎮", label: "Đang chơi game" },
  { emoji: "🎵", label: "Đang nghe nhạc" },
  { emoji: "🍕", label: "Đang ăn" },
  { emoji: "🏃", label: "Đang tập thể dục" },
  { emoji: "📖", label: "Đang đọc sách" },
];

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

const lowerFirstLetter = (value = "") =>
  value ? `${value.charAt(0).toLocaleLowerCase("vi-VN")}${value.slice(1)}` : "";

const getActivityDisplayText = (activity) => {
  if (!activity?.label) return "";
  if (activity.type === "activity") return activity.label;
  return `Đang cảm thấy ${lowerFirstLetter(activity.label)}`;
};

const CreatePostBox = ({ onPostCreated }) => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeeling, setShowFeeling] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState(null);
  const [feelingTab, setFeelingTab] = useState("feeling");
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [selectedMentions, setSelectedMentions] = useState([]);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const mentionRef = useRef(null);

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";
  const avatarUrl = getAvatarUrl(user?.avatar);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) {
      setFiles((prev) => [...prev, ...selected]);
    }
    e.target.value = "";
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMentionSearch = async (query) => {
    setMentionQuery(query);
    try {
      const res = await searchUsers({ search: query, size: 8 });
      const users = res?.content || res || [];
      setMentionResults(users);
      setShowMentionDropdown(true);
    } catch {
      setMentionResults([]);
      setShowMentionDropdown(true);
    }
  };

  const addMention = (mentionUser) => {
    const mentionUserId = toComparableId(mentionUser);
    if (selectedMentions.find((m) => toComparableId(m) === mentionUserId)) return;
    setSelectedMentions((prev) => [...prev, mentionUser]);
    setMentionQuery("");
    handleMentionSearch("");
    mentionRef.current?.focus();
  };

  const removeMention = (userId) => {
    setSelectedMentions((prev) =>
      prev.filter((m) => toComparableId(m) !== toComparableId(userId))
    );
  };

  const selectFeeling = (feeling) => {
    setSelectedFeeling({
      ...feeling,
      type: feelingTab,
    });
    setShowFeeling(false);
  };

  const handleEmojiSelect = (emojiNative) => {
    setContent((prev) => appendEmojiToText(prev, emojiNative));
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleSubmit = async () => {
    const hasMetadata = selectedFeeling || selectedMentions.length > 0;
    if (!content.trim() && files.length === 0 && !hasMetadata) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();

      formData.append("content", content.trim());

      if (selectedFeeling) {
        formData.append(
          "activity",
          JSON.stringify({
            type: selectedFeeling.type,
            emoji: selectedFeeling.emoji,
            label: selectedFeeling.label,
          })
        );
      }

      if (selectedMentions.length > 0) {
        formData.append(
          "mentions",
          JSON.stringify(selectedMentions.map((m) => toComparableId(m)))
        );
      }

      files.forEach((file) => {
        formData.append("attachments", file);
      });

      const newPost = await createPost(formData);
      setContent("");
      setFiles([]);
      setSelectedFeeling(null);
      setSelectedMentions([]);
      setMentionQuery("");
      setMentionResults([]);
      setShowMentionPicker(false);
      setShowMentionDropdown(false);
      onPostCreated?.(newPost);
    } catch (err) {
      console.error("Failed to create post:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionButtons = [
    {
      icon: "image",
      label: "Ảnh/Video",
      color: "text-blue-500 hover:bg-blue-50",
      onClick: () => fileInputRef.current?.click(),
    },
    {
      icon: "attach_file",
      label: "Đính kèm file",
      color: "text-purple-500 hover:bg-purple-50",
      onClick: () => fileInputRef.current?.click(),
    },
    {
      icon: "alternate_email",
      label: "Gắn thẻ người khác",
      color: "text-emerald-500 hover:bg-emerald-50",
      onClick: () => {
        setShowMentionPicker((current) => !current);
        setShowMentionDropdown(true);
        handleMentionSearch(mentionQuery);
        requestAnimationFrame(() => mentionRef.current?.focus());
      },
    },
    {
      icon: "mood",
      label: "Cảm xúc/Hoạt động",
      color: "text-amber-500 hover:bg-amber-50",
      onClick: () => setShowFeeling(!showFeeling),
    },
  ];

  const canSubmit =
    content.trim() ||
    files.length > 0 ||
    selectedFeeling ||
    selectedMentions.length > 0;

  return (
    <div className="relative z-20 rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:rounded-2xl sm:p-5">
      <div className="flex gap-3 sm:gap-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user?.fullName}
            referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
            className="size-10 shrink-0 rounded-full object-cover shadow-sm sm:size-12"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white shadow-sm sm:size-12 sm:text-lg">
            {userInitial}
          </div>
        )}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[60px] w-full resize-none border-none bg-transparent py-2 pl-0 pr-12 text-base font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 sm:pl-2 sm:text-lg"
            placeholder="Bạn đang nghĩ gì? Chia sẻ một cập nhật..."
          />
          <EmojiPickerButton
            className="absolute right-1 top-1 z-20"
            onEmojiSelect={handleEmojiSelect}
            label="Chèn biểu tượng cảm xúc vào bài đăng"
          />
        </div>
      </div>

      {/* Selected feeling display */}
      {selectedFeeling && (
        <div className="mb-2 mt-2 flex items-center gap-2 sm:ml-16 sm:mt-1">
          <span className="text-sm bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
            {selectedFeeling.emoji} {getActivityDisplayText(selectedFeeling)}
            <button
              onClick={() => setSelectedFeeling(null)}
              className="ml-1 text-amber-400 hover:text-amber-600"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </span>
        </div>
      )}

      {/* Selected mentions display */}
      {selectedMentions.length > 0 && (
        <div className="mb-2 mt-2 flex flex-wrap items-center gap-2 sm:ml-16 sm:mt-1">
          {selectedMentions.map((m) => (
            <span
              key={toComparableId(m)}
              className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium flex items-center gap-1.5"
            >
              {m.fullName}
              <button
                onClick={() => removeMention(m)}
                className="ml-1 text-blue-400 hover:text-blue-600"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="mb-2 mt-3 flex flex-wrap gap-3 sm:ml-16">
          {files.map((file, idx) => {
            const attachmentType = getAttachmentType(file);
            const isImage = attachmentType === "image";
            const isVideo = attachmentType === "video";
            const previewUrl = isImage || isVideo ? URL.createObjectURL(file) : null;

            return (
              <div
                key={idx}
                className={`relative group rounded-xl border border-slate-200 shadow-sm ${
                  isImage || isVideo ? "overflow-hidden" : "bg-white p-3"
                }`}
              >
                {isVideo ? (
                  <video
                    src={previewUrl}
                    className="w-24 h-24 object-cover"
                    muted
                  />
                ) : isImage ? (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="w-24 h-24 object-cover"
                  />
                ) : (
                  <div className="flex w-64 max-w-full items-center gap-3">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${getAttachmentIconClass(
                        file
                      )}`}
                    >
                      <span className="material-symbols-outlined text-2xl leading-none">
                        {getAttachmentIcon(file)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {file.name}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {formatFileSize(file.size) || "Tệp đính kèm"}
                      </p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => removeFile(idx)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
                {isVideo && (
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                    Video
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Feeling/Activity popup */}
      {showFeeling && (
        <div className="relative z-10 mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg sm:ml-16">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-900">
              Bạn đang cảm thấy thế nào?
            </h4>
            <button
              onClick={() => setShowFeeling(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setFeelingTab("feeling")}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                feelingTab === "feeling"
                  ? "bg-amber-100 text-amber-700"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              Cảm xúc
            </button>
            <button
              onClick={() => setFeelingTab("activity")}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                feelingTab === "activity"
                  ? "bg-blue-100 text-blue-700"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              Hoạt động
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 sm:grid-cols-4">
            {(feelingTab === "feeling" ? FEELINGS : ACTIVITIES).map((item) => (
              <button
                key={item.label}
                onClick={() => selectFeeling(item)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:bg-slate-50 hover:scale-105 ${
                  selectedFeeling?.label === item.label
                    ? "bg-amber-50 ring-1 ring-amber-300"
                    : ""
                }`}
              >
                <span className="text-xl">{item.emoji}</span>
                <span className="text-[10px] font-medium text-slate-600 text-center leading-tight">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mention search */}
      {showMentionPicker && (
        <div className="relative z-10 mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:ml-16">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
            <span className="material-symbols-outlined text-[19px] text-emerald-500">
              alternate_email
            </span>
            <input
              ref={mentionRef}
              type="text"
              value={mentionQuery}
              onChange={(e) => handleMentionSearch(e.target.value)}
              placeholder="Tìm người trong tổ chức..."
              className="min-w-0 flex-1 border-none bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              onFocus={() => {
                setShowMentionDropdown(true);
                if (mentionResults.length === 0) handleMentionSearch(mentionQuery);
              }}
            />
            <button
              type="button"
              onClick={() => {
                setShowMentionPicker(false);
                setShowMentionDropdown(false);
              }}
              className="inline-flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Đóng chọn người được gắn thẻ"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          {showMentionDropdown && (
            <div className="max-h-72 overflow-y-auto">
              {mentionResults.length > 0 ? (
                mentionResults.map((u) => {
                  const mAvatar = getAvatarUrl(u.avatar);
                  const isSelected = selectedMentions.some(
                    (mention) => toComparableId(mention) === toComparableId(u)
                  );
                  return (
                    <button
                      key={toComparableId(u)}
                      type="button"
                      onClick={() => addMention(u)}
                      disabled={isSelected}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 disabled:bg-blue-50/60"
                    >
                      {mAvatar ? (
                        <img
                          src={mAvatar}
                          alt=""
                          referrerPolicy={getAvatarReferrerPolicy(mAvatar)}
                          className="size-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                          {u.fullName?.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {u.fullName}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {u.position || u.email}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[18px] text-blue-600">
                          check_circle
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="px-4 py-4 text-center text-sm font-medium text-slate-400">
                  Không tìm thấy thành viên phù hợp.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {actionButtons.map((btn) => (
            <button
              key={btn.icon}
              onClick={btn.onClick}
              className={`relative inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer ${btn.color} group`}
              title={btn.label}
            >
              <span className="material-symbols-outlined text-xl leading-none">{btn.icon}</span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-800 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                {btn.label}
              </span>
            </button>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !canSubmit}
          className="flex shrink-0 items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-colors duration-300 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {isSubmitting && (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          Đăng bài
          <SendIcon className="size-4 shrink-0" />
        </button>
      </div>
    </div>
  );
};

export default CreatePostBox;
