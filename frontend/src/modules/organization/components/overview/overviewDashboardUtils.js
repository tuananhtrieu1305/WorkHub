export const numberFormatter = new Intl.NumberFormat("vi-VN");

export const formatNumber = (value) => numberFormatter.format(Number(value || 0));

export const formatDeltaText = (delta = {}) => {
  const value = Number(delta.value || 0);
  if (!value) return "Không đổi";
  return `${value > 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`;
};

export const getDeltaColorClass = (delta = {}, invert = false) => {
  const direction = delta.direction || "flat";
  if (direction === "flat") return "text-slate-500";

  const isGood = invert ? direction === "down" : direction === "up";
  return isGood ? "text-emerald-600" : "text-amber-600";
};

export const getFallbackStatCards = (overview = {}) => {
  const metrics = overview?.metrics || {};

  return [
    {
      key: "members",
      icon: "groups",
      label: "thành viên",
      value: metrics.members || 0,
      tone: "teal",
      delta: { value: 0, direction: "flat" },
      detail: "Không đổi",
    },
    {
      key: "roles",
      icon: "shield",
      label: "vai trò",
      value: metrics.roles || 0,
      tone: "blue",
      delta: { value: 0, direction: "flat" },
      detail: "Không đổi",
    },
    {
      key: "invites",
      icon: "mail",
      label: "lời mời",
      value: metrics.activeInvites || metrics.invites || 0,
      tone: "indigo",
      delta: { value: 0, direction: "flat" },
      detail: "Đang hoạt động",
    },
    {
      key: "pending",
      icon: "schedule",
      label: "yêu cầu chờ duyệt",
      value: metrics.pendingMembers || 0,
      tone: "amber",
      delta: { value: 0, direction: "flat" },
      detail: "Cần xử lý",
    },
    {
      key: "activity",
      icon: "trending_up",
      label: "hoạt động",
      value: `${metrics.activityRate || 0}%`,
      tone: "emerald",
      delta: { value: 0, direction: "flat" },
      detail: "so với tuần trước",
    },
  ];
};

export const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const formatDueDate = (value) => {
  if (!value) return "Chưa có hạn";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Chưa có hạn";

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
};

export const getMaxValue = (items = [], keys = ["value"]) =>
  Math.max(
    1,
    ...items.flatMap((item) => keys.map((key) => Number(item[key] || 0))),
  );

export const buildLinePoints = (items, width, height, padding) => {
  const max = getMaxValue(items, ["value"]);
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const denominator = Math.max(items.length - 1, 1);

  return items.map((item, index) => {
    const x = padding.left + (index / denominator) * usableWidth;
    const y = padding.top + usableHeight - (Number(item.value || 0) / max) * usableHeight;
    return { ...item, x, y };
  });
};

export const pointsToPath = (points = []) => {
  if (!points.length) return "";

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;

    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
};
