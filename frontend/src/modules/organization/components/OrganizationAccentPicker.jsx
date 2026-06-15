import {
  normalizeAccentColor,
  organizationAccentPresets,
} from "../organizationTheme";
import Icon from "./Icon";

const OrganizationAccentPicker = ({ disabled = false, onChange, value }) => {
  const selectedColor = normalizeAccentColor(value);

  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-950">
            <Icon name="palette" />
            Giao diện tổ chức
          </h3>
        </div>
        <label className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200">
          <span
            className="size-5 rounded-full ring-2 ring-white"
            style={{ backgroundColor: selectedColor }}
          />
          <input
            type="color"
            value={selectedColor}
            disabled={disabled}
            onChange={(event) => onChange(normalizeAccentColor(event.target.value))}
            className="size-6 border-0 bg-transparent p-0 disabled:opacity-50"
            aria-label="Chọn màu tùy chỉnh"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {organizationAccentPresets.map((preset) => {
          const isSelected = selectedColor === preset.value;

          return (
            <button
              key={preset.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset.value)}
              className={`organization-accent-option flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black ring-1 transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected
                  ? "organization-accent-option-selected bg-white text-slate-950"
                  : "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-white"
              }`}
              style={{ "--accent-option": preset.value }}
              aria-pressed={isSelected}
            >
              <span
                className="size-8 shrink-0 rounded-2xl ring-2 ring-white"
                style={{ backgroundColor: preset.value }}
              />
              <span className="truncate">{preset.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OrganizationAccentPicker;
