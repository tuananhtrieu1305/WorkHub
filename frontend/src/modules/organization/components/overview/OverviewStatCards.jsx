import Icon from "../Icon";
import {
  formatDeltaText,
  formatNumber,
  getDeltaColorClass,
  getFallbackStatCards,
} from "./overviewDashboardUtils";

const toneClasses = {
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-100",
};

const OverviewStatCards = ({ overview }) => {
  const cards = overview?.statCards?.length
    ? overview.statCards
    : getFallbackStatCards(overview);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card, index) => {
        const invertDelta = card.key === "pending";
        return (
          <article
            key={card.key}
            className="organization-overview-stat-card rounded-[1.25rem] bg-white p-5 ring-1 ring-slate-200"
            style={{ "--overview-card-index": index }}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={`inline-flex size-12 items-center justify-center rounded-2xl ring-1 ${
                  toneClasses[card.tone] || toneClasses.blue
                }`}
              >
                <Icon name={card.icon} />
              </span>
              <p
                className={`inline-flex items-center gap-1 text-xs font-black ${getDeltaColorClass(
                  card.delta,
                  invertDelta,
                )}`}
              >
                <Icon
                  name={
                    card.delta?.direction === "down"
                      ? "south"
                      : card.delta?.direction === "up"
                        ? "north"
                        : "remove"
                  }
                  className="text-sm leading-none"
                />
                {formatDeltaText(card.delta)}
              </p>
            </div>
            <p className="mt-5 text-4xl font-black tabular-nums text-slate-950">
              {typeof card.value === "number" ? formatNumber(card.value) : card.value}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-600">{card.label}</p>
            <p className="mt-4 text-xs font-bold text-slate-400">{card.detail}</p>
          </article>
        );
      })}
    </div>
  );
};

export default OverviewStatCards;
