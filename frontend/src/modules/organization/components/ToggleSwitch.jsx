const ToggleSwitch = ({
  checked,
  className = "",
  description = "",
  disabled = false,
  label,
  onChange,
}) => {
  const hasText = Boolean(label || description);

  return (
    <button
      type="button"
      onClick={() => !disabled && onChange?.(!checked)}
      disabled={disabled}
      className={`flex items-center gap-4 rounded-2xl px-3 py-2 text-left ring-1 transition focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? "bg-blue-50 text-blue-900 ring-blue-200"
          : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
      } ${hasText ? "justify-between" : "justify-center"} ${className}`}
      aria-pressed={checked}
      aria-label={label || "Bật tắt"}
    >
      {hasText && (
        <span className="min-w-0 flex-1">
          {label && <span className="block text-sm font-black">{label}</span>}
          {description && (
            <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
              {description}
            </span>
          )}
        </span>
      )}
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${
          checked ? "bg-blue-600" : "bg-slate-300"
        }`}
        aria-hidden="true"
      >
        <span
          className={`size-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
};

export default ToggleSwitch;
