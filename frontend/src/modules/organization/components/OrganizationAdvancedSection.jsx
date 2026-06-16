import { useMemo, useState } from "react";
import {
  buildRulesDescription,
  defaultServerRules,
  getEditableRuleLines,
  getRuleLines,
} from "../joinQuestionRules";
import { hasPermission } from "../organizationUtils";
import Icon from "./Icon";
import OrganizationAccentPicker from "./OrganizationAccentPicker";
import ToggleSwitch from "./ToggleSwitch";

const questionTypes = [
  {
    type: "short_text",
    label: "Câu Trả Lời Ngắn",
    shortLabel: "Trả lời ngắn",
    description: "Một dòng trả lời súc tích.",
    icon: "short_text",
  },
  {
    type: "paragraph",
    label: "Đoạn Văn",
    shortLabel: "Đoạn",
    description: "Câu trả lời dài hơn theo đoạn văn.",
    icon: "notes",
  },
  {
    type: "multiple_choice",
    label: "Nhiều Lựa Chọn",
    shortLabel: "Nhiều lựa chọn",
    description: "Chọn một đáp án trong danh sách.",
    icon: "format_list_bulleted",
  },
  {
    type: "rules",
    label: "Quy Định Máy Chủ",
    shortLabel: "Quy định",
    description: "Checkbox xác nhận đã đọc quy định.",
    icon: "rule",
  },
];

const exampleQuestions = [
  "Bạn có chơi trò chơi nào giống với chúng tôi không?",
  "Bạn tìm thấy chúng tôi bằng cách nào?",
  "Đâu là điểm độc nhất vô nhị của bạn?",
];

const ruleExamples = [
  "Lịch sự và văn minh",
  "Không spam hoặc tự quảng bá bản thân",
  "Không có giới hạn độ tuổi hoặc nội dung phản cảm",
  "Giúp đảm bảo môi trường lành mạnh",
];

const createId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const getQuestionType = (type) =>
  questionTypes.find((item) => item.type === type) || questionTypes[0];

const buildQuestion = (type = "short_text", label = "") => {
  const isRules = type === "rules";

  return {
    id: createId("question"),
    type,
    label:
      label ||
      (isRules
        ? "Đọc và đồng ý với các Quy Định Máy Chủ"
        : "Tại sao bạn muốn tham gia tổ chức của chúng tôi?"),
    description: isRules ? buildRulesDescription(defaultServerRules) : "",
    required: true,
    options:
      type === "multiple_choice"
        ? [
            { id: createId("option"), label: "Lựa chọn A" },
            { id: createId("option"), label: "Lựa chọn B" },
          ]
        : [],
  };
};

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
  const [draggingQuestionId, setDraggingQuestionId] = useState("");
  const [expandedQuestionId, setExpandedQuestionId] = useState("");
  const [rulesEditorQuestionId, setRulesEditorQuestionId] = useState("");
  const [rulesDraft, setRulesDraft] = useState(defaultServerRules);
  const [draggingRuleIndex, setDraggingRuleIndex] = useState(null);
  const canManageSettings = hasPermission(organization, "manageSettings");
  const canManageAppearance = hasPermission(organization, "manageOrganization");
  const canLeave = organization?.role !== "owner";
  const canTransferOwner = organization?.role === "owner";
  const questions = useMemo(
    () => form?.joinQuestions || [],
    [form?.joinQuestions],
  );
  const eligibleTransferMembers = useMemo(
    () =>
      members.filter(
        (member) => member.status === "active" && member.role !== "owner",
      ),
    [members],
  );
  const activeRulesQuestion = useMemo(
    () => questions.find((question) => question.id === rulesEditorQuestionId),
    [questions, rulesEditorQuestionId],
  );
  const rulesDraftHasContent = rulesDraft.some((rule) =>
    String(rule || "").trim(),
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
    const nextQuestion = buildQuestion(type, label);
    updateForm({ joinQuestions: [...questions, nextQuestion] });

    if (type === "rules") {
      setRulesEditorQuestionId(nextQuestion.id);
      setRulesDraft(getEditableRuleLines(nextQuestion.description));
      setExpandedQuestionId("");
      return;
    }

    setExpandedQuestionId(nextQuestion.id);
  };
  const removeQuestion = (questionId) => {
    updateForm({
      joinQuestions: questions.filter((question) => question.id !== questionId),
    });
    if (expandedQuestionId === questionId) setExpandedQuestionId("");
    if (rulesEditorQuestionId === questionId) setRulesEditorQuestionId("");
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
    const nextRulesDescription =
      question.description || buildRulesDescription(defaultServerRules);

    updateQuestion(question.id, {
      type: nextType,
      label:
        nextType === "rules" && question.type !== "rules"
          ? "Đọc và đồng ý với các Quy Định Máy Chủ"
          : question.label,
      description: nextType === "rules" ? nextRulesDescription : question.description,
      options:
        nextType === "multiple_choice"
          ? question.options?.length
            ? question.options
            : buildQuestion("multiple_choice").options
          : [],
    });

    if (nextType === "rules") {
      setExpandedQuestionId("");
      setRulesEditorQuestionId(question.id);
      setRulesDraft(getEditableRuleLines(nextRulesDescription));
      return;
    }

    setExpandedQuestionId(question.id);
  };
  const moveQuestion = (sourceQuestionId, targetQuestionId) => {
    if (
      !canManageSettings ||
      !sourceQuestionId ||
      !targetQuestionId ||
      sourceQuestionId === targetQuestionId
    ) {
      return;
    }

    const sourceIndex = questions.findIndex(
      (question) => question.id === sourceQuestionId,
    );
    const targetIndex = questions.findIndex(
      (question) => question.id === targetQuestionId,
    );
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextQuestions = [...questions];
    const [movedQuestion] = nextQuestions.splice(sourceIndex, 1);
    nextQuestions.splice(targetIndex, 0, movedQuestion);
    updateForm({ joinQuestions: nextQuestions });
  };
  const openQuestionEditor = (question) => {
    if (question.type === "rules") {
      setRulesEditorQuestionId(question.id);
      setRulesDraft(getEditableRuleLines(question.description));
      setExpandedQuestionId("");
      return;
    }

    setExpandedQuestionId((currentId) =>
      currentId === question.id ? "" : question.id,
    );
  };
  const updateRuleDraft = (index, value) => {
    setRulesDraft((currentRules) =>
      currentRules.map((rule, ruleIndex) =>
        ruleIndex === index ? value : rule,
      ),
    );
  };
  const addRuleDraft = (value = "") => {
    setRulesDraft((currentRules) => [...currentRules, value]);
  };
  const removeRuleDraft = (index) => {
    setRulesDraft((currentRules) =>
      currentRules.filter((_, ruleIndex) => ruleIndex !== index),
    );
  };
  const moveRuleDraft = (sourceIndex, targetIndex) => {
    if (
      sourceIndex === null ||
      targetIndex === null ||
      sourceIndex === targetIndex ||
      sourceIndex < 0 ||
      targetIndex < 0
    ) {
      return;
    }

    setRulesDraft((currentRules) => {
      const nextRules = [...currentRules];
      const [movedRule] = nextRules.splice(sourceIndex, 1);
      nextRules.splice(targetIndex, 0, movedRule);
      return nextRules;
    });
  };
  const closeRulesEditor = () => {
    setRulesEditorQuestionId("");
    setRulesDraft(defaultServerRules);
    setDraggingRuleIndex(null);
  };
  const saveRulesEditor = () => {
    if (!activeRulesQuestion || !rulesDraftHasContent) return;
    updateQuestion(activeRulesQuestion.id, {
      description: buildRulesDescription(rulesDraft),
      label:
        activeRulesQuestion.label?.trim() ||
        "Đọc và đồng ý với các Quy Định Máy Chủ",
      required: true,
    });
    closeRulesEditor();
  };

  return (
    <>
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
                    onChange={(event) =>
                      updateForm({ joinMessage: event.target.value })
                    }
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
          className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200"
        >
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                <Icon name="fact_check" />
                Yêu cầu duyệt khi tham gia
              </h2>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                Tạo tối đa 5 câu hỏi để người muốn tham gia trả lời trước khi gửi
                yêu cầu.
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Câu hỏi ({questions.length}/5)
              </p>
              <p className="text-xs font-bold text-slate-400">
                Kéo tay nắm bên trái để thay đổi thứ tự hiển thị.
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              {questions.map((question, index) => {
                const typeMeta = getQuestionType(question.type);
                const isExpanded = expandedQuestionId === question.id;
                const ruleCount = getRuleLines(question.description).length;

                return (
                  <article
                    key={question.id}
                    onDragOver={(event) => {
                      if (draggingQuestionId && draggingQuestionId !== question.id) {
                        event.preventDefault();
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceQuestionId =
                        event.dataTransfer.getData("application/x-question-id") ||
                        event.dataTransfer.getData("text/plain") ||
                        draggingQuestionId;
                      moveQuestion(sourceQuestionId, question.id);
                      setDraggingQuestionId("");
                    }}
                    className={`rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-3 transition ${
                      draggingQuestionId === question.id
                        ? "scale-[0.99] opacity-60"
                        : "hover:border-blue-200 hover:bg-blue-50/40"
                    }`}
                  >
                    <div className="grid gap-3 xl:grid-cols-[28px_minmax(280px,1fr)_220px_auto] xl:items-center">
                      <span
                        draggable={canManageSettings}
                        onDragStart={(event) => {
                          if (!canManageSettings) return;
                          setDraggingQuestionId(question.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "application/x-question-id",
                            question.id,
                          );
                          event.dataTransfer.setData("text/plain", question.id);
                        }}
                        onDragEnd={() => setDraggingQuestionId("")}
                        className="grid size-7 cursor-grab place-items-center rounded-xl text-slate-400 transition hover:bg-blue-50 hover:text-blue-700 active:cursor-grabbing"
                        title="Kéo để đổi thứ tự"
                      >
                        <Icon name="drag_indicator" className="text-2xl leading-none" />
                      </span>

                      <label className="min-w-0">
                        <span className="sr-only">Nội dung câu hỏi {index + 1}</span>
                        <input
                          value={question.label}
                          disabled={!canManageSettings}
                          onChange={(event) =>
                            updateQuestion(question.id, {
                              label: event.target.value,
                            })
                          }
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-black text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                          placeholder="Nội dung câu hỏi"
                        />
                      </label>

                      <label className="relative min-w-0">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <Icon name={typeMeta.icon} />
                        </span>
                        <select
                          value={question.type}
                          disabled={!canManageSettings}
                          onChange={(event) =>
                            changeQuestionType(question, event.target.value)
                          }
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {questionTypes.map((item) => (
                            <option
                              key={item.type}
                              value={item.type}
                              className="bg-white text-slate-900"
                            >
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex items-center gap-2 xl:justify-end">
                        <button
                          type="button"
                          onClick={() => openQuestionEditor(question)}
                          disabled={!canManageSettings}
                          className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:bg-blue-100 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={
                            question.type === "rules"
                              ? "Sửa nội quy"
                              : "Sửa cấu hình câu hỏi"
                          }
                          title={
                            question.type === "rules"
                              ? "Sửa nội quy"
                              : "Sửa cấu hình câu hỏi"
                          }
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeQuestion(question.id)}
                          disabled={!canManageSettings}
                          className="grid size-11 place-items-center rounded-2xl bg-rose-50 text-rose-700 ring-1 ring-rose-100 transition hover:-translate-y-0.5 hover:bg-rose-100 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Xóa câu hỏi"
                          title="Xóa câu hỏi"
                        >
                          <Icon name="delete" />
                        </button>
                      </div>
                    </div>

                    {question.type === "rules" && (
                      <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm font-bold text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
                        <span className="inline-flex items-center gap-2">
                          <Icon name="rule" />
                          {ruleCount || defaultServerRules.length} nội quy đang được
                          hiển thị trong preview
                        </span>
                        <button
                          type="button"
                          onClick={() => openQuestionEditor(question)}
                          disabled={!canManageSettings}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Icon name="edit" className="text-base leading-none" />
                          Tạo nội quy
                        </button>
                      </div>
                    )}

                    {question.type !== "rules" && isExpanded && (
                      <div className="mt-3 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start">
                          <label className="min-w-0 flex-1">
                            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                              Mô tả câu hỏi
                            </span>
                            <textarea
                              value={question.description || ""}
                              disabled={!canManageSettings}
                              onChange={(event) =>
                                updateQuestion(question.id, {
                                  description: event.target.value,
                                })
                              }
                              rows={2}
                              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                              placeholder="Mô tả ngắn hiển thị dưới câu hỏi (tuỳ chọn)"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuestion(question.id, {
                                required: !question.required,
                              })
                            }
                            disabled={!canManageSettings}
                            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black ring-1 transition md:mt-7 ${
                              question.required
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                                : "bg-slate-100 text-slate-500 ring-slate-200"
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            <Icon
                              name={
                                question.required
                                  ? "check_box"
                                  : "check_box_outline_blank"
                              }
                            />
                            {question.required ? "Bắt buộc" : "Tùy chọn"}
                          </button>
                        </div>

                        {question.type === "multiple_choice" && (
                          <div className="grid gap-2">
                            {(question.options || []).map((option) => (
                              <div
                                key={option.id}
                                className="flex items-center gap-2 rounded-2xl bg-violet-50/70 px-3 py-2 ring-1 ring-violet-100"
                              >
                                <Icon
                                  name="radio_button_unchecked"
                                  className="text-slate-400"
                                />
                                <input
                                  value={option.label}
                                  disabled={!canManageSettings}
                                  onChange={(event) =>
                                    updateOption(
                                      question,
                                      option.id,
                                      event.target.value,
                                    )
                                  }
                                  className="h-9 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400 disabled:text-slate-400"
                                  placeholder="Nhãn lựa chọn"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOption(question, option.id)}
                                  disabled={
                                    !canManageSettings || question.options.length <= 1
                                  }
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
                              disabled={
                                !canManageSettings || question.options?.length >= 10
                              }
                              className="inline-flex w-fit items-center gap-2 rounded-2xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 ring-1 ring-violet-100 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Icon name="add" />
                              Thêm lựa chọn
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

              <button
                type="button"
                onClick={() => addQuestion("short_text")}
                disabled={!canManageSettings || questions.length >= 5}
                className="inline-flex min-h-20 items-center justify-center gap-3 rounded-[1.35rem] border border-dashed border-slate-300 bg-white px-4 py-4 text-lg font-black text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Icon name="add" className="text-3xl leading-none" />
                Thêm câu hỏi
              </button>
            </div>

            <div className="mt-6">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
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
                <button
                  type="button"
                  onClick={() => addQuestion("rules")}
                  disabled={!canManageSettings || questions.length >= 5}
                  className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Đọc và đồng ý với các Quy Định Máy Chủ
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs font-bold leading-5 text-slate-500">
              Form này sẽ hiển thị cho người dùng trước khi họ gửi yêu cầu tham
              gia.
            </p>
            <button
              type="submit"
              disabled={!canManageSettings || isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-emerald-950/20 transition hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
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

      {activeRulesQuestion && (
        <div className="organization-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={closeRulesEditor}
            aria-hidden="true"
          />
          <section className="organization-modal-card relative z-10 max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[1.35rem] bg-white text-slate-950 shadow-2xl shadow-slate-900/18 ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4 px-6 py-6">
              <h2 className="text-3xl font-black leading-tight">
                Quy Định Máy Chủ
              </h2>
              <button
                type="button"
                onClick={closeRulesEditor}
                className="grid size-11 shrink-0 place-items-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                aria-label="Đóng"
              >
                <Icon name="close" className="text-4xl leading-none" />
              </button>
            </div>

            <div className="max-h-[54vh] overflow-y-auto px-6 pb-5">
              <div className="grid gap-4">
                {rulesDraft.map((rule, index) => (
                  <div
                    key={`${index}-${rule.slice(0, 16)}`}
                    onDragOver={(event) => {
                      if (draggingRuleIndex !== null && draggingRuleIndex !== index) {
                        event.preventDefault();
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceIndexValue =
                        event.dataTransfer.getData("application/x-rule-index") ||
                        String(draggingRuleIndex ?? "");
                      moveRuleDraft(Number(sourceIndexValue), index);
                      setDraggingRuleIndex(null);
                    }}
                    className={`flex items-start gap-3 rounded-[0.85rem] border border-slate-200 bg-slate-50 p-3 transition ${
                      draggingRuleIndex === index
                        ? "opacity-60"
                        : "hover:border-emerald-200 hover:bg-emerald-50/60"
                    }`}
                  >
                    <span
                      draggable
                      onDragStart={(event) => {
                        setDraggingRuleIndex(index);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "application/x-rule-index",
                          String(index),
                        );
                        event.dataTransfer.setData("text/plain", String(index));
                      }}
                      onDragEnd={() => setDraggingRuleIndex(null)}
                      className="mt-2 grid size-7 shrink-0 cursor-grab place-items-center rounded-lg text-slate-400 hover:bg-emerald-100 hover:text-emerald-700 active:cursor-grabbing"
                      title="Kéo để đổi thứ tự"
                    >
                      <Icon name="drag_indicator" className="text-2xl leading-none" />
                    </span>
                    <textarea
                      value={rule}
                      onChange={(event) =>
                        updateRuleDraft(index, event.target.value)
                      }
                      rows={3}
                      className="min-h-24 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-xl font-semibold leading-8 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                      placeholder="Nhập nội quy"
                    />
                    <button
                      type="button"
                      onClick={() => removeRuleDraft(index)}
                      disabled={rulesDraft.length <= 1}
                      className="mt-2 grid size-9 shrink-0 place-items-center rounded-xl text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Xóa nội quy"
                      title="Xóa nội quy"
                    >
                      <Icon name="delete" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => addRuleDraft("")}
                className="mt-4 inline-flex min-h-20 w-full items-center justify-center gap-3 rounded-[0.85rem] border border-dashed border-slate-300 bg-white text-xl font-black text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 active:scale-[0.99]"
              >
                <Icon name="add" className="text-3xl leading-none" />
                Thêm quy định
              </button>

              <div className="mt-8">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Ví dụ về quy định
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {ruleExamples.map((rule) => (
                    <button
                      key={rule}
                      type="button"
                      onClick={() => addRuleDraft(rule)}
                      className="rounded-full bg-slate-50 px-4 py-2 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      {rule}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-5 sm:grid-cols-2">
              <button
                type="button"
                onClick={closeRulesEditor}
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-4 text-lg font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100 active:scale-[0.98]"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={saveRulesEditor}
                disabled={!rulesDraftHasContent}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-4 text-lg font-black text-white transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Lưu
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default OrganizationAdvancedSection;
