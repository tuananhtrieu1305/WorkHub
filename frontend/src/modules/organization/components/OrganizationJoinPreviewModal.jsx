import OrganizationLogo from "./OrganizationLogo";
import Icon from "./Icon";

const renderPreviewControl = (question) => {
  if (question.type === "paragraph") {
    return (
      <textarea
        disabled
        rows={4}
        placeholder="Nhập câu trả lời của bạn"
        className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-400 outline-none"
      />
    );
  }

  if (question.type === "multiple_choice") {
    return (
      <div className="mt-3 grid gap-2">
        {(question.options || []).map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200"
          >
            <span className="grid size-5 place-items-center rounded-full border-2 border-slate-300" />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "rules") {
    return (
      <label className="mt-3 flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 border-emerald-400 bg-white" />
        <span>{question.description || question.label}</span>
      </label>
    );
  }

  return (
    <input
      disabled
      placeholder="Nhập câu trả lời của bạn"
      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-400 outline-none"
    />
  );
};

const OrganizationJoinPreviewModal = ({
  joinMessage,
  onClose,
  open,
  organization,
  questions = [],
}) => {
  if (!open) return null;

  return (
    <div className="organization-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="organization-modal-card grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-200 lg:grid-cols-[0.42fr_0.58fr]">
        <aside className="hidden bg-gradient-to-br from-fuchsia-100 via-blue-50 to-emerald-50 p-6 lg:grid lg:content-center">
          <div className="rounded-[2rem] bg-white/82 p-5 shadow-xl ring-1 ring-white">
            <div className="h-36 rounded-[1.5rem] bg-gradient-to-r from-fuchsia-400 via-rose-300 to-amber-300" />
            <div className="-mt-8 px-4">
              <OrganizationLogo
                organization={organization}
                className="size-16"
                labelClassName="text-lg"
              />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-xl font-black text-slate-950">
                {organization?.name || "Tổ chức"}
              </h3>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {organization?.memberCount || 0} thành viên
              </p>
            </div>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase text-blue-600">
                Xem trước form tham gia
              </p>
              <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950">
                Trả lời một vài câu hỏi để tham gia {organization?.name || "tổ chức"}
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                {joinMessage ||
                  "Quản trị viên sẽ xem câu trả lời của bạn trước khi duyệt yêu cầu."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="mt-8 grid gap-5">
            {questions.length ? (
              questions.map((question, index) => (
                <div key={question.id} className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-blue-600 text-sm font-black text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-slate-900">
                        {question.label}
                        {question.required && (
                          <span className="ml-1 text-rose-500">*</span>
                        )}
                      </p>
                      {question.description && question.type !== "rules" && (
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {question.description}
                        </p>
                      )}
                      {renderPreviewControl(question)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl bg-blue-50 px-4 py-8 text-center text-sm font-black text-blue-700">
                Chưa có câu hỏi nào được cấu hình.
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 rounded-3xl bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">
            <span>Không nhập mật khẩu hoặc thông tin nhạy cảm vào form này.</span>
            <button
              type="button"
              disabled
              className="rounded-2xl bg-emerald-600 px-5 py-3 font-black text-white opacity-80"
            >
              Gửi
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default OrganizationJoinPreviewModal;
