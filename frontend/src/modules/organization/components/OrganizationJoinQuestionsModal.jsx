import { useEffect, useMemo } from "react";
import Icon from "./Icon";
import OrganizationLogo from "./OrganizationLogo";

const getInitialAnswer = (question) =>
  question.type === "rules" ? false : "";

const getAnswerIsMissing = (question, answers) => {
  if (!question.required) return false;
  const value = answers?.[question.id];
  if (question.type === "rules") return value !== true;
  return !String(value || "").trim();
};

const OrganizationJoinQuestionsModal = ({
  answers = {},
  isSubmitting = false,
  onChangeAnswer,
  onClose,
  onSubmit,
  open,
  preview,
}) => {
  const organization = preview?.organization;
  const questions = useMemo(
    () => preview?.joinQuestions || [],
    [preview?.joinQuestions],
  );
  const missingRequired = useMemo(
    () => questions.some((question) => getAnswerIsMissing(question, answers)),
    [answers, questions],
  );

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSubmitting) onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose, open]);

  useEffect(() => {
    if (!open) return;
    questions.forEach((question) => {
      if (answers[question.id] === undefined) {
        onChangeAnswer?.(question.id, getInitialAnswer(question));
      }
    });
  }, [answers, onChangeAnswer, open, questions]);

  if (!open || !preview) return null;

  const renderQuestion = (question) => {
    const value = answers[question.id] ?? getInitialAnswer(question);

    if (question.type === "paragraph") {
      return (
        <textarea
          value={value}
          onChange={(event) => onChangeAnswer?.(question.id, event.target.value)}
          rows={4}
          className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
          placeholder="Nhập câu trả lời của bạn"
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
                onClick={() => onChangeAnswer?.(question.id, option.id)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition hover:-translate-y-0.5 ${
                  selected
                    ? "bg-violet-50 text-violet-800 ring-violet-200"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                <Icon
                  name={
                    selected ? "radio_button_checked" : "radio_button_unchecked"
                  }
                />
                <span className="text-sm font-bold">{option.label}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === "rules") {
      return (
        <button
          type="button"
          onClick={() => onChangeAnswer?.(question.id, value !== true)}
          className={`mt-3 flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition hover:-translate-y-0.5 ${
            value === true
              ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
              : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          <Icon name={value === true ? "check_box" : "check_box_outline_blank"} />
          <span className="text-sm font-bold">
            Tôi đã đọc và đồng ý với nội dung trên
          </span>
        </button>
      );
    }

    return (
      <input
        value={value}
        onChange={(event) => onChangeAnswer?.(question.id, event.target.value)}
        className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
        placeholder="Nhập câu trả lời của bạn"
      />
    );
  };

  return (
    <div className="organization-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
      <div
        className="absolute inset-0"
        onClick={() => !isSubmitting && onClose?.()}
        aria-hidden="true"
      />
      <section className="organization-modal-card relative z-10 grid max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-900/18 ring-1 ring-slate-200 lg:grid-cols-[0.45fr_0.55fr]">
        <aside className="hidden bg-gradient-to-br from-fuchsia-100 via-rose-50 to-blue-100 p-6 lg:block">
          <div className="flex h-full min-h-[560px] items-center justify-center rounded-[1.75rem] bg-white/45 p-6 ring-1 ring-white/70">
            <div className="w-full max-w-sm overflow-hidden rounded-[1.75rem] bg-white shadow-xl shadow-rose-200/50 ring-1 ring-slate-200">
              <div
                className="h-36"
                style={{
                  background: `linear-gradient(135deg, ${
                    organization?.accentColor || "#2563eb"
                  }, #f472b6)`,
                }}
              />
              <div className="-mt-9 px-6 pb-6">
                <OrganizationLogo
                  organization={organization}
                  className="size-20"
                  labelClassName="text-xl"
                  active
                />
                <h3 className="mt-5 text-xl font-black text-slate-950">
                  {organization?.name || "Tổ chức"}
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  {organization?.description ||
                    "Gửi câu trả lời để quản trị viên xem xét yêu cầu tham gia."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-slate-600">
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-100">
                    {Number(organization?.memberCount || 0)} thành viên
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700 ring-1 ring-blue-100">
                    Xét duyệt thủ công
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex max-h-[92vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                <Icon name="assignment" />
                Đơn tham gia
              </div>
              <h2 className="mt-4 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                Trả lời vài câu hỏi để tham gia{" "}
                <span className="text-blue-700">
                  {organization?.name || "tổ chức"}
                </span>
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                {preview?.joinMessage ||
                  "Quản trị viên sẽ xem câu trả lời của bạn sau khi gửi."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Đóng"
            >
              <Icon name="close" />
            </button>
          </div>

          <form
            onSubmit={onSubmit}
            className="flex-1 overflow-y-auto px-6 py-6 sm:px-8"
          >
            <div className="grid gap-5">
              {questions.map((question, index) => (
                <article key={question.id} className="rounded-3xl bg-white">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <label className="text-sm font-black text-slate-950">
                        {question.label}
                        {question.required && (
                          <span className="ml-1 text-rose-500">*</span>
                        )}
                      </label>
                      {question.description && (
                        <p className="mt-1 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-800 ring-1 ring-emerald-100">
                          {question.description}
                        </p>
                      )}
                      {renderQuestion(question)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </form>

          <div className="border-t border-slate-100 px-6 py-5 sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <p className="max-w-2xl text-xs font-bold leading-5 text-slate-500">
                Không nhập mật khẩu hoặc thông tin nhạy cảm. Khi gửi, bạn cho phép
                quản trị viên xem câu trả lời để xét duyệt đơn tham gia.
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={missingRequired || isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200/70 transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon name={isSubmitting ? "progress_activity" : "send"} />
                  Gửi
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OrganizationJoinQuestionsModal;
