import { notificationOptions } from "../organizationUtils";
import Icon from "./Icon";
import { SkeletonBlock } from "../../../components/common/Skeleton";

const NotificationSettingsPanel = ({
  isLoading,
  notificationSettings,
  onToggle,
  savingKey,
}) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {isLoading
      ? [0, 1, 2, 3, 4, 5].map((item) => (
          <SkeletonBlock
            key={item}
            className="h-16 rounded-2xl"
          />
        ))
      : notificationOptions.map(([key, label, icon]) => {
          const enabled = Boolean(notificationSettings?.[key]);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              disabled={!notificationSettings || savingKey === key}
              className={`flex items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left ring-1 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
                enabled
                  ? "bg-blue-50 text-blue-800 ring-blue-100"
                  : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon name={icon} />
                <span className="truncate text-sm font-black">{label}</span>
              </span>
              <span
                className={`h-6 w-11 rounded-full p-1 transition ${
                  enabled ? "bg-blue-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`block size-4 rounded-full bg-white transition ${
                    enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          );
        })}
  </div>
);

export default NotificationSettingsPanel;
