import { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { createPost } from "../../api/postApi";
import { searchUsers } from "../../api/userApi";
import { EmojiPickerButton, appendEmojiToText } from "../../components/emoji";
import {
  formatFileSize,
  getAttachmentIcon,
  getAttachmentIconClass,
  getAttachmentType,
} from "./attachmentUtils";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

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
  const [selectedMentions, setSelectedMentions] = useState([]);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const mentionRef = useRef(null);

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";
  const avatarUrl = user?.avatar
    ? user.avatar.startsWith("http")
      ? user.avatar
      : `${API_URL}${user.avatar}`
    : null;

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
    if (query.length < 2) {
      setMentionResults([]);
      setShowMentionDropdown(false);
      return;
    }
    try {
      const res = await searchUsers({ search: query, size: 5 });
      const users = res?.content || res || [];
      setMentionResults(users);
      setShowMentionDropdown(users.length > 0);
    } catch {
      setMentionResults([]);
      setShowMentionDropdown(false);
    }
  };

  const addMention = (mentionUser) => {
    if (selectedMentions.find((m) => m._id === mentionUser._id)) return;
    setSelectedMentions((prev) => [...prev, mentionUser]);
    const mentionText = `@${mentionUser.fullName} `;
    setContent((prev) => prev + mentionText);
    setShowMentionDropdown(false);
    setMentionQuery("");
    textareaRef.current?.focus();
  };

  const removeMention = (userId) => {
    setSelectedMentions((prev) => prev.filter((m) => m._id !== userId));
  };

  const selectFeeling = (feeling) => {
    setSelectedFeeling(feeling);
    setShowFeeling(false);
  };

  const handleEmojiSelect = (emojiNative) => {
    setContent((prev) => appendEmojiToText(prev, emojiNative));
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleSubmit = async () => {
    if (!content.trim() && files.length === 0) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();

      let postContent = content;
      if (selectedFeeling) {
        postContent = `${selectedFeeling.emoji} Đang cảm thấy ${selectedFeeling.label} — ${content}`;
      }
      formData.append("content", postContent);

      if (selectedMentions.length > 0) {
        formData.append(
          "mentions",
          JSON.stringify(selectedMentions.map((m) => m._id))
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
      onClick: () => mentionRef.current?.focus(),
    },
    {
      icon: "mood",
      label: "Cảm xúc/Hoạt động",
      color: "text-amber-500 hover:bg-amber-50",
      onClick: () => setShowFeeling(!showFeeling),
    },
  ];

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-5 relative z-20">
      <div className="flex gap-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user?.fullName}
            className="size-12 rounded-full shadow-sm object-cover shrink-0"
          />
        ) : (
          <div className="size-12 rounded-full shadow-sm bg-blue-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
            {userInitial}
          </div>
        )}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 py-2 pl-2 pr-12 text-slate-900 placeholder-slate-400 resize-none min-h-[60px] text-lg font-medium focus:outline-none"
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
        <div className="flex items-center gap-2 ml-16 mt-1 mb-2">
          <span className="text-sm bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
            {selectedFeeling.emoji} {selectedFeeling.label}
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
        <div className="flex items-center gap-2 ml-16 mt-1 mb-2 flex-wrap">
          {selectedMentions.map((m) => (
            <span
              key={m._id}
              className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium flex items-center gap-1.5"
            >
              @{m.fullName}
              <button
                onClick={() => removeMention(m._id)}
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
        <div className="flex flex-wrap gap-3 ml-16 mt-3 mb-2">
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
        <div className="ml-16 mt-3 bg-white border border-slate-200 rounded-xl shadow-lg p-4 relative z-10">
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
          <div className="grid grid-cols-4 gap-2">
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
      {showMentionDropdown && (
        <div className="ml-16 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden relative z-10">
          {mentionResults.map((u) => {
            const mAvatar = u.avatar
              ? u.avatar.startsWith("http")
                ? u.avatar
                : `${API_URL}${u.avatar}`
              : null;
            return (
              <button
                key={u._id}
                onClick={() => addMention(u)}
                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-slate-50 transition-colors"
              >
                {mAvatar ? (
                  <img
                    src={mAvatar}
                    alt=""
                    className="size-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="size-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                    {u.fullName?.charAt(0)}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-900">{u.fullName}</p>
                  <p className="text-xs text-slate-500">{u.position || u.email}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          {actionButtons.map((btn) => (
            <button
              key={btn.icon}
              onClick={btn.onClick}
              className={`relative inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors ${btn.color} group`}
              title={btn.label}
            >
              <span className="material-symbols-outlined text-xl leading-none">{btn.icon}</span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-800 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                {btn.label}
              </span>
            </button>
          ))}
          {/* Hidden mention input */}
          <input
            ref={mentionRef}
            type="text"
            value={mentionQuery}
            onChange={(e) => handleMentionSearch(e.target.value)}
            placeholder="Tìm người để gắn thẻ..."
            className={`text-sm border border-slate-200 rounded-full px-3 py-1.5 focus:outline-none focus:border-blue-400 transition-all ${
              mentionQuery || showMentionDropdown
                ? "w-48 opacity-100 ml-2"
                : "w-0 opacity-0 p-0 border-0"
            }`}
            onFocus={() =>
              mentionQuery.length >= 2 && setShowMentionDropdown(true)
            }
            onBlur={() =>
              setTimeout(() => setShowMentionDropdown(false), 200)
            }
          />
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
          disabled={isSubmitting || (!content.trim() && files.length === 0)}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-2"
        >
          {isSubmitting && (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          Đăng bài
        </button>
      </div>
    </div>
  );
};

export default CreatePostBox;
