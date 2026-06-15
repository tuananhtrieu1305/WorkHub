import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import MemberAvatar from "./MemberAvatar";

const getAnswerValue = (answers, questionId) =>
  answers.find((answer) => answer.questionId === questionId)?.value;

const renderAnswer = (question, value) => {
  if (question.type === "paragraph") {
    return (
      <textarea
        readOnly
        rows={4}
        value={String(value || "")}
        className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none"
        placeholder="Chưa trả lời"
      />
    );
  }

  if (question.type === "multiple_choice") {
    return (
      <div className="mt-2 grid gap-2">
        {(question.options || []).map((option) => {
          const selected =
            String(value || "").toLowerCase() ===
              String(option.label || "").toLowerCase() ||
            String(value || "") === String(option.id || "");

          return (
            <div
              key={option.id || option.label}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ${
                selected
                  ? "bg-violet-50 text-violet-800 ring-violet-200"
                  : "bg-slate-50 text-slate-500 ring-slate-200"
              }`}
            >
              <Icon
                name={selected ? "radio_button_checked" : "radio_button_unchecked"}
              />
              <span className="text-sm font-bold">{option.label}</span>
            </div>
          );
        })}
        {value && !(question.options || []).length && (
          <div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-bold text-violet-800 ring-1 ring-violet-100">
            {String(value)}
          </div>
        )}
      </div>
    );
  }

  if (question.type === "rules") {
    const accepted = value === true || value === "true" || value === "accepted";
    return (
      <div
        className={`mt-2 flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 ${
          accepted
            ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
            : "bg-rose-50 text-rose-800 ring-rose-100"
        }`}
      >
        <Icon name={accepted ? "check_box" : "check_box_outline_blank"} />
        <span className="text-sm font-bold">
          {accepted ? "Đã đồng ý với quy định" : "Chưa xác nhận quy định"}
        </span>
      </div>
    );
  }

  return (
    <input
      readOnly
      value={String(value || "")}
      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none"
      placeholder="Chưa trả lời"
    />
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
    <div className="organization-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={() => !pendingAction && onClose?.()}
        aria-hidden="true"
      />
      <section className="organization-modal-card relative z-10 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-900/18 ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-7">
          <div className="flex min-w-0 items-start gap-4">
            <MemberAvatar member={member} />
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                <Icon name="how_to_reg" />
                Yêu cầu tham gia
              </div>
              <h2 className="mt-4 truncate text-2xl font-black text-slate-950 sm:text-3xl">
                {member.user?.fullName || member.user?.email || "Người dùng"}
              </h2>
              <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                {member.user?.email || "Chưa có email"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(pendingAction)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Đóng"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-13rem)] overflow-y-auto px-6 py-6 sm:px-7">
          {answerQuestions.length ? (
            <div className="grid gap-4">
              {answerQuestions.map((question, index) => {
                const value = getAnswerValue(answers, question.id);

                return (
                  <article
                    key={question.id || `${question.label}-${index}`}
                    className="rounded-3xl bg-white p-4 ring-1 ring-slate-200"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-blue-50 text-sm font-black text-blue-700 ring-1 ring-blue-100">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-950">
                          {question.label || "Câu hỏi"}
                        </p>
                        {question.description && (
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
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

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end sm:px-7">
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(pendingAction)}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => handleReview("reject")}
            disabled={Boolean(pendingAction)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 px-5 py-3 text-sm font-black text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name={pendingAction === "reject" ? "progress_activity" : "close"} />
            Từ chối
          </button>
          <button
            type="button"
            onClick={() => handleReview("approve")}
            disabled={Boolean(pendingAction)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon
              name={pendingAction === "approve" ? "progress_activity" : "check"}
            />
            Duyệt
          </button>
        </div>
      </section>
    </div>
  );
};

export default OrganizationJoinRequestModal;
