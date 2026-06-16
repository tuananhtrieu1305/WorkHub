import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildRulesDescription, getRuleLines } from "../joinQuestionRules";
import { formatDate, hasPermission } from "../organizationUtils";
import Icon from "./Icon";
import MemberAvatar from "./MemberAvatar";
import OrganizationAccentPicker from "./OrganizationAccentPicker";
import ToggleSwitch from "./ToggleSwitch";

const questionTypes = [
  {
    type: "short_text",
    label: "Câu trả lời ngắn",
    shortLabel: "Câu trả lời ngắn",
    description: "Một dòng trả lời súc tích.",
    icon: "short_text",
  },
  {
    type: "paragraph",
    label: "Đoạn",
    shortLabel: "Đoạn",
    description: "Câu trả lời dài hơn theo đoạn văn.",
    icon: "notes",
  },
  {
    type: "multiple_choice",
    label: "Nhiều lựa chọn",
    shortLabel: "Nhiều lựa chọn",
    description: "Chọn một đáp án trong danh sách.",
    icon: "format_list_bulleted",
  },
  {
    type: "rules",
    label: "Quy định tổ chức",
    shortLabel: "Quy định tổ chức",
    description: "Checkbox xác nhận đã đọc quy định tổ chức.",
    icon: "rule",
  },
];

const exampleQuestions = [
  "Bạn có chơi trò chơi nào giống với chúng tôi không?",
  "Bạn tìm thấy chúng tôi bằng cách nào?",
  "Đâu là điểm độc nhất vô nhị của bạn?",
];

const ruleExamples = [
  {
    title: "Lịch sự và văn minh",
    text: "Tôn trọng tất cả mọi người. Tuyệt đối không được có hành vi quấy rối, tấn công tập thể, phân biệt giới tính, phân biệt chủng tộc hoặc phát ngôn gây thù hận. Tất cả những hành vi đó sẽ bị trừng trị nghiêm khắc.",
  },
  {
    title: "Không spam hoặc tự quảng bá bản thân",
    text: "Không spam hoặc tự quảng bá bản thân (mời tham gia máy chủ, quảng cáo, v.v) khi chưa được sự cho phép của ban quản trị máy chủ. Bao gồm cả hành vi nhắn tin trực tiếp cho các thành viên trong máy chủ.",
  },
  {
    title: "Không có giới hạn độ tuổi hoặc nội dung phản cảm",
    text: "Không có giới hạn độ tuổi hoặc nội dung phản cảm. Bao gồm văn bản, hình ảnh hoặc liên kết có chứa nội dung khoả thân, tình dục, bạo lực mạnh hoặc các nội dung minh hoạ phản cảm khác.",
  },
  {
    title: "Giúp bảo đảm môi trường lành mạnh",
    text: "Nếu bạn phát hiện có bất kỳ hành động nào trái với các quy định hoặc khiến bạn cảm thấy không an tâm, hãy thông báo ngay cho quản trị viên. Chúng tôi sẽ không để cho những hành động đó ảnh hưởng đến sự lành mạnh của máy chủ này!",
  },
];

const createId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const getQuestionType = (type) =>
  questionTypes.find((item) => item.type === type) || questionTypes[0];

const getDropPlacement = (event, element) => {
  const rect = element.getBoundingClientRect();
  return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
};

const toRuleDraftItems = (rules = []) =>
  rules.map((rule) => ({ id: createId("rule"), text: rule }));

const getRuleTextareaRows = (value = "") => {
  const lines = String(value || "").split(/\r?\n/);
  return Math.max(
    3,
    lines.reduce(
      (total, line) => total + Math.max(1, Math.ceil(line.length / 68)),
      0,
    ),
  );
};

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
    description: "",
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
  bannedMembers = [],
  form,
  isLoadingBans = false,
  isLeaving,
  isSaving,
  members = [],
  onChange,
  onLeave,
  onOpenJoinPreview,
  onOpenTransferOwner,
  onRevokeBan,
  onSubmit,
  organization,
  roles,
}) => {
  const [draggingQuestionId, setDraggingQuestionId] = useState("");
  const [expandedQuestionId, setExpandedQuestionId] = useState("");
  const [isQuestionTypePickerOpen, setIsQuestionTypePickerOpen] =
    useState(false);
  const [questionTypePickerStyle, setQuestionTypePickerStyle] = useState({});
  const [rulesEditorQuestionId, setRulesEditorQuestionId] = useState("");
  const [rulesDraft, setRulesDraft] = useState([]);
  const [draggingRuleId, setDraggingRuleId] = useState("");
  const questionTypeButtonRef = useRef(null);
  const questionTypePickerRef = useRef(null);
  const canManageSettings = hasPermission(organization, "manageSettings");
  const canManageAppearance = hasPermission(organization, "manageOrganization");
  const canManageMembers = hasPermission(organization, "manageMembers");
  const canLeave = !organization?.isOwner;
  const canTransferOwner = Boolean(organization?.isOwner);
  const questions = useMemo(
    () => form?.joinQuestions || [],
    [form?.joinQuestions],
  );
  const eligibleTransferMembers = useMemo(
    () =>
      members.filter(
        (member) => member.status === "active" && !member.isOwner,
      ),
    [members],
  );
  const activeRulesQuestion = useMemo(
    () => questions.find((question) => question.id === rulesEditorQuestionId),
    [questions, rulesEditorQuestionId],
  );
  const hasRulesQuestion = useMemo(
    () => questions.some((question) => question.type === "rules"),
    [questions],
  );
  const availableQuestionTypes = useMemo(
    () =>
      questionTypes.filter(
        (questionType) => questionType.type !== "rules" || !hasRulesQuestion,
      ),
    [hasRulesQuestion],
  );
  const rulesDraftHasContent = rulesDraft.some((rule) =>
    String(rule.text || "").trim(),
  );

  const updateQuestionTypePickerPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    const trigger = questionTypeButtonRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isSmallScreen = viewportWidth < 640;
    const margin = isSmallScreen ? 12 : 16;
    const gap = 10;

    if (isSmallScreen) {
      setQuestionTypePickerStyle({
        bottom: `${margin}px`,
        left: `${margin}px`,
        maxHeight: `calc(100dvh - ${margin * 2}px)`,
        right: `${margin}px`,
        top: "auto",
        transform: "none",
        width: "auto",
      });
      return;
    }

    const maxViewportWidth = Math.max(280, viewportWidth - margin * 2);
    const desiredWidth = Math.min(448, Math.max(360, rect.width * 0.42));
    const width = Math.min(desiredWidth, maxViewportWidth);
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, margin),
      viewportWidth - margin - width,
    );
    const spaceBelow = viewportHeight - rect.bottom - margin - gap;
    const spaceAbove = rect.top - margin - gap;
    const estimatedHeight = Math.min(
      336,
      availableQuestionTypes.length * 76 + 20,
    );
    const placeAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
    const availableHeight = Math.max(
      160,
      Math.floor(placeAbove ? spaceAbove : spaceBelow),
    );

    setQuestionTypePickerStyle({
      bottom: "auto",
      left: `${left}px`,
      maxHeight: `${availableHeight}px`,
      right: "auto",
      top: `${placeAbove ? rect.top - gap : rect.bottom + gap}px`,
      transform: placeAbove ? "translateY(-100%)" : "none",
      width: `${width}px`,
    });
  }, [availableQuestionTypes.length]);

  useEffect(() => {
    if (!isQuestionTypePickerOpen) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (
        questionTypeButtonRef.current?.contains(target) ||
        questionTypePickerRef.current?.contains(target)
      ) {
        return;
      }
      setIsQuestionTypePickerOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsQuestionTypePickerOpen(false);
    };

    window.addEventListener("resize", updateQuestionTypePickerPosition);
    window.addEventListener("scroll", updateQuestionTypePickerPosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updateQuestionTypePickerPosition);
      window.removeEventListener("scroll", updateQuestionTypePickerPosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isQuestionTypePickerOpen, updateQuestionTypePickerPosition]);

  const toggleQuestionTypePicker = () => {
    if (isQuestionTypePickerOpen) {
      setIsQuestionTypePickerOpen(false);
      return;
    }

    updateQuestionTypePickerPosition();
    setIsQuestionTypePickerOpen(true);
  };

  const updateForm = (updates) => onChange({ ...(form || {}), ...updates });
  const updateQuestion = (questionId, updates) => {
    updateForm({
      joinQuestions: questions.map((question) =>
        question.id === questionId ? { ...question, ...updates } : question,
      ),
    });
  };
  const addQuestion = (type = "short_text", label = "") => {
    if (questions.length >= 5 || (type === "rules" && hasRulesQuestion)) return;
    const nextQuestion = buildQuestion(type, label);
    updateForm({ joinQuestions: [...questions, nextQuestion] });
    setIsQuestionTypePickerOpen(false);

    if (type === "rules") {
      setRulesEditorQuestionId(nextQuestion.id);
      setRulesDraft([]);
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
  const moveQuestion = (
    sourceQuestionId,
    targetQuestionId,
    placement = "before",
  ) => {
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
    const nextTargetIndex = nextQuestions.findIndex(
      (question) => question.id === targetQuestionId,
    );
    const insertIndex =
      placement === "after" ? nextTargetIndex + 1 : nextTargetIndex;
    nextQuestions.splice(insertIndex, 0, movedQuestion);

    if (
      nextQuestions.every(
        (question, index) => question.id === questions[index]?.id,
      )
    ) {
      return;
    }

    updateForm({ joinQuestions: nextQuestions });
  };
  const openQuestionEditor = (question) => {
    if (question.type === "rules") {
      setRulesEditorQuestionId(question.id);
      setRulesDraft(toRuleDraftItems(getRuleLines(question.description)));
      setExpandedQuestionId("");
      return;
    }

    setExpandedQuestionId((currentId) =>
      currentId === question.id ? "" : question.id,
    );
  };
  const updateRuleDraft = (ruleId, value) => {
    setRulesDraft((currentRules) =>
      currentRules.map((rule) =>
        rule.id === ruleId ? { ...rule, text: value } : rule,
      ),
    );
  };
  const addRuleDraft = (value = "") => {
    setRulesDraft((currentRules) => [
      ...currentRules,
      { id: createId("rule"), text: value },
    ]);
  };
  const removeRuleDraft = (ruleId) => {
    setRulesDraft((currentRules) =>
      currentRules.filter((rule) => rule.id !== ruleId),
    );
  };
  const moveRuleDraft = (sourceRuleId, targetRuleId, placement = "before") => {
    if (
      !sourceRuleId ||
      !targetRuleId ||
      sourceRuleId === targetRuleId
    ) {
      return;
    }

    setRulesDraft((currentRules) => {
      const sourceIndex = currentRules.findIndex(
        (rule) => rule.id === sourceRuleId,
      );
      const targetIndex = currentRules.findIndex(
        (rule) => rule.id === targetRuleId,
      );
      if (sourceIndex < 0 || targetIndex < 0) return currentRules;

      const nextRules = [...currentRules];
      const [movedRule] = nextRules.splice(sourceIndex, 1);
      const nextTargetIndex = nextRules.findIndex(
        (rule) => rule.id === targetRuleId,
      );
      const insertIndex =
        placement === "after" ? nextTargetIndex + 1 : nextTargetIndex;
      nextRules.splice(insertIndex, 0, movedRule);

      if (
        nextRules.every((rule, index) => rule.id === currentRules[index]?.id)
      ) {
        return currentRules;
      }

      return nextRules;
    });
  };
  const closeRulesEditor = () => {
    setRulesEditorQuestionId("");
    setRulesDraft([]);
    setDraggingRuleId("");
  };
  const saveRulesEditor = () => {
    if (!activeRulesQuestion || !rulesDraftHasContent) return;
    updateQuestion(activeRulesQuestion.id, {
      description: buildRulesDescription(rulesDraft.map((rule) => rule.text)),
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
                    value={form?.defaultRoleId || ""}
                    disabled={!canManageSettings}
                    onChange={(event) =>
                      updateForm({ defaultRoleId: event.target.value })
                    }
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {(roles || []).map((role) => (
                      <option key={role.id} value={role.id}>
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

                return (
                  <article
                    key={question.id}
                    onDragOver={(event) => {
                      if (draggingQuestionId && draggingQuestionId !== question.id) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        moveQuestion(
                          draggingQuestionId,
                          question.id,
                          getDropPlacement(event, event.currentTarget),
                        );
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceQuestionId =
                        event.dataTransfer.getData("application/x-question-id") ||
                        event.dataTransfer.getData("text/plain") ||
                        draggingQuestionId;
                      moveQuestion(
                        sourceQuestionId,
                        question.id,
                        getDropPlacement(event, event.currentTarget),
                      );
                      setDraggingQuestionId("");
                    }}
                    className={`rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-3 transition duration-150 ease-out ${
                      draggingQuestionId === question.id
                        ? "scale-[0.99] border-blue-300 bg-white opacity-60 shadow-lg shadow-blue-950/10 ring-2 ring-blue-100"
                        : "hover:border-blue-200 hover:bg-blue-50/40"
                    }`}
                  >
                    <div className="grid gap-3 xl:grid-cols-[28px_minmax(280px,1fr)_190px_auto] xl:items-center">
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

                      <div className="flex h-12 min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700">
                        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                          <Icon name={typeMeta.icon} />
                        </span>
                        <span className="min-w-0 truncate">{typeMeta.shortLabel}</span>
                      </div>

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

              <div className="relative">
                <button
                  ref={questionTypeButtonRef}
                  type="button"
                  onClick={toggleQuestionTypePicker}
                  disabled={!canManageSettings || questions.length >= 5}
                  aria-expanded={isQuestionTypePickerOpen}
                  className="inline-flex min-h-20 w-full items-center justify-center gap-3 rounded-[1.35rem] border border-dashed border-slate-300 bg-white px-4 py-4 text-lg font-black text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Icon name="add" className="text-3xl leading-none" />
                  Thêm câu hỏi
                </button>
              </div>
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
              Lưu
            </button>
          </div>
        </form>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-200 lg:col-span-2">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-black text-slate-950">
                  <Icon name="block" />
                  Tài khoản bị chặn
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  Quản lý những tài khoản không thể tham gia lại bằng mã hoặc
                  liên kết mời.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-2xl bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 ring-1 ring-rose-100">
                <Icon name="person_off" />
                {bannedMembers.length} bị chặn
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {isLoadingBans ? (
                Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse rounded-2xl bg-slate-100"
                  />
                ))
              ) : bannedMembers.length ? (
                bannedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <MemberAvatar member={member} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {member.user?.fullName || "Thành viên"}
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-500">
                          {member.user?.email || "Chưa có email"}
                        </p>
                        <p className="mt-1 text-xs font-bold text-rose-600">
                          Bị chặn: {formatDate(member.bannedAt) || "Không rõ"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRevokeBan?.(member)}
                      disabled={!canManageMembers}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-emerald-50 hover:text-emerald-700 hover:ring-emerald-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon name="undo" />
                      Thu hồi chặn
                    </button>
                  </div>
                ))
              ) : (
                <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                  <Icon name="verified_user" className="text-4xl leading-none text-slate-300" />
                  <p className="text-sm font-black text-slate-600">
                    Chưa có tài khoản nào bị chặn.
                  </p>
                </div>
              )}
            </div>
          </div>

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

      {isQuestionTypePickerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={questionTypePickerRef}
            style={questionTypePickerStyle}
            className="fixed z-[60] overflow-y-auto rounded-[1.15rem] border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15 ring-1 ring-white"
          >
            <div className="grid gap-1">
              {availableQuestionTypes.map((questionType) => (
                <button
                  key={questionType.type}
                  type="button"
                  onClick={() => addQuestion(questionType.type)}
                  className="flex min-h-16 items-center gap-3 rounded-[0.9rem] px-3 py-3 text-left transition hover:bg-blue-50 active:scale-[0.99]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                    <Icon name={questionType.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-slate-900">
                      {questionType.label}
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-500">
                      {questionType.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}

      {activeRulesQuestion &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="organization-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
            <div
              className="absolute inset-0"
              onClick={closeRulesEditor}
              aria-hidden="true"
            />
            <section className="organization-modal-card relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white text-slate-950 shadow-2xl ring-1 ring-slate-200">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-2xl font-black leading-tight sm:text-3xl">
                    Quy định tổ chức
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Tạo các nội quy người tham gia cần đọc trước khi gửi yêu cầu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeRulesEditor}
                  className="grid size-11 shrink-0 place-items-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                  aria-label="Đóng"
                >
                  <Icon name="close" className="text-4xl leading-none" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="grid gap-4">
                  {rulesDraft.length === 0 && (
                    <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                      <Icon
                        name="rule"
                        className="mx-auto text-4xl leading-none text-slate-400"
                      />
                      <p className="mt-3 text-sm font-black text-slate-700">
                        Chưa có quy định nào
                      </p>
                    </div>
                  )}

                {rulesDraft.map((rule, index) => (
                  <div
                    key={rule.id}
                    onDragOver={(event) => {
                      if (draggingRuleId && draggingRuleId !== rule.id) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        moveRuleDraft(
                          draggingRuleId,
                          rule.id,
                          getDropPlacement(event, event.currentTarget),
                        );
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceRuleId =
                        event.dataTransfer.getData("application/x-rule-id") ||
                        event.dataTransfer.getData("text/plain") ||
                        draggingRuleId;
                      moveRuleDraft(
                        sourceRuleId,
                        rule.id,
                        getDropPlacement(event, event.currentTarget),
                      );
                      setDraggingRuleId("");
                    }}
                    className={`flex items-start gap-3 rounded-[1rem] border border-slate-200 bg-slate-50 p-3 transition duration-150 ease-out ${
                      draggingRuleId === rule.id
                        ? "scale-[0.99] border-emerald-300 bg-white opacity-60 shadow-lg shadow-emerald-950/10 ring-2 ring-emerald-100"
                        : "hover:border-emerald-200 hover:bg-emerald-50/60"
                    }`}
                  >
                    <span
                      draggable
                      onDragStart={(event) => {
                        setDraggingRuleId(rule.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "application/x-rule-id",
                          rule.id,
                        );
                        event.dataTransfer.setData("text/plain", rule.id);
                      }}
                      onDragEnd={() => setDraggingRuleId("")}
                      className="mt-2 grid size-7 shrink-0 cursor-grab place-items-center rounded-lg text-slate-400 hover:bg-emerald-100 hover:text-emerald-700 active:cursor-grabbing"
                      title="Kéo để đổi thứ tự"
                    >
                      <Icon name="drag_indicator" className="text-2xl leading-none" />
                    </span>
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Nội quy {index + 1}</span>
                      <textarea
                        value={rule.text}
                        onChange={(event) =>
                          updateRuleDraft(rule.id, event.target.value)
                        }
                        rows={getRuleTextareaRows(rule.text)}
                        style={{ fieldSizing: "content" }}
                        className="min-h-24 w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-3 text-xl font-semibold leading-8 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        placeholder="Nhập nội quy"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeRuleDraft(rule.id)}
                      className="mt-2 grid size-9 shrink-0 place-items-center rounded-xl text-rose-600 transition hover:bg-rose-50 active:scale-95"
                      aria-label="Xóa nội quy"
                      title="Xóa nội quy"
                    >
                      <Icon name="delete" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addRuleDraft("")}
                  className="inline-flex min-h-20 w-full items-center justify-center gap-3 rounded-[1rem] border border-dashed border-slate-300 bg-white text-xl font-black text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 active:scale-[0.99]"
                >
                  <Icon name="add" className="text-3xl leading-none" />
                  Thêm quy định
                </button>

                <div className="pt-2">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Ví dụ về quy định
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {ruleExamples.map((rule) => (
                      <button
                        key={rule.title}
                        type="button"
                        onClick={() => addRuleDraft(rule.text)}
                        className="rounded-full bg-slate-50 px-4 py-2 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        {rule.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid shrink-0 gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:grid-cols-2 sm:px-6">
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
          </div>,
          document.body,
        )}
    </>
  );
};

export default OrganizationAdvancedSection;
