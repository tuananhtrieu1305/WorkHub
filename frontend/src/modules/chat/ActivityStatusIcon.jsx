const sizeClasses = {
  xs: {
    dot: "h-2 w-2",
    ring: "h-2.5 w-2.5 border-[1.5px]",
    iconContainer: "h-2 w-2",
    symbolSize: "8px",
  },
  sm: {
    dot: "h-2.5 w-2.5",
    ring: "h-3 w-3 border-2",
    iconContainer: "h-2.5 w-2.5",
    symbolSize: "10px",
  },
  md: {
    dot: "h-3.5 w-3.5",
    ring: "h-4 w-4 border-2",
    iconContainer: "h-3.5 w-3.5",
    symbolSize: "14px",
  },
};

const ActivityStatusIcon = ({ meta, size = "sm", className = "" }) => {
  const classes = sizeClasses[size] || sizeClasses.sm;

  if (meta.value === "online") {
    return (
      <span
        className={`inline-flex rounded-full bg-emerald-500 ${classes.dot} ${className}`}
      />
    );
  }

  if (meta.value === "invisible" || meta.value === "offline") {
    return (
      <span
        className={`inline-flex rounded-full border-slate-400 bg-white ${classes.ring} ${className}`}
      />
    );
  }

  // idle and dnd: render icon inside a container that matches the online dot size
  return (
    <span
      className={`inline-flex items-center justify-center ${classes.iconContainer} ${className}`}
    >
      <span
        style={{ fontSize: classes.symbolSize, fontVariationSettings: '"FILL" 1' }}
        className={`material-symbols-outlined activity-status-symbol leading-none ${meta.menuIconClassName}`}
      >
        {meta.icon}
      </span>
    </span>
  );
};

export default ActivityStatusIcon;
