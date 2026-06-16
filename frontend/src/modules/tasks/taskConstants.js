export const TASK_STATUSES = [
  {
    id: "todo",
    label: "Cần làm",
    shortLabel: "To do",
    icon: "radio_button_unchecked",
    accent: "#2563eb",
    soft: "#eff6ff",
    border: "#bfdbfe",
  },
  {
    id: "in_progress",
    label: "Đang làm",
    shortLabel: "Doing",
    icon: "autorenew",
    accent: "#0d9488",
    soft: "#ccfbf1",
    border: "#99f6e4",
  },
  {
    id: "review",
    label: "Chờ duyệt",
    shortLabel: "Review",
    icon: "rate_review",
    accent: "#7c3aed",
    soft: "#f3e8ff",
    border: "#ddd6fe",
  },
  {
    id: "blocked",
    label: "Đang vướng",
    shortLabel: "Blocked",
    icon: "report",
    accent: "#d97706",
    soft: "#fffbeb",
    border: "#fde68a",
  },
  {
    id: "done",
    label: "Hoàn thành",
    shortLabel: "Done",
    icon: "task_alt",
    accent: "#16a34a",
    soft: "#f0fdf4",
    border: "#bbf7d0",
  },
  {
    id: "cancelled",
    label: "Đã hủy",
    shortLabel: "Cancelled",
    icon: "cancel",
    accent: "#e11d48",
    soft: "#fff1f2",
    border: "#fecdd3",
  },
];

export const TASK_STATUS_MAP = TASK_STATUSES.reduce(
  (acc, status) => ({
    ...acc,
    [status.id]: status,
  }),
  {},
);

export const TASK_PRIORITIES = [
  {
    id: "urgent",
    label: "Khẩn cấp",
    icon: "priority_high",
    accent: "#e11d48",
    soft: "#fff1f2",
  },
  {
    id: "high",
    label: "Cao",
    icon: "keyboard_double_arrow_up",
    accent: "#ea580c",
    soft: "#fff7ed",
  },
  {
    id: "medium",
    label: "Trung bình",
    icon: "drag_handle",
    accent: "#2563eb",
    soft: "#eff6ff",
  },
  {
    id: "low",
    label: "Thấp",
    icon: "keyboard_double_arrow_down",
    accent: "#16a34a",
    soft: "#f0fdf4",
  },
];

export const TASK_PRIORITY_MAP = TASK_PRIORITIES.reduce(
  (acc, priority) => ({
    ...acc,
    [priority.id]: priority,
  }),
  {},
);

export const EMPTY_TASK_FORM = {
  title: "",
  description: "",
  priority: "medium",
  status: "todo",
  endAt: "",
  assigneeIds: [],
  checklistText: "",
};
