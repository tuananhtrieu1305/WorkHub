export const REACTION_OPTIONS = [
  {
    type: "like",
    label: "Thích",
    emoji: "👍",
    textClassName: "text-blue-600",
    bgClassName: "bg-blue-50",
  },
  {
    type: "love",
    label: "Yêu thích",
    emoji: "❤️",
    textClassName: "text-rose-600",
    bgClassName: "bg-rose-50",
  },
  {
    type: "care",
    label: "Thương thương",
    emoji: "🤗",
    textClassName: "text-amber-600",
    bgClassName: "bg-amber-50",
  },
  {
    type: "haha",
    label: "Haha",
    emoji: "😂",
    textClassName: "text-yellow-600",
    bgClassName: "bg-yellow-50",
  },
  {
    type: "wow",
    label: "Wow",
    emoji: "😮",
    textClassName: "text-orange-600",
    bgClassName: "bg-orange-50",
  },
  {
    type: "sad",
    label: "Buồn",
    emoji: "😢",
    textClassName: "text-sky-600",
    bgClassName: "bg-sky-50",
  },
  {
    type: "angry",
    label: "Phẫn nộ",
    emoji: "😡",
    textClassName: "text-red-600",
    bgClassName: "bg-red-50",
  },
];

const REACTION_BY_TYPE = new Map(
  REACTION_OPTIONS.map((reaction) => [reaction.type, reaction])
);

export const getReactionOption = (reactionType) =>
  REACTION_BY_TYPE.get(reactionType) || REACTION_BY_TYPE.get("like");

export const getReactionSummaryLabel = (reactionType) =>
  getReactionOption(reactionType).label;
