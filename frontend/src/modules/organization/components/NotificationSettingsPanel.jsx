import { notificationOptions } from "../organizationUtils";
import Icon from "./Icon";
import SectionShell from "./SectionShell";

const NotificationSettingsPanel = ({
  isLoading,
  notificationSettings,
  onClose,
  onToggle,
  savingKey,
}) => (
  <SectionShell>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xl font-black text-slate-950">Cài đặt thông báo</h2>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200"
      >
        <Icon name="close" className="text-base leading-none" />
        Đóng
      </button>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {isLoading
        ? [0, 1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded-2xl bg-slate-100"
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
  </SectionShell>
);

export default NotificationSettingsPanel;
