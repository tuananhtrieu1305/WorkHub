import Icon from "./Icon";

const OrganizationMetricCard = ({ icon, label, value, tone = "blue", detail }) => {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <article className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex size-11 items-center justify-center rounded-2xl ring-1 ${
            tones[tone] || tones.blue
          }`}
        >
          <Icon name={icon} />
        </span>
        {detail && <span className="text-xs font-black text-slate-400">{detail}</span>}
      </div>
      <p className="mt-5 text-3xl font-black tabular-nums text-slate-950">
        {value ?? 0}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-500">{label}</p>
    </article>
  );
};

export default OrganizationMetricCard;
