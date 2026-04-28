import { useEffect, useRef, useState } from "react";
import { createConversation } from "../../api/conversationApi";
import { searchUsers } from "../../api/userApi";
import {
  buildConversationPayload,
  canCreateConversation,
  toggleSelectedUser,
} from "./newConversationState";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const getUserId = (user) => String(user?.id || user?._id || "");

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  return avatar.startsWith("http") ? avatar : `${API_URL}${avatar}`;
};

const NewConversationModal = ({ isOpen, onClose, onCreate }) => {
  const [type, setType] = useState("private");
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const searchTimeoutRef = useRef(null);

  const resetDraft = () => {
    clearTimeout(searchTimeoutRef.current);
    setType("private");
    setGroupName("");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedUsers([]);
    setIsSearching(false);
    setIsCreating(false);
    setError("");
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    let ignore = false;
    queueMicrotask(() => {
      if (!ignore) setIsSearching(true);
    });

    searchUsers({ page: 1, size: 10 })
      .then((data) => {
        if (!ignore) setSearchResults(data.content || []);
      })
      .catch(() => {
        if (!ignore) setError("Không thể tải danh sách người dùng.");
      })
      .finally(() => {
        if (!ignore) setIsSearching(false);
      });

    return () => {
      ignore = true;
      clearTimeout(searchTimeoutRef.current);
    };
  }, [isOpen]);

  const handleClose = () => {
    resetDraft();
    onClose?.();
  };

  const handleTypeChange = (nextType) => {
    setType(nextType);
    setError("");
    setSelectedUsers((prev) => (nextType === "private" ? prev.slice(0, 1) : prev));
  };

  const runSearch = async (keyword) => {
    try {
      const data = await searchUsers({
        keyword: keyword.trim(),
        page: 1,
        size: 10,
      });
      setSearchResults(data.content || []);
      setError("");
    } catch {
      setSearchResults([]);
      setError("Không thể tìm kiếm người dùng. Vui lòng thử lại.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e) => {
    const nextQuery = e.target.value;
    setSearchQuery(nextQuery);
    setError("");
    clearTimeout(searchTimeoutRef.current);
    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(() => {
      runSearch(nextQuery);
    }, 250);
  };

  const handleToggleUser = (user) => {
    setSelectedUsers((prev) => toggleSelectedUser(prev, user, type));
    setError("");
  };

  const handleCreate = async () => {
    if (!canCreateConversation(type, groupName, selectedUsers)) {
      setError(
        type === "group"
          ? "Vui lòng nhập tên nhóm và chọn ít nhất một thành viên."
          : "Vui lòng chọn một người để bắt đầu chat.",
      );
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const conversation = await createConversation(
        buildConversationPayload({ type, groupName, selectedUsers }),
      );
      onCreate?.(conversation);
      resetDraft();
      onClose?.();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Không thể tạo hội thoại. Vui lòng thử lại.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const canCreate = canCreateConversation(type, groupName, selectedUsers);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[86vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Hội thoại mới</h2>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className="text-sm font-bold text-slate-700 mb-2 block">
              Loại hội thoại
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => handleTypeChange("private")}
                className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  type === "private"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">
                  person
                </span>
                <div className="text-left">
                  <span className="text-sm font-bold block">Riêng tư</span>
                  <span className="text-xs opacity-70">Chat 1-1</span>
                </div>
              </button>
              <button
                onClick={() => handleTypeChange("group")}
                className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  type === "group"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">
                  group
                </span>
                <div className="text-left">
                  <span className="text-sm font-bold block">Nhóm</span>
                  <span className="text-xs opacity-70">Nhiều người</span>
                </div>
              </button>
            </div>
          </div>

          {type === "group" && (
            <div>
              <label className="text-sm font-bold text-slate-700 mb-2 block">
                Tên nhóm
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nhập tên nhóm..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 px-4 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition-all outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-bold text-slate-700 mb-2 block">
              Tìm người dùng
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Tìm kiếm theo tên hoặc email..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg h-10 pl-9 pr-4 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition-all outline-none"
              />
            </div>
          </div>

          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <button
                  key={getUserId(user)}
                  onClick={() => handleToggleUser(user)}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  {user.fullName}
                  <span className="material-symbols-outlined text-[14px]">
                    close
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {isSearching ? (
              <div className="p-6 text-center">
                <div className="route-loading-spinner mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">
                  Đang tìm người dùng...
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-6 text-center">
                <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">
                  person_search
                </span>
                <p className="text-sm text-slate-400 font-medium">
                  Không tìm thấy người dùng phù hợp
                </p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {searchResults.map((result) => {
                  const userId = getUserId(result);
                  const avatarUrl = getAvatarUrl(result.avatar);
                  const isSelected = selectedUsers.some(
                    (user) => getUserId(user) === userId,
                  );

                  return (
                    <button
                      key={userId}
                      onClick={() => handleToggleUser(result)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                        isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={result.fullName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold">
                          {(result.fullName || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {result.fullName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {result.position || result.email}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-blue-600">
                          check_circle
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm font-medium px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || isCreating}
            className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isCreating ? "Đang tạo..." : "Tạo hội thoại"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewConversationModal;
