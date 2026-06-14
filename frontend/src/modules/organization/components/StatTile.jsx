import Icon from "./Icon";

const StatTile = ({ icon, value, label, active = false }) => (
  <div
    className={`rounded-2xl px-4 py-3 ring-1 transition ${
      active
        ? "bg-white text-blue-950 ring-blue-100 shadow-sm"
        : "bg-slate-50 text-slate-950 ring-slate-200"
    }`}
  >
    <Icon
      name={icon}
      className={`text-xl leading-none ${active ? "text-blue-600" : "text-slate-500"}`}
    />
    <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
    <p className="text-xs font-bold text-slate-500">{label}</p>
  </div>
);

export default StatTile;
