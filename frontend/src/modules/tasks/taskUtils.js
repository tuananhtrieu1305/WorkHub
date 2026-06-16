import { TASK_PRIORITY_MAP, TASK_STATUS_MAP } from "./taskConstants";

export const getTaskId = (task) => task?.id || task?._id || "";

export const getUserId = (user) => user?.id || user?._id || "";

export const isTaskAssignedToUser = (task, userId) =>
  (task?.assigneeIds || []).map(String).includes(String(userId));

export const isUserTask = (task, userId) => {
  const normalizedUserId = String(userId || "");
  return Boolean(
    normalizedUserId &&
      (String(task?.createdBy || "") === normalizedUserId ||
        String(task?.ownerId || "") === normalizedUserId ||
        isTaskAssignedToUser(task, normalizedUserId)),
  );
};

export const getTaskStatusMeta = (status) =>
  TASK_STATUS_MAP[status] || TASK_STATUS_MAP.todo;

export const getTaskPriorityMeta = (priority) =>
  TASK_PRIORITY_MAP[priority] || TASK_PRIORITY_MAP.medium;

export const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const fromDateInputValue = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T17:00:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export const formatTaskDate = (value) => {
  if (!value) return "Chưa đặt hạn";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Chưa đặt hạn";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const getDueState = (task) => {
  if (!task?.endAt || ["done", "cancelled"].includes(task.status)) {
    return "neutral";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.endAt);
  if (!Number.isFinite(dueDate.getTime())) return "neutral";
  dueDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((dueDate - today) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 2) return "soon";
  return "neutral";
};

export const parseChecklistText = (value) =>
  String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((title, index) => ({
      title,
      order: index,
      isDone: false,
    }));

export const getInitials = (value = "") => {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "WH";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
};

export const taskMatchesSearch = (task, search) => {
  const needle = String(search || "").trim().toLowerCase();
  if (!needle) return true;

  return [
    task?.title,
    task?.description,
    task?.owner?.fullName,
    task?.creator?.fullName,
    ...(task?.assignees || []).map((assignment) => assignment.user?.fullName),
  ].some((value) => String(value || "").toLowerCase().includes(needle));
};
