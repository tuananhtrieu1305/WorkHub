const ToggleSwitch = ({
  checked,
  className = "",
  description = "",
  disabled = false,
  label,
  onChange,
}) => (
  <button
    type="button"
    onClick={() => !disabled && onChange?.(!checked)}
    disabled={disabled}
    className={`inline-flex items-center gap-3 rounded-2xl px-3 py-2 text-left transition focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 ${
      checked ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-600"
    } ${className}`}
    aria-pressed={checked}
  >
    <span
      className={`relative h-6 w-11 rounded-full transition ${
        checked ? "bg-blue-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </span>
    {label && (
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs font-semibold leading-5 opacity-75">
            {description}
          </span>
        )}
      </span>
    )}
  </button>
);

export default ToggleSwitch;
