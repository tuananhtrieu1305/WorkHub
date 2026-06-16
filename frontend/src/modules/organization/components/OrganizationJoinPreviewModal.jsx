import { useMemo, useState } from "react";
import { getAvatarUrl } from "../../../utils/avatar";
import { getRuleLines } from "../joinQuestionRules";
import { getOrganizationThemeStyle } from "../organizationTheme";
import OrganizationLogo from "./OrganizationLogo";
import Icon from "./Icon";

const getInitialPreviewAnswer = (question) =>
  question.type === "rules" ? false : "";

const getSafeBackgroundUrl = (url = "") =>
  String(url || "").replaceAll('"', "%22");

const renderPreviewControl = (question, value, onChange) => {
  if (question.type === "paragraph") {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder="Nhập câu trả lời của bạn"
        className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    );
  }

  if (question.type === "multiple_choice") {
    return (
      <div className="mt-3 grid gap-2">
        {(question.options || []).map((option) => {
          const selected = value === option.id || value === option.label;

          return (
            <button
              key={option.id || option.label}
              type="button"
              onClick={() => onChange(option.id || option.label)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-bold ring-1 transition hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${
                selected
                  ? "bg-indigo-50 text-indigo-800 ring-indigo-200"
                  : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon
                name={selected ? "radio_button_checked" : "radio_button_unchecked"}
                className={selected ? "text-indigo-600" : "text-slate-400"}
              />
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "rules") {
    const accepted = value === true;
    const rules = getRuleLines(question.description);

    return (
      <div className="mt-4">
        {rules.length > 0 && (
          <ol className="overflow-hidden rounded-xl bg-emerald-50/80 text-emerald-950 ring-1 ring-emerald-100">
            {rules.map((rule, index) => (
              <li
                key={`${index}-${rule}`}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2 border-b border-emerald-100 px-5 py-4 last:border-b-0"
              >
                <span className="font-black text-emerald-600">{index + 1}.</span>
                <span className="text-lg font-semibold leading-8">{rule}</span>
              </li>
            ))}
          </ol>
        )}
        <button
          type="button"
          onClick={() => onChange(!accepted)}
          className="mt-5 inline-flex items-center gap-3 rounded-xl text-left text-lg font-bold text-slate-800 transition hover:text-indigo-700"
        >
          <span
            className={`grid size-8 place-items-center rounded-lg ${
              accepted
                ? "bg-indigo-500 text-white"
                : "bg-white text-slate-400 ring-1 ring-slate-200"
            }`}
          >
            <Icon
              name={accepted ? "check" : "check_box_outline_blank"}
              className="text-2xl leading-none"
            />
          </span>
          Tôi đã đọc và đồng ý với các quy định
        </button>
      </div>
    );
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Nhập câu trả lời của bạn"
      className="mt-3 h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
    />
  );
};

const OrganizationJoinPreviewModal = ({
  accentColor,
  joinMessage,
  onClose,
  open,
  organization,
  questions = [],
}) => {
  const [previewAnswers, setPreviewAnswers] = useState({});
  const previewOrganization = useMemo(
    () => ({
      ...(organization || {}),
      accentColor: accentColor || organization?.accentColor,
    }),
    [accentColor, organization],
  );
  const bannerUrl = getAvatarUrl(previewOrganization?.bannerUrl);
  const themeStyle = getOrganizationThemeStyle(previewOrganization, bannerUrl);
  const displayAccent = previewOrganization?.accentColor || "#2563eb";
  const organizationName = previewOrganization?.name || "tổ chức";
  const memberCount = Number(previewOrganization?.memberCount || 0);
  const onlineCount = Number(previewOrganization?.onlineCount || 0);
  const createdAt = previewOrganization?.createdAt
    ? new Date(previewOrganization.createdAt)
    : null;
  const createdLabel =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? `Thành lập từ ${createdAt.toLocaleDateString("vi-VN", {
          month: "numeric",
          year: "numeric",
        })}`
      : previewOrganization?.description || "Biểu mẫu tham gia của tổ chức";
  const panelBackground = bannerUrl
    ? `linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(248, 250, 252, 0.92)), url("${getSafeBackgroundUrl(
        bannerUrl,
      )}") center / cover`
    : `linear-gradient(135deg, ${displayAccent}, #f472b6 58%, #eff6ff)`;
  const cardBannerBackground = bannerUrl
    ? `linear-gradient(180deg, rgba(0, 0, 0, 0.02), rgba(54, 55, 64, 0.12)), url("${getSafeBackgroundUrl(
        bannerUrl,
      )}") center / cover`
    : `linear-gradient(135deg, ${displayAccent}, #f43f9a)`;

  if (!open) return null;

  const updatePreviewAnswer = (questionId, value) => {
    setPreviewAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: value,
    }));
  };
  const closePreview = () => {
    setPreviewAnswers({});
    onClose?.();
  };

  return (
    <div className="organization-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/62 px-3 py-4 backdrop-blur-sm sm:px-5 sm:py-6">
      <div
        className="absolute inset-0"
        onClick={closePreview}
        aria-hidden="true"
      />
      <section
        className="organization-modal-card relative z-10 grid max-h-[94vh] w-full max-w-[110rem] overflow-hidden rounded-[1.35rem] bg-white text-slate-950 shadow-2xl shadow-slate-900/18 ring-1 ring-slate-200 lg:grid-cols-[minmax(360px,0.36fr)_minmax(620px,0.64fr)]"
        style={themeStyle}
      >
        <aside className="relative hidden min-h-[620px] overflow-hidden p-6 lg:flex lg:items-center lg:justify-center">
          <div
            className="absolute inset-0"
            style={{ background: panelBackground }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-white/20" aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[1.35rem] bg-white/90 shadow-2xl shadow-slate-900/18 ring-1 ring-white/80 backdrop-blur">
            <div
              className="h-44"
              style={{ background: cardBannerBackground }}
              aria-hidden="true"
            />
            <div className="-mt-[3.25rem] px-6 pb-7">
              <OrganizationLogo
                organization={previewOrganization}
                className="size-24"
                labelClassName="text-2xl"
                active
              />
              <h3 className="mt-5 text-2xl font-black text-slate-950">
                {organizationName}
              </h3>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-full bg-emerald-400" />
                  {onlineCount} trực tuyến
                </span>
                <span className="text-slate-400">•</span>
                <span>{memberCount} thành viên</span>
              </p>
              <p className="mt-2 text-base font-semibold text-slate-600">
                {createdLabel}
              </p>
            </div>
          </div>
        </aside>

        <div className="flex max-h-[94vh] min-h-0 flex-col">
          <button
            type="button"
            onClick={closePreview}
            className="absolute right-5 top-5 z-20 grid size-12 place-items-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
            aria-label="Đóng"
          >
            <Icon name="close" className="text-4xl leading-none" />
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-20 sm:px-10 lg:px-16 lg:pb-10 lg:pt-24">
            <div className="max-w-5xl">
              <h2 className="max-w-4xl text-4xl font-medium leading-tight text-slate-950 sm:text-5xl">
                Trả lời một vài câu hỏi để tham gia{" "}
                <span className="font-black">{organizationName}</span>
              </h2>
              <p className="mt-5 max-w-4xl text-lg font-semibold leading-7 text-slate-600">
                {joinMessage ||
                  "Quản trị viên tổ chức sẽ nhanh chóng liên hệ lại với bạn sau khi bạn gửi."}
              </p>

              <form className="mt-12 grid gap-9">
                {questions.length ? (
                  questions.map((question) => (
                    <article key={question.id}>
                      <label className="text-xl font-black text-slate-950">
                        {question.type === "rules"
                          ? "Đồng ý với quy định"
                          : question.label}
                        {question.required && question.type !== "rules" && (
                          <span className="ml-1 text-rose-300">*</span>
                        )}
                      </label>
                      {question.description && question.type !== "rules" && (
                        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                          {question.description}
                        </p>
                      )}
                      {renderPreviewControl(
                        question,
                        previewAnswers[question.id] ??
                          getInitialPreviewAnswer(question),
                        (value) => updatePreviewAnswer(question.id, value),
                      )}
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl bg-blue-50 px-5 py-8 text-center text-base font-black text-blue-700 ring-1 ring-blue-100">
                    Chưa có câu hỏi nào được cấu hình.
                  </div>
                )}
              </form>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-5 sm:px-10 lg:px-16">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <p className="max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Hãy đảm bảo là bạn không nhập mật khẩu hay bất kỳ thông tin nhạy
                cảm nào. Khi đăng ký, bạn cho phép quản trị viên tổ chức nhắn tin
                liên quan đến đơn đăng ký cho bạn.
              </p>
              <button
                type="button"
                disabled
                className="inline-flex min-w-36 items-center justify-center rounded-xl bg-emerald-600 px-8 py-4 text-lg font-black text-white opacity-55"
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OrganizationJoinPreviewModal;
