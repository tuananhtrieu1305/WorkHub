import { useMemo } from "react";
import { hasPermission } from "../organizationUtils";
import Icon from "./Icon";
import OrganizationAccentPicker from "./OrganizationAccentPicker";
import ToggleSwitch from "./ToggleSwitch";

const questionTypes = [
  {
    type: "short_text",
    label: "Trả lời ngắn",
    description: "Một dòng trả lời súc tích.",
    icon: "short_text",
    className: "bg-blue-50 text-blue-700 ring-blue-100",
    iconClassName: "bg-white text-blue-700 ring-blue-100",
  },
  {
    type: "paragraph",
    label: "Đoạn",
    description: "Câu trả lời dài hơn theo đoạn văn.",
    icon: "notes",
    className: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    iconClassName: "bg-white text-cyan-700 ring-cyan-100",
  },
  {
    type: "multiple_choice",
    label: "Nhiều lựa chọn",
    description: "Chọn một đáp án trong danh sách.",
    icon: "format_list_bulleted",
    className: "bg-violet-50 text-violet-700 ring-violet-100",
    iconClassName: "bg-white text-violet-700 ring-violet-100",
  },
  {
    type: "rules",
    label: "Quy định máy chủ",
    description: "Checkbox xác nhận đã đọc quy định.",
    icon: "rule",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    iconClassName: "bg-white text-emerald-700 ring-emerald-100",
  },
];

const exampleQuestions = [
  "Bạn có chơi trò chơi nào giống với chúng tôi không?",
  "Bạn tìm thấy chúng tôi bằng cách nào?",
  "Đâu là điểm độc nhất vô nhị của bạn?",
];

const createId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const buildQuestion = (type = "short_text", label = "") => ({
  id: createId("question"),
  type,
  label:
    label ||
    (type === "rules"
      ? "Tôi đã đọc và đồng ý với quy định của tổ chức"
      : "Tại sao bạn muốn tham gia tổ chức của chúng tôi?"),
  description:
    type === "rules"
      ? "Hãy đảm bảo bạn hiểu quy định trước khi gửi yêu cầu tham gia."
      : "",
  required: true,
  options:
    type === "multiple_choice"
      ? [
          { id: createId("option"), label: "Lựa chọn A" },
          { id: createId("option"), label: "Lựa chọn B" },
        ]
      : [],
});

const OrganizationAdvancedSection = ({
  form,
  isLeaving,
  isSaving,
  members = [],
  onChange,
  onLeave,
  onOpenJoinPreview,
  onOpenTransferOwner,
  onSubmit,
  organization,
  roles,
}) => {
  const canManageSettings = hasPermission(organization, "manageSettings");
  const canManageAppearance = hasPermission(organization, "manageOrganization");
  const canLeave = organization?.role !== "owner";
  const canTransferOwner = organization?.role === "owner";
  const questions = form?.joinQuestions || [];
  const eligibleTransferMembers = useMemo(
    () =>
      members.filter(
        (member) => member.status === "active" && member.role !== "owner",
      ),
    [members],
  );

  const updateForm = (updates) => onChange({ ...(form || {}), ...updates });
  const updateQuestion = (questionId, updates) => {
    updateForm({
      joinQuestions: questions.map((question) =>
        question.id === questionId ? { ...question, ...updates } : question,
      ),
    });
  };
  const addQuestion = (type = "short_text", label = "") => {
    if (questions.length >= 5) return;
    updateForm({ joinQuestions: [...questions, buildQuestion(type, label)] });
  };
  const removeQuestion = (questionId) => {
    updateForm({
      joinQuestions: questions.filter((question) => question.id !== questionId),
    });
  };
  const addOption = (question) => {
    updateQuestion(question.id, {
      options: [
        ...(question.options || []),
        {
          id: createId("option"),
          label: `Lựa chọn ${(question.options || []).length + 1}`,
        },
      ],
    });
  };
  const updateOption = (question, optionId, label) => {
    updateQuestion(question.id, {
      options: (question.options || []).map((option) =>
        option.id === optionId ? { ...option, label } : option,
      ),
    });
  };
  const removeOption = (question, optionId) => {
    updateQuestion(question.id, {
      options: (question.options || []).filter((option) => option.id !== optionId),
    });
  };
  const changeQuestionType = (question, nextType) => {
    updateQuestion(question.id, {
      type: nextType,
      description:
        nextType === "rules" && !question.description
          ? "Hãy đảm bảo bạn hiểu quy định trước khi gửi yêu cầu tham gia."
          : question.description,
      options:
        nextType === "multiple_choice"
          ? question.options?.length
            ? question.options
            : buildQuestion("multiple_choice").options
          : [],
    });
  };

  return (
    <section className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <OrganizationAccentPicker
            disabled={!canManageAppearance}
            onChange={(accentColor) => updateForm({ accentColor })}
            value={form?.accentColor || organization?.accentColor}
          />

          <form
            onSubmit={onSubmit}
            className="rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-200"
          >
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                <Icon name="tune" />
                Cài đặt chung
              </h2>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                Điều khiển lời mời, vai trò mặc định và dữ liệu thành viên.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <ToggleSwitch
                checked={Boolean(form?.allowMemberInvites)}
                disabled={!canManageSettings}
                label="Thành viên tạo lời mời"
                onChange={(checked) => updateForm({ allowMemberInvites: checked })}
              />
              <ToggleSwitch
                checked={Boolean(form?.memberDirectoryVisible)}
                disabled={!canManageSettings}
                label="Hiển thị danh bạ"
                onChange={(checked) =>
                  updateForm({ memberDirectoryVisible: checked })
                }
              />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">
                  Vai trò mặc định
                </span>
                <select
                  value={form?.defaultRoleKey || "member"}
                  disabled={!canManageSettings}
                  onChange={(event) =>
                    updateForm({ defaultRoleKey: event.target.value })
                  }
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {(roles || [])
                    .filter((role) => role.key !== "owner")
                    .map((role) => (
                      <option key={role.key} value={role.key}>
                        {role.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-black uppercase text-slate-500">
                  Lời nhắn khi tham gia
                </span>
                <textarea
                  value={form?.joinMessage || ""}
                  disabled={!canManageSettings}
                  onChange={(event) => updateForm({ joinMessage: event.target.value })}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                  placeholder="Thông tin hiển thị cho người gửi yêu cầu tham gia"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={(!canManageSettings && !canManageAppearance) || isSaving}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name={isSaving ? "progress_activity" : "save"} />
                Lưu cài đặt
              </button>
            </div>
          </form>
        </div>

        <aside className="grid content-start gap-5">
          <div className="rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-200">
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-950">
              <Icon name="lock" />
              Quyền hiện tại
            </h3>
            <div className="mt-4 grid gap-2">
              {Object.entries(organization?.permissions || {}).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2"
                >
                  <span className="truncate text-xs font-black text-slate-600">
                    {key}
                  </span>
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      value ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <form
        onSubmit={onSubmit}
        className="overflow-hidden rounded-[2rem] bg-white ring-1 ring-slate-200"
      >
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
              <Icon name="fact_check" />
              Yêu cầu duyệt khi tham gia
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
              Tạo tối đa 5 câu hỏi để người muốn tham gia trả lời trước khi gửi yêu cầu.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ToggleSwitch
              checked={Boolean(form?.requireApproval)}
              disabled={!canManageSettings}
              label="Bật duyệt"
              onChange={(checked) => updateForm({ requireApproval: checked })}
            />
            <button
              type="button"
              onClick={onOpenJoinPreview}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 ring-1 ring-indigo-100 transition hover:-translate-y-0.5 hover:bg-indigo-100 active:translate-y-0 active:scale-[0.98]"
            >
              <Icon name="open_in_new" />
              Xem trước
            </button>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {questionTypes.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => addQuestion(item.type)}
                disabled={!canManageSettings || questions.length >= 5}
                className={`group flex min-h-[88px] items-start gap-3 rounded-2xl p-4 text-left ring-1 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${item.className}`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-2xl ring-1 ${item.iconClassName}`}
                >
                  <Icon name={item.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black leading-5">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs font-bold leading-5 opacity-80">
                    {item.description}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[1.5rem] bg-slate-50/80 p-4 ring-1 ring-slate-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-black uppercase text-slate-500">
                Câu hỏi ({questions.length}/5)
              </p>
              <p className="text-xs font-bold text-slate-400">
                Kéo gọn nội dung trong từng dòng, phần tùy chọn sẽ mở bên dưới.
              </p>
            </div>

            <div className="mt-3 grid gap-3">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className="rounded-[1.35rem] bg-white p-3 ring-1 ring-slate-200"
                >
                  <div className="grid gap-3 xl:grid-cols-[52px_minmax(160px,220px)_minmax(280px,1fr)_auto] xl:items-center">
                    <div className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-sm font-black text-blue-700 ring-1 ring-blue-100">
                      {index + 1}
                    </div>
                    <select
                      value={question.type}
                      disabled={!canManageSettings}
                      onChange={(event) =>
                        changeQuestionType(question, event.target.value)
                      }
                      className="h-11 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                    >
                      {questionTypes.map((item) => (
                        <option key={item.type} value={item.type}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={question.label}
                      disabled={!canManageSettings}
                      onChange={(event) =>
                        updateQuestion(question.id, {
                          label: event.target.value,
                        })
                      }
                      className="h-11 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                      placeholder="Nội dung câu hỏi"
                    />
                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuestion(question.id, {
                            required: !question.required,
                          })
                        }
                        disabled={!canManageSettings}
                        className={`inline-flex h-10 items-center rounded-2xl px-3 text-xs font-black ring-1 transition ${
                          question.required
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            : "bg-slate-100 text-slate-500 ring-slate-200"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {question.required ? "Bắt buộc" : "Tùy chọn"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(question.id)}
                        disabled={!canManageSettings}
                        className="grid size-10 place-items-center rounded-2xl bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Xóa câu hỏi"
                        title="Xóa câu hỏi"
                      >
                        <Icon name="delete" />
                      </button>
                    </div>
                  </div>

                  {question.type === "rules" && (
                    <textarea
                      value={question.description || ""}
                      disabled={!canManageSettings}
                      onChange={(event) =>
                        updateQuestion(question.id, {
                          description: event.target.value,
                        })
                      }
                      rows={3}
                      className="mt-3 w-full resize-none rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100"
                      placeholder="Nhập quy định hoặc điều khoản cần xác nhận"
                    />
                  )}

                  {question.type === "multiple_choice" && (
                    <div className="mt-3 grid gap-2">
                      {(question.options || []).map((option) => (
                        <div
                          key={option.id}
                          className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200"
                        >
                          <Icon
                            name="radio_button_unchecked"
                            className="text-slate-400"
                          />
                          <input
                            value={option.label}
                            disabled={!canManageSettings}
                            onChange={(event) =>
                              updateOption(question, option.id, event.target.value)
                            }
                            className="h-9 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none disabled:text-slate-400"
                            placeholder="Nhãn lựa chọn"
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(question, option.id)}
                            disabled={!canManageSettings || question.options.length <= 1}
                            className="grid size-8 place-items-center rounded-xl text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Xóa lựa chọn"
                            title="Xóa lựa chọn"
                          >
                            <Icon name="close" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(question)}
                        disabled={!canManageSettings || question.options?.length >= 10}
                        className="inline-flex w-fit items-center gap-2 rounded-2xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Icon name="add" />
                        Thêm lựa chọn
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {!questions.length && (
                <div className="grid place-items-center gap-2 rounded-[1.35rem] border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
                  <Icon name="add_comment" className="text-4xl text-slate-300" />
                  <p className="text-sm font-black text-slate-600">
                    Chưa có câu hỏi duyệt tham gia.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] bg-white p-4 ring-1 ring-slate-200">
            <p className="text-xs font-black uppercase text-slate-500">
              Câu hỏi ví dụ
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {exampleQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => addQuestion("short_text", question)}
                  disabled={!canManageSettings || questions.length >= 5}
                  className="rounded-full bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs font-bold leading-5 text-slate-500">
            Form này sẽ hiển thị cho người dùng trước khi họ gửi yêu cầu tham gia.
          </p>
          <button
            type="submit"
            disabled={!canManageSettings || isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name={isSaving ? "progress_activity" : "save"} />
            Lưu form duyệt
          </button>
        </div>
      </form>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[1.75rem] bg-amber-50 p-5 ring-1 ring-amber-100">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black text-amber-900">
                <Icon name="workspace_premium" />
                Chuyển quyền sở hữu
              </h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">
                Chọn một thành viên đang hoạt động để trở thành chủ sở hữu mới.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenTransferOwner}
              disabled={!canTransferOwner || !eligibleTransferMembers.length}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="swap_horiz" />
              Chuyển quyền
            </button>
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-red-50 p-5 ring-1 ring-red-100">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black text-red-800">
                <Icon name="logout" />
                Rời tổ chức
              </h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-red-700">
                Chủ sở hữu không thể rời tổ chức cho đến khi chuyển quyền sở hữu.
              </p>
            </div>
            <button
              type="button"
              onClick={onLeave}
              disabled={!canLeave || isLeaving}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Icon name={isLeaving ? "progress_activity" : "exit_to_app"} />
              Rời tổ chức
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OrganizationAdvancedSection;
