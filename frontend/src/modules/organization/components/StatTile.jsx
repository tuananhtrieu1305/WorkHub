import Icon from "./Icon";

const toneClasses = {
  amber: {
    surface:
      "bg-amber-100/95 text-amber-950 ring-amber-300 shadow-amber-300/45",
    icon: "text-amber-700",
    label: "text-amber-800",
  },
  blue: {
    surface: "bg-blue-100/95 text-blue-950 ring-blue-300 shadow-blue-300/45",
    icon: "text-blue-700",
    label: "text-blue-800",
  },
  emerald: {
    surface:
      "bg-emerald-100/95 text-emerald-950 ring-emerald-300 shadow-emerald-300/45",
    icon: "text-emerald-700",
    label: "text-emerald-800",
  },
  rose: {
    surface: "bg-rose-100/95 text-rose-950 ring-rose-300 shadow-rose-300/45",
    icon: "text-rose-700",
    label: "text-rose-800",
  },
  sky: {
    surface: "bg-sky-100/95 text-sky-950 ring-sky-300 shadow-sky-300/45",
    icon: "text-sky-700",
    label: "text-sky-800",
  },
  violet: {
    surface:
      "bg-violet-100/95 text-violet-950 ring-violet-300 shadow-violet-300/45",
    icon: "text-violet-700",
    label: "text-violet-800",
  },
};

const fallbackTone = {
  surface: "bg-slate-100 text-slate-950 ring-slate-300 shadow-slate-300/30",
  icon: "text-slate-500",
  label: "text-slate-500",
};

const StatTile = ({
  icon,
  value,
  label,
  meta,
  active = false,
  tone = "",
  valueClassName = "text-2xl",
}) => {
  const classes = toneClasses[tone] || (active ? toneClasses.blue : fallbackTone);

  return (
    <div
      className={`flex h-full min-h-[6.75rem] flex-col rounded-2xl px-4 py-3 shadow-sm ring-1 transition duration-200 hover:-translate-y-0.5 ${classes.surface}`}
    >
      <Icon
        name={icon}
        className={`text-xl leading-none ${classes.icon}`}
      />
      <p className={`mt-2 break-words font-black tabular-nums ${valueClassName}`}>
        {value}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <p className={`text-xs font-bold ${classes.label}`}>{label}</p>
        {meta && (
          <span className="rounded-lg bg-white/78 px-2 py-0.5 text-[11px] font-black text-slate-800 ring-1 ring-white/90">
            {meta}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatTile;
