import { useEffect, useMemo, useState } from "react";
import { getRuleLines } from "../joinQuestionRules";
import { formatDate } from "../organizationUtils";
import Icon from "./Icon";
import MemberAvatar from "./MemberAvatar";

const getAnswerValue = (answers, questionId) =>
  answers.find((answer) => answer.questionId === questionId)?.value;

const questionTypeLabels = {
  multiple_choice: "Lựa chọn",
  paragraph: "Trả lời dài",
  rules: "Quy định",
  short_text: "Trả lời ngắn",
};

const hasAnswerValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (value === true || value === false) return true;
  return String(value ?? "").trim().length > 0;
};

const stringifyAnswer = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return String(value ?? "").trim();
};

const isRuleAccepted = (value) =>
  value === true || value === "true" || value === "accepted";

const isSelectedOption = (value, option) => {
  const values = Array.isArray(value) ? value : [value];
  return values.some((item) => {
    const answer = String(item ?? "").trim().toLowerCase();
    return (
      answer === String(option.label || "").trim().toLowerCase() ||
      answer === String(option.id || "").trim().toLowerCase()
    );
  });
};

const EmptyAnswer = () => (
  <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-500">
    Chưa có câu trả lời
  </div>
);

const renderAnswer = (question, value) => {
  const hasValue = hasAnswerValue(value);

  if (question.type === "paragraph") {
    if (!hasValue) return <EmptyAnswer />;

    return (
      <div className="mt-3 whitespace-pre-wrap break-words rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
        {stringifyAnswer(value)}
      </div>
    );
  }

  if (question.type === "multiple_choice") {
    const options = question.options || [];

    return (
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = isSelectedOption(value, option);

          return (
            <div
              key={option.id || option.label}
              className={`flex min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold ring-1 transition ${
                selected
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : "bg-slate-50 text-slate-500 ring-slate-200"
              }`}
            >
              <Icon
                name={selected ? "radio_button_checked" : "radio_button_unchecked"}
                className="text-xl leading-none"
              />
              <span className="min-w-0 break-words">{option.label}</span>
            </div>
          );
        })}
        {!hasValue && options.length > 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-500 sm:col-span-2">
            Chưa chọn lựa chọn nào
          </div>
        )}
        {hasValue && !options.length && (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100 sm:col-span-2">
            {stringifyAnswer(value)}
          </div>
        )}
        {!hasValue && !options.length && (
          <div className="sm:col-span-2">
            <EmptyAnswer />
          </div>
        )}
      </div>
    );
  }

  if (question.type === "rules") {
    const accepted = isRuleAccepted(value);
    const rules = getRuleLines(question.description);

    return (
      <div className="mt-3">
        {rules.length > 0 && (
          <ol className="overflow-hidden rounded-xl bg-emerald-50/80 text-emerald-950 ring-1 ring-emerald-100">
            {rules.map((rule, index) => (
              <li
                key={`${index}-${rule}`}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2 border-b border-emerald-100 px-4 py-3 last:border-b-0 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:px-5 sm:py-4"
              >
                <span className="font-black text-emerald-600">
                  {index + 1}.
                </span>
                <span className="break-words text-base font-semibold leading-7 text-emerald-950 sm:text-lg sm:leading-8">
                  {rule}
                </span>
              </li>
            ))}
          </ol>
        )}

        <div
          className={`mt-4 flex flex-col gap-3 rounded-2xl px-4 py-3 ring-1 sm:flex-row sm:items-center sm:justify-between ${
            accepted
              ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
              : "bg-rose-50 text-rose-800 ring-rose-100"
          }`}
        >
          <span className="inline-flex min-w-0 items-center gap-3 text-sm font-black sm:text-base">
            <Icon
              name={accepted ? "check_box" : "check_box_outline_blank"}
              className="text-2xl leading-none"
            />
            {accepted
              ? "Ứng viên đã đồng ý với quy định"
              : "Ứng viên chưa xác nhận quy định"}
          </span>
          <span className="w-fit rounded-full bg-white/70 px-3 py-1 text-xs font-black ring-1 ring-inset ring-white/80">
            Bắt buộc
          </span>
        </div>
      </div>
    );
  }

  if (!hasValue) return <EmptyAnswer />;

  return (
    <div className="mt-3 break-words rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
      {stringifyAnswer(value)}
    </div>
  );
};

const OrganizationJoinRequestModal = ({
  member,
  onClose,
  onReview,
  open,
  questions = [],
}) => {
  const [pendingAction, setPendingAction] = useState("");
  const answers = useMemo(() => member?.joinAnswers || [], [member?.joinAnswers]);
  const answerQuestions = useMemo(() => {
    if (questions.length) return questions;

    return answers.map((answer) => ({
      id: answer.questionId,
      label: answer.questionLabel,
      type: answer.questionType || "short_text",
      options: [],
      required: true,
    }));
  }, [answers, questions]);
  const answeredCount = useMemo(
    () =>
      answerQuestions.filter((question) =>
        hasAnswerValue(getAnswerValue(answers, question.id)),
      ).length,
    [answerQuestions, answers],
  );
  const requiredCount = useMemo(
    () => answerQuestions.filter((question) => question.required).length,
    [answerQuestions],
  );
  const missingCount = Math.max(answerQuestions.length - answeredCount, 0);
  const submittedAt =
    formatDate(member?.createdAt || member?.updatedAt || member?.joinedAt) ||
    "Mới gửi";
  const userName = member?.user?.fullName || member?.user?.email || "Người dùng";
  const userEmail = member?.user?.email || "Chưa có email";

  useEffect(() => {
    if (!open) return undefined;
    setPendingAction("");

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !pendingAction) onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, pendingAction]);

  if (!open || !member) return null;

  const handleReview = async (action) => {
    if (pendingAction) return;
    setPendingAction(action);
    try {
      await onReview?.(member, action);
    } finally {
      setPendingAction("");
    }
  };

  return (
    <div className="organization-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-500/25 px-3 py-4 backdrop-blur-sm sm:px-5 sm:py-6">
      <div
        className="absolute inset-0"
        onClick={() => !pendingAction && onClose?.()}
        aria-hidden="true"
      />
      <section
        aria-labelledby="join-request-title"
        aria-modal="true"
        className="organization-modal-card relative z-10 flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] bg-slate-50 shadow-2xl shadow-slate-300/60 ring-1 ring-slate-200"
        role="dialog"
      >
        <header className="relative border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(pendingAction)}
            className="absolute right-4 top-4 inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Đóng"
          >
            <Icon name="close" className="text-2xl leading-none" />
          </button>

          <div className="flex flex-col gap-4 pr-14 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className="rounded-2xl bg-blue-50 p-1 ring-1 ring-blue-100">
                <MemberAvatar member={member} />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                  <Icon name="how_to_reg" className="text-lg leading-none" />
                  Hồ sơ chờ duyệt
                </div>
                <h2
                  id="join-request-title"
                  className="mt-3 break-words text-2xl font-black leading-tight text-slate-800 sm:text-3xl"
                >
                  {userName}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-bold text-slate-500">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Icon name="alternate_email" className="text-lg leading-none" />
                    <span className="min-w-0 break-all">{userEmail}</span>
                  </span>
                  <span className="hidden h-1.5 w-1.5 rounded-full bg-slate-300 sm:inline-block" />
                  <span className="inline-flex items-center gap-2">
                    <Icon name="event" className="text-lg leading-none" />
                    {submittedAt}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200 sm:grid-cols-3 lg:min-w-[360px]">
              <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
                <p className="text-xs font-black text-slate-400">Đã trả lời</p>
                <p className="mt-1 font-mono text-xl font-black text-slate-800 tabular-nums">
                  {answeredCount}/{answerQuestions.length}
                </p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
                <p className="text-xs font-black text-slate-400">Còn thiếu</p>
                <p
                  className={`mt-1 font-mono text-xl font-black tabular-nums ${
                    missingCount ? "text-amber-700" : "text-emerald-700"
                  }`}
                >
                  {missingCount}
                </p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
                <p className="text-xs font-black text-slate-400">Bắt buộc</p>
                <p className="mt-1 font-mono text-xl font-black text-slate-800 tabular-nums">
                  {requiredCount}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {answerQuestions.length ? (
            <div className="grid gap-3">
              {answerQuestions.map((question, index) => {
                const value = getAnswerValue(answers, question.id);
                const typeLabel =
                  questionTypeLabels[question.type] || "Câu trả lời";

                return (
                  <article
                    key={question.id || `${question.label}-${index}`}
                    className="rounded-3xl bg-white p-4 ring-1 ring-slate-200/80"
                  >
                    <div className="grid gap-4 sm:grid-cols-[2.75rem_1fr]">
                      <span className="grid size-10 place-items-center rounded-2xl bg-blue-50 font-mono text-sm font-black text-blue-700 ring-1 ring-blue-100">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-400">
                              Câu hỏi {index + 1}
                            </p>
                            <h3 className="mt-1 break-words text-base font-black leading-snug text-slate-800">
                              {question.label || "Câu hỏi"}
                            </h3>
                          </div>
                          <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                            <Icon
                              name={
                                question.type === "rules"
                                  ? "policy"
                                  : "article"
                              }
                              className="text-base leading-none"
                            />
                            {typeLabel}
                          </span>
                        </div>
                        {question.description && question.type !== "rules" && (
                          <p className="mt-3 break-words text-sm font-semibold leading-6 text-slate-500">
                            {question.description}
                          </p>
                        )}
                        {renderAnswer(question, value)}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid place-items-center gap-2 rounded-3xl border border-dashed border-slate-300 px-4 py-12 text-center">
              <Icon name="question_answer" className="text-4xl text-slate-300" />
              <p className="text-sm font-black text-slate-600">
                Người này chưa gửi câu trả lời nào.
              </p>
            </div>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-semibold text-slate-500">
              Xem lại câu trả lời trước khi cập nhật trạng thái thành viên.
            </p>
            <div className="grid gap-2 sm:grid-cols-3 lg:flex lg:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={Boolean(pendingAction)}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => handleReview("reject")}
                disabled={Boolean(pendingAction)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 px-5 py-3 text-sm font-black text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon
                  name={
                    pendingAction === "reject" ? "progress_activity" : "close"
                  }
                  className={`text-xl leading-none ${
                    pendingAction === "reject" ? "animate-spin" : ""
                  }`}
                />
                Từ chối
              </button>
              <button
                type="button"
                onClick={() => handleReview("approve")}
                disabled={Boolean(pendingAction)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon
                  name={
                    pendingAction === "approve" ? "progress_activity" : "check"
                  }
                  className={`text-xl leading-none ${
                    pendingAction === "approve" ? "animate-spin" : ""
                  }`}
                />
                Duyệt
              </button>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default OrganizationJoinRequestModal;
