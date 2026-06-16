import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmojiPickerButton } from "../../components/emoji";
import {
  markdownToComposerHtml,
  serializeComposerContent,
} from "./chatComposerUtils";
import { formatAudioDuration } from "./chatMessagePreview";
import PollCreateModal from "./PollCreateModal";
import ReminderCreateModal from "./ReminderCreateModal";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";

const secondaryComposerActions = [
  { icon: "contact_page", title: "Gửi danh thiếp" },
];

const MAX_VOICE_DURATION_SECONDS = 120;
const audioMimeTypeCandidates = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];
const recorderWaveformBars = [
  24, 48, 34, 72, 42, 88, 58, 36, 78, 96, 45, 68, 84, 52, 74, 40, 62, 30,
];
const EVERYONE_MENTION_ID = "__workhub_everyone__";
const mentionTriggerPattern = /(^|\s)@([^\s@]*)$/u;

const normalizeSearchText = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const getMentionUserId = (user) => {
  if (!user) return "";
  return String(user._id || user.id || user.userId || "");
};

const uniqueMentionUsers = (users = []) => {
  const seen = new Set();
  return users
    .map((item) => item?.user || item)
    .filter(Boolean)
    .filter((user) => {
      const userId = getMentionUserId(user);
      if (!userId || seen.has(userId)) return false;
      seen.add(userId);
      return true;
    });
};

const getSupportedAudioMimeType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    audioMimeTypeCandidates.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    ) || ""
  );
};

const getBaseMimeType = (mimeType = "") =>
  String(mimeType).split(";")[0].trim() || "audio/webm";

const getAudioExtension = (mimeType = "") => {
  const baseMimeType = getBaseMimeType(mimeType);
  if (baseMimeType === "audio/ogg") return "ogg";
  if (baseMimeType === "audio/mp4") return "m4a";
  if (baseMimeType === "audio/mpeg") return "mp3";
  if (baseMimeType === "audio/wav") return "wav";
  return "webm";
};

const formatToolbarItems = [
  {
    label: "B",
    title: "In đậm",
    action: "bold",
    command: "bold",
    className: "font-bold",
  },
  {
    label: "I",
    title: "In nghiêng",
    action: "italic",
    command: "italic",
    className: "italic",
  },
  {
    label: "U",
    title: "Gạch chân",
    action: "underline",
    command: "underline",
    className: "underline",
  },
  {
    label: "S",
    title: "Gạch ngang",
    action: "strike",
    command: "strikeThrough",
    className: "line-through",
  },
  { icon: "ink_eraser", title: "Xóa định dạng", action: "clear" },
  { divider: true },
  {
    label: "A-",
    title: "Cỡ chữ nhỏ",
    action: "fontSmall",
    className: "text-xs font-semibold",
  },
  {
    label: "A",
    title: "Cỡ chữ thường",
    action: "fontNormal",
    className: "text-sm font-semibold",
  },
  {
    label: "A+",
    title: "Cỡ chữ lớn",
    action: "fontLarge",
    className: "text-base font-semibold",
  },
  { divider: true },
  {
    icon: "format_list_bulleted",
    title: "Danh sách dấu đầu dòng",
    action: "list",
    command: "insertUnorderedList",
  },
  {
    icon: "format_list_numbered",
    title: "Danh sách đánh số",
    action: "orderedList",
    command: "insertOrderedList",
  },
  { icon: "format_indent_increase", title: "Tăng thụt lề", action: "indent" },
  { icon: "format_indent_decrease", title: "Giảm thụt lề", action: "outdent" },
  { icon: "undo", title: "Hoàn tác", action: "undo" },
  { icon: "redo", title: "Làm lại", action: "redo" },
];

const commandByFormatAction = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strikeThrough",
  list: "insertUnorderedList",
  orderedList: "insertOrderedList",
  indent: "indent",
  outdent: "outdent",
  undo: "undo",
  redo: "redo",
};

const fontSizeCommandValueByAction = {
  fontSmall: "2",
  fontNormal: "3",
  fontLarge: "4",
};

const getFontSizeActionFromCommandValue = (value) => {
  const fontSize = Number.parseInt(String(value || ""), 10);

  if (fontSize <= 2) return "fontSmall";
  if (fontSize >= 4) return "fontLarge";
  return "fontNormal";
};

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
const DOCUMENT_FRAGMENT_NODE = 11;

const inlineFormatActions = ["bold", "italic", "underline", "strike"];
const inlineFormatNestingOrder = ["bold", "underline", "italic", "strike"];

const inlineFormatDefinitions = {
  bold: {
    tagName: "strong",
    matches: (element) => {
      const fontWeight = element.style?.fontWeight || "";
      return (
        element.tagName === "B" ||
        element.tagName === "STRONG" ||
        fontWeight === "bold" ||
        Number.parseInt(fontWeight, 10) >= 600
      );
    },
  },
  italic: {
    tagName: "em",
    matches: (element) =>
      element.tagName === "I" ||
      element.tagName === "EM" ||
      element.style?.fontStyle === "italic",
  },
  underline: {
    tagName: "u",
    matches: (element) =>
      element.tagName === "U" ||
      `${element.style?.textDecoration || ""} ${
        element.style?.textDecorationLine || ""
      }`.includes("underline"),
  },
  strike: {
    tagName: "s",
    matches: (element) =>
      ["S", "STRIKE", "DEL"].includes(element.tagName) ||
      `${element.style?.textDecoration || ""} ${
        element.style?.textDecorationLine || ""
      }`.includes("line-through"),
  },
};

const createEmptyInlineFormats = () =>
  inlineFormatActions.reduce((formats, action) => {
    formats[action] = false;
    return formats;
  }, {});

const isElementNode = (node) => node?.nodeType === ELEMENT_NODE;

const getNodeElement = (node) => {
  if (!node) return null;
  return isElementNode(node) ? node : node.parentElement;
};

const isInlineFormatElement = (element, action) => {
  if (!isElementNode(element)) return false;
  return Boolean(inlineFormatDefinitions[action]?.matches(element));
};

const isManagedFontScaleElement = (element) => {
  if (!isElementNode(element)) return false;

  if (["FONT", "SMALL", "BIG"].includes(element.tagName)) return true;

  const fontSize = element.style?.fontSize || "";
  return Boolean(fontSize);
};

const getClosestInlineFormatElement = (node, action, editor) => {
  let element = getNodeElement(node);

  while (element && element !== editor) {
    if (isInlineFormatElement(element, action)) return element;
    element = element.parentElement;
  }

  return null;
};

const collectTextNodes = (root, textNodes = []) => {
  root.childNodes?.forEach((child) => {
    if (child.nodeType === TEXT_NODE) {
      if (child.textContent) textNodes.push(child);
      return;
    }

    collectTextNodes(child, textNodes);
  });

  return textNodes;
};

const getSelectedTextNodes = (range, editor) => {
  if (!range || range.collapsed) return [];

  return collectTextNodes(editor).filter((node) => {
    try {
      return range.intersectsNode(node) && node.textContent.trim();
    } catch {
      return false;
    }
  });
};

const getInlineFormatStateForRange = (range, editor) => {
  const formats = createEmptyInlineFormats();

  if (!range || !editor) return formats;

  if (range.collapsed) {
    inlineFormatActions.forEach((action) => {
      formats[action] = Boolean(
        getClosestInlineFormatElement(range.startContainer, action, editor),
      );
    });
    return formats;
  }

  const selectedTextNodes = getSelectedTextNodes(range, editor);

  inlineFormatActions.forEach((action) => {
    formats[action] =
      selectedTextNodes.length > 0 &&
      selectedTextNodes.every((node) =>
        getClosestInlineFormatElement(node, action, editor),
      );
  });

  return formats;
};

const normalizeCollapsedRangePoint = (range) => {
  if (range.startContainer?.nodeType !== TEXT_NODE) return;

  const textNode = range.startContainer;
  const offset = range.startOffset;

  if (offset <= 0) {
    range.setStartBefore(textNode);
  } else if (offset >= textNode.textContent.length) {
    range.setStartAfter(textNode);
  } else {
    const afterText = textNode.splitText(offset);
    range.setStartBefore(afterText);
  }

  range.collapse(true);
};

const isCollapsedRangeAtStartOfElement = (range, element) => {
  const beforeRange = document.createRange();
  beforeRange.setStart(element, 0);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  return beforeRange.toString() === "";
};

const isCollapsedRangeAtEndOfElement = (range, element) => {
  const afterRange = document.createRange();
  afterRange.setStart(range.startContainer, range.startOffset);
  afterRange.setEnd(element, element.childNodes.length);
  return afterRange.toString() === "";
};

const splitInlineElementAtCollapsedRange = (range, element) => {
  if (!element?.parentNode) return { before: null, after: null };

  normalizeCollapsedRangePoint(range);

  if (isCollapsedRangeAtStartOfElement(range, element)) {
    return { before: null, after: element };
  }

  if (isCollapsedRangeAtEndOfElement(range, element)) {
    return { before: element, after: null };
  }

  const afterRange = range.cloneRange();
  afterRange.setEndAfter(element);
  const afterFragment = afterRange.extractContents();
  const afterNode = afterFragment.firstChild;
  element.parentNode.insertBefore(afterFragment, element.nextSibling);

  return { before: element, after: afterNode };
};

const splitFormatAtRangeStart = (range, action, editor) => {
  const ancestor = getClosestInlineFormatElement(
    range.startContainer,
    action,
    editor,
  );

  if (!ancestor) return;

  const pointRange = range.cloneRange();
  pointRange.collapse(true);
  const { before, after } = splitInlineElementAtCollapsedRange(
    pointRange,
    ancestor,
  );

  if (after) {
    range.setStartBefore(after);
  } else if (before) {
    range.setStartAfter(before);
  }
};

const splitFormatAtRangeEnd = (range, action, editor) => {
  const ancestor = getClosestInlineFormatElement(
    range.endContainer,
    action,
    editor,
  );

  if (!ancestor) return;

  const pointRange = range.cloneRange();
  pointRange.collapse(false);
  const { before, after } = splitInlineElementAtCollapsedRange(
    pointRange,
    ancestor,
  );

  if (before) {
    range.setEndAfter(before);
  } else if (after) {
    range.setEndBefore(after);
  }
};

const splitFormatAtSelectionBoundaries = (range, action, editor) => {
  splitFormatAtRangeStart(range, action, editor);
  splitFormatAtRangeEnd(range, action, editor);
};

const normalizeCollapsedRangeForInlineFormats = (range, editor, formats) => {
  inlineFormatActions.forEach((action) => {
    if (formats[action]) return;

    let ancestor = getClosestInlineFormatElement(
      range.startContainer,
      action,
      editor,
    );
    let guard = 0;

    while (ancestor && guard < 12) {
      const { before, after } = splitInlineElementAtCollapsedRange(
        range,
        ancestor,
      );

      if (after) {
        range.setStartBefore(after);
      } else if (before) {
        range.setStartAfter(before);
      }
      range.collapse(true);

      ancestor = getClosestInlineFormatElement(
        range.startContainer,
        action,
        editor,
      );
      guard += 1;
    }
  });
};

const unwrapElement = (element) => {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  parent.removeChild(element);
};

const stripInlineFormatElements = (
  root,
  actions = inlineFormatActions,
  { includeFontScale = false } = {},
) => {
  Array.from(root.childNodes || []).forEach((child) => {
    stripInlineFormatElements(child, actions, { includeFontScale });
  });

  if (
    root.nodeType === ELEMENT_NODE &&
    root.parentNode &&
    (actions.some((action) => isInlineFormatElement(root, action)) ||
      (includeFontScale && isManagedFontScaleElement(root)))
  ) {
    unwrapElement(root);
  }
};

const cleanupEditorInlineArtifacts = (editor) => {
  editor
    ?.querySelectorAll("strong,b,em,i,u,s,strike,del,font,small,big")
    .forEach((element) => {
      if (!element.textContent && !element.querySelector("br,img,video,audio")) {
        element.remove();
      }
    });
  editor?.normalize();
};

const replaceSelectionWithNode = (
  range,
  node,
  { selectInserted = false } = {},
) => {
  const selection = window.getSelection?.();
  if (!selection || !node) return;

  range.insertNode(node);

  const nextRange = document.createRange();
  if (selectInserted) {
    nextRange.selectNodeContents(node);
  } else {
    nextRange.setStartAfter(node);
    nextRange.collapse(true);
  }
  selection.removeAllRanges();
  selection.addRange(nextRange);
};

const replaceSelectionWithFragment = (
  range,
  fragment,
  { selectInserted = false } = {},
) => {
  const selection = window.getSelection?.();
  if (!selection) return;

  const insertedNodes = Array.from(fragment.childNodes);
  if (!insertedNodes.length) {
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }

  range.insertNode(fragment);

  const nextRange = document.createRange();
  if (selectInserted) {
    nextRange.setStartBefore(insertedNodes[0]);
    nextRange.setEndAfter(insertedNodes[insertedNodes.length - 1]);
  } else {
    nextRange.setStartAfter(insertedNodes[insertedNodes.length - 1]);
    nextRange.collapse(true);
  }
  selection.removeAllRanges();
  selection.addRange(nextRange);
};

const createPlainTextFragment = (text) => {
  const fragment = document.createDocumentFragment();
  const lines = String(text).split(/\r\n|\r|\n/);

  lines.forEach((line, index) => {
    if (index > 0) {
      fragment.append(document.createElement("br"));
    }
    if (line) {
      fragment.append(document.createTextNode(line));
    }
  });

  return fragment;
};

const wrapFragmentWithInlineFormats = (fragment, formats) => {
  let wrappedNode = fragment;

  [...inlineFormatNestingOrder].reverse().forEach((action) => {
    if (!formats[action]) return;

    const wrapper = document.createElement(
      inlineFormatDefinitions[action].tagName,
    );
    wrapper.append(wrappedNode);
    wrappedNode = wrapper;
  });

  return wrappedNode;
};

const ChatInput = ({
  onSend,
  onUploadAttachment,
  onCreatePoll,
  onCreateReminder,
  onTypingChange,
  onCancelDraft,
  initialContent = "",
  mode = "send",
  draftPreview = null,
  placeholder = "Nhập tin nhắn...",
  disabled = false,
  mentionableUsers = [],
  allowMentionEveryone = false,
}) => {
  const [content, setContent] = useState(initialContent);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVoiceSending, setIsVoiceSending] = useState(false);
  const [isPreparingRecording, setIsPreparingRecording] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [attachmentError, setAttachmentError] = useState("");
  const [recordingError, setRecordingError] = useState("");
  const [renderedDraftPreview, setRenderedDraftPreview] =
    useState(draftPreview);
  const [isDraftExiting, setIsDraftExiting] = useState(false);
  const [activeFormats, setActiveFormats] = useState({});
  const [mentionQuery, setMentionQuery] = useState("");
  const [isMentionMenuOpen, setIsMentionMenuOpen] = useState(false);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [selectedMentionIds, setSelectedMentionIds] = useState([]);
  const [mentionEveryone, setMentionEveryone] = useState(false);
  const editorRef = useRef(null);
  const hasHydratedEditorRef = useRef(false);
  const savedSelectionRef = useRef(null);
  const pendingInlineFormatsRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef(null);
  const pendingRecordingActionRef = useRef("cancel");
  const recordingRequestCancelledRef = useRef(false);
  const draftIdentityRef = useRef(
    draftPreview
      ? `${draftPreview.variant}-${draftPreview.id}`
      : `mode-${mode}`
  );

  const updateContent = useCallback((nextContent) => {
    setContent(nextContent);
    onTypingChange?.(Boolean(nextContent.trim()));
  }, [onTypingChange]);

  const normalizedMentionableUsers = useMemo(
    () => uniqueMentionUsers(mentionableUsers),
    [mentionableUsers],
  );

  const mentionOptions = useMemo(() => {
    const query = normalizeSearchText(mentionQuery);
    const memberOptions = normalizedMentionableUsers
      .filter((member) => {
        if (!query) return true;
        return normalizeSearchText(
          `${member.fullName || ""} ${member.email || ""} ${member.position || ""}`,
        ).includes(query);
      })
      .map((member) => ({
        id: getMentionUserId(member),
        label: member.fullName || member.email || "Người dùng",
        subLabel: member.position || member.email || "Thành viên",
        avatar: member.avatar,
        user: member,
      }));

    const everyoneOption =
      allowMentionEveryone && (!query || normalizeSearchText("mọi người everyone all").includes(query))
        ? [
            {
              id: EVERYONE_MENTION_ID,
              label: "mọi người",
              subLabel: "Thông báo cho tất cả thành viên trong nhóm",
              isEveryone: true,
            },
          ]
        : [];

    return [...everyoneOption, ...memberOptions].slice(0, 10);
  }, [allowMentionEveryone, mentionQuery, normalizedMentionableUsers]);

  const updateMentionMenuForContent = useCallback(
    (nextContent) => {
      if (mode !== "send" || disabled || normalizedMentionableUsers.length === 0) {
        setIsMentionMenuOpen(false);
        return;
      }

      const match = String(nextContent || "").match(mentionTriggerPattern);
      if (!match) {
        setIsMentionMenuOpen(false);
        setMentionQuery("");
        setActiveMentionIndex(0);
        return;
      }

      setMentionQuery(match[2] || "");
      setIsMentionMenuOpen(true);
      setActiveMentionIndex(0);
    },
    [disabled, mode, normalizedMentionableUsers.length],
  );

  const setEditorContentFromMarkdown = useCallback((nextContent) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = markdownToComposerHtml(nextContent);
  }, []);

  const isSelectionInsideEditor = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection?.();

    if (!editor || !selection?.rangeCount) return false;

    return (
      editor.contains(selection.anchorNode) &&
      editor.contains(selection.focusNode)
    );
  }, []);

  const saveEditorSelection = useCallback(() => {
    const selection = window.getSelection?.();

    if (!selection?.rangeCount || !isSelectionInsideEditor()) return;

    savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
  }, [isSelectionInsideEditor]);

  const focusEditorAtEnd = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);

    const selection = window.getSelection?.();
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedSelectionRef.current = range.cloneRange();
  }, []);

  const restoreEditorSelection = useCallback(() => {
    const editor = editorRef.current;
    const range = savedSelectionRef.current;
    const selection = window.getSelection?.();

    if (
      !editor ||
      !selection ||
      !range ||
      !editor.contains(range.startContainer) ||
      !editor.contains(range.endContainer)
    ) {
      focusEditorAtEnd();
      return;
    }

    editor.focus();
    selection.removeAllRanges();
    selection.addRange(range);
  }, [focusEditorAtEnd]);

  const updateActiveFormatState = useCallback(() => {
    if (typeof document === "undefined" || !isSelectionInsideEditor()) return;
    const editor = editorRef.current;
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

    if (!editor || !range) return;

    const queryCommandState = (command) => {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    };
    const queryCommandValue = (command) => {
      try {
        return document.queryCommandValue(command);
      } catch {
        return "";
      }
    };
    const fontSizeAction = getFontSizeActionFromCommandValue(
      queryCommandValue("fontSize"),
    );
    const inlineFormats =
      range.collapsed && pendingInlineFormatsRef.current
        ? pendingInlineFormatsRef.current
        : getInlineFormatStateForRange(range, editor);

    setActiveFormats({
      ...inlineFormats,
      list: queryCommandState("insertUnorderedList"),
      orderedList: queryCommandState("insertOrderedList"),
      fontSmall: fontSizeAction === "fontSmall",
      fontNormal: fontSizeAction === "fontNormal",
      fontLarge: fontSizeAction === "fontLarge",
    });
  }, [isSelectionInsideEditor]);

  const syncContentFromEditor = useCallback(() => {
    const editor = editorRef.current;
    const nextContent = serializeComposerContent(editor);

    if (!nextContent && editor?.innerHTML === "<br>") {
      editor.innerHTML = "";
    }

    updateContent(nextContent);
    updateMentionMenuForContent(nextContent);
    saveEditorSelection();
    updateActiveFormatState();
  }, [
    saveEditorSelection,
    updateActiveFormatState,
    updateContent,
    updateMentionMenuForContent,
  ]);

  const setEditorSelectionRange = useCallback((range) => {
    const selection = window.getSelection?.();
    if (!selection || !range) return;

    selection.removeAllRanges();
    selection.addRange(range);
    savedSelectionRef.current = range.cloneRange();
  }, []);

  const getRestoredEditorRange = useCallback(() => {
    restoreEditorSelection();

    const editor = editorRef.current;
    const selection = window.getSelection?.();

    if (!editor || !selection?.rangeCount || !isSelectionInsideEditor()) {
      return null;
    }

    return selection.getRangeAt(0);
  }, [isSelectionInsideEditor, restoreEditorSelection]);

  const refreshEditorFormatState = useCallback(() => {
    syncContentFromEditor();
    window.requestAnimationFrame(() => {
      saveEditorSelection();
      updateActiveFormatState();
    });
  }, [saveEditorSelection, syncContentFromEditor, updateActiveFormatState]);

  const insertFormattedText = useCallback(
    (value) => {
      const editor = editorRef.current;
      const range = getRestoredEditorRange();
      const formats = pendingInlineFormatsRef.current;

      if (!editor || !range || !formats || !value) return false;

      range.deleteContents();
      normalizeCollapsedRangeForInlineFormats(range, editor, formats);

      const fragment = createPlainTextFragment(value);
      const wrappedNode = wrapFragmentWithInlineFormats(fragment, formats);

      if (wrappedNode.nodeType === DOCUMENT_FRAGMENT_NODE) {
        replaceSelectionWithFragment(range, wrappedNode);
      } else {
        replaceSelectionWithNode(range, wrappedNode);
      }

      cleanupEditorInlineArtifacts(editor);
      refreshEditorFormatState();
      return true;
    },
    [getRestoredEditorRange, refreshEditorFormatState],
  );

  const toggleInlineFormat = useCallback(
    (action) => {
      const editor = editorRef.current;
      const range = getRestoredEditorRange();

      if (!editor || !range || !inlineFormatDefinitions[action]) return;

      if (range.collapsed) {
        const currentFormats =
          pendingInlineFormatsRef.current ||
          getInlineFormatStateForRange(range, editor);
        const nextFormats = {
          ...currentFormats,
          [action]: !currentFormats[action],
        };

        pendingInlineFormatsRef.current = nextFormats;
        normalizeCollapsedRangeForInlineFormats(range, editor, nextFormats);
        setEditorSelectionRange(range);
        setActiveFormats((current) => ({
          ...current,
          ...nextFormats,
        }));
        return;
      }

      pendingInlineFormatsRef.current = null;

      const shouldRemove = getInlineFormatStateForRange(range, editor)[action];

      if (shouldRemove) {
        splitFormatAtSelectionBoundaries(range, action, editor);
        const fragment = range.extractContents();
        stripInlineFormatElements(fragment, [action]);
        replaceSelectionWithFragment(range, fragment, { selectInserted: true });
      } else {
        const fragment = range.extractContents();
        stripInlineFormatElements(fragment, [action]);

        const wrapper = document.createElement(
          inlineFormatDefinitions[action].tagName,
        );
        wrapper.append(fragment);
        replaceSelectionWithNode(range, wrapper, { selectInserted: true });
      }

      cleanupEditorInlineArtifacts(editor);
      refreshEditorFormatState();
    },
    [getRestoredEditorRange, refreshEditorFormatState, setEditorSelectionRange],
  );

  const disableActiveListCommands = () => {
    ["insertUnorderedList", "insertOrderedList"].forEach((command) => {
      try {
        if (document.queryCommandState(command)) {
          document.execCommand(command, false, null);
        }
      } catch {
        // Ignore unsupported command states.
      }
    });
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopRecordingStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const resetRecordingState = () => {
    stopRecordingTimer();
    stopRecordingStream();
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    recordingStartedAtRef.current = 0;
    setIsPreparingRecording(false);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const getRecordingDurationSeconds = () => {
    const startedAt = recordingStartedAtRef.current;
    if (!startedAt) return Math.max(1, recordingSeconds);
    const elapsedSeconds = Math.ceil((Date.now() - startedAt) / 1000);
    return Math.min(
      Math.max(1, elapsedSeconds),
      MAX_VOICE_DURATION_SECONDS,
    );
  };

  const uploadVoiceRecording = async (blob, mimeType, durationSeconds) => {
    if (!onUploadAttachment || !onSend) return;

    const baseMimeType = getBaseMimeType(mimeType);
    const extension = getAudioExtension(baseMimeType);
    const voiceFile = new File([blob], `voice-${Date.now()}.${extension}`, {
      type: baseMimeType,
    });

    setIsVoiceSending(true);
    setAttachmentError("");
    setRecordingError("");
    setShowFormattingToolbar(false);

    try {
      const attachment = await onUploadAttachment(voiceFile, {
        purpose: "voice",
      });
      const voiceAttachment = {
        ...attachment,
        mimeType: attachment.mimeType || baseMimeType,
        kind: "voice",
        durationSeconds,
      };

      await onSend("", {
        type: "audio",
        attachments: [voiceAttachment],
        metadata: {
          durationSeconds,
          attachmentKind: "voice",
        },
      });
      onTypingChange?.(false);
    } catch (error) {
      console.error("Failed to send voice message:", error);
      setAttachmentError("Không thể gửi tin nhắn thoại.");
    } finally {
      setIsVoiceSending(false);
      editorRef.current?.focus();
    }
  };

  const stopRecording = (action) => {
    const recorder = mediaRecorderRef.current;
    pendingRecordingActionRef.current = action;

    if (!recorder || recorder.state === "inactive") {
      resetRecordingState();
      return;
    }

    recorder.stop();
  };

  const stopAndSendRecording = () => {
    stopRecording("send");
  };

  const cancelRecording = () => {
    if (isPreparingRecording) {
      recordingRequestCancelledRef.current = true;
      setIsPreparingRecording(false);
      setRecordingSeconds(0);
      return;
    }

    stopRecording("cancel");
  };

  const startRecordingTimer = () => {
    stopRecordingTimer();
    recordingTimerRef.current = window.setInterval(() => {
      const elapsedSeconds = getRecordingDurationSeconds();
      setRecordingSeconds(elapsedSeconds);

      if (elapsedSeconds >= MAX_VOICE_DURATION_SECONDS) {
        stopAndSendRecording();
      }
    }, 250);
  };

  const startRecording = async () => {
    if (
      disabled ||
      isUploading ||
      isVoiceSending ||
      isPreparingRecording ||
      mode === "edit"
    ) {
      return;
    }
    if (!onUploadAttachment || !onSend) return;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecordingError("Trình duyệt không hỗ trợ thu âm trực tiếp.");
      return;
    }

    setAttachmentError("");
    setRecordingError("");
    setShowFormattingToolbar(false);
    setRecordingSeconds(0);
    setIsPreparingRecording(true);
    recordingRequestCancelledRef.current = false;

    let stream = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recordingRequestCancelledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      mediaStreamRef.current = stream;
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      pendingRecordingActionRef.current = "cancel";
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const action = pendingRecordingActionRef.current;
        const durationSeconds = getRecordingDurationSeconds();
        const recorderMimeType = recorder.mimeType || mimeType || "audio/webm";
        const voiceBlob = new Blob(recordingChunksRef.current, {
          type: getBaseMimeType(recorderMimeType),
        });

        resetRecordingState();

        if (action === "send") {
          if (voiceBlob.size === 0) {
            setAttachmentError("Không có dữ liệu thu âm.");
            return;
          }
          void uploadVoiceRecording(
            voiceBlob,
            recorderMimeType,
            durationSeconds,
          );
        }
      };

      recorder.start(250);
      setIsPreparingRecording(false);
      setIsRecording(true);
      setRecordingSeconds(0);
      startRecordingTimer();
    } catch (error) {
      console.error("Failed to start voice recording:", error);
      stream?.getTracks().forEach((track) => track.stop());
      stopRecordingStream();
      if (recordingRequestCancelledRef.current) return;
      setIsPreparingRecording(false);
      setRecordingError("Không thể truy cập microphone.");
    }
  };

  const selectMentionOption = useCallback(
    (option) => {
      if (!option) return;

      const currentContent = serializeComposerContent(editorRef.current);
      const label = option.isEveryone ? "mọi người" : option.label;
      const replacement = `**@${label}** `;
      const nextContent = currentContent.match(mentionTriggerPattern)
        ? currentContent.replace(mentionTriggerPattern, `$1${replacement}`)
        : `${currentContent}${currentContent ? " " : ""}${replacement}`;

      pendingInlineFormatsRef.current = null;
      updateContent(nextContent);
      setEditorContentFromMarkdown(nextContent);
      setIsMentionMenuOpen(false);
      setMentionQuery("");
      setActiveMentionIndex(0);

      if (option.isEveryone) {
        setMentionEveryone(true);
      } else if (option.id) {
        setSelectedMentionIds((currentIds) =>
          currentIds.includes(option.id) ? currentIds : [...currentIds, option.id],
        );
      }

      window.requestAnimationFrame(() => {
        focusEditorAtEnd();
        updateActiveFormatState();
      });
    },
    [
      focusEditorAtEnd,
      setEditorContentFromMarkdown,
      updateActiveFormatState,
      updateContent,
    ],
  );

  const handleSend = () => {
    const currentContent = serializeComposerContent(editorRef.current);
    const trimmed = currentContent.trim();

    if (
      (!trimmed && attachments.length === 0) ||
      disabled ||
      isUploading ||
      isVoiceSending ||
      isPreparingRecording ||
      isRecording
    ) {
      return;
    }
    const selectedMentionsInContent = selectedMentionIds.filter((mentionId) => {
      const user = normalizedMentionableUsers.find(
        (member) => getMentionUserId(member) === mentionId,
      );
      if (!user?.fullName) return true;
      return trimmed.includes(`@${user.fullName}`);
    });
    const mentionEveryoneInContent =
      mentionEveryone && /@mọi người/i.test(trimmed);

    onSend?.(trimmed, {
      type: "text",
      attachments,
      mentions: selectedMentionsInContent,
      mentionEveryone: mentionEveryoneInContent,
    });
    pendingInlineFormatsRef.current = null;
    setContent("");
    setEditorContentFromMarkdown("");
    setAttachments([]);
    setAttachmentError("");
    setRecordingError("");
    setSelectedMentionIds([]);
    setMentionEveryone(false);
    setIsMentionMenuOpen(false);
    setMentionQuery("");
    onTypingChange?.(false);
    editorRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (isMentionMenuOpen && mentionOptions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveMentionIndex((index) => (index + 1) % mentionOptions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveMentionIndex(
          (index) => (index - 1 + mentionOptions.length) % mentionOptions.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMentionOption(mentionOptions[activeMentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsMentionMenuOpen(false);
        return;
      }
    }

    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "x") {
      e.preventDefault();
      setShowFormattingToolbar((value) => !value);
      return;
    }

    if (e.key === "Enter" && e.shiftKey) {
      let isListActive = false;

      try {
        isListActive =
          typeof document !== "undefined" &&
          (document.queryCommandState("insertUnorderedList") ||
            document.queryCommandState("insertOrderedList"));
      } catch {
        isListActive = false;
      }

      if (isListActive) {
        e.preventDefault();
        runEditorCommand("insertParagraph", null, { restoreSelection: false });
      }
      return;
    }

    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "PageUp",
        "PageDown",
      ].includes(e.key)
    ) {
      pendingInlineFormatsRef.current = null;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    if (e.key === "Escape" && mode !== "send") {
      onCancelDraft?.();
    }
  };

  const handleBeforeInput = useCallback((event) => {
    if (event.defaultPrevented) return;
    if (!pendingInlineFormatsRef.current) return;

    const nativeEvent = event.nativeEvent || event;
    const inputType = nativeEvent.inputType || "";

    if (nativeEvent.isComposing || inputType !== "insertText") return;

    const value = nativeEvent.data || "";
    if (!value) return;

    event.preventDefault();
    insertFormattedText(value);
  }, [insertFormattedText]);

  const runEditorCommand = (
    command,
    value = null,
    { restoreSelection = true } = {},
  ) => {
    if (typeof document === "undefined" || !command) return;
    pendingInlineFormatsRef.current = null;

    if (restoreSelection) {
      restoreEditorSelection();
    }

    try {
      document.execCommand(command, false, value);
    } catch (error) {
      console.error("Failed to run editor command:", error);
    }

    syncContentFromEditor();
    window.requestAnimationFrame(() => {
      saveEditorSelection();
      updateActiveFormatState();
    });
  };

  const clearEditorFormatting = () => {
    if (typeof document === "undefined") return;

    const editor = editorRef.current;
    const range = getRestoredEditorRange();

    if (!editor || !range) return;

    disableActiveListCommands();

    if (range.collapsed) {
      const nextFormats = createEmptyInlineFormats();
      pendingInlineFormatsRef.current = nextFormats;
      normalizeCollapsedRangeForInlineFormats(range, editor, nextFormats);
      setEditorSelectionRange(range);
      setActiveFormats((current) => ({
        ...current,
        ...nextFormats,
        fontSmall: false,
        fontNormal: true,
        fontLarge: false,
      }));
      refreshEditorFormatState();
      return;
    }

    pendingInlineFormatsRef.current = null;

    inlineFormatActions.forEach((action) => {
      splitFormatAtSelectionBoundaries(range, action, editor);
    });

    const fragment = range.extractContents();
    stripInlineFormatElements(fragment, inlineFormatActions, {
      includeFontScale: true,
    });
    replaceSelectionWithFragment(range, fragment);
    cleanupEditorInlineArtifacts(editor);
    refreshEditorFormatState();
  };

  const handleFormat = (action) => {
    if (!action) return;

    if (action === "clear") {
      clearEditorFormatting();
      return;
    }

    if (inlineFormatDefinitions[action]) {
      toggleInlineFormat(action);
      return;
    }

    if (fontSizeCommandValueByAction[action]) {
      runEditorCommand("fontSize", fontSizeCommandValueByAction[action]);
      return;
    }

    runEditorCommand(commandByFormatAction[action]);
  };

  const insertText = (value) => {
    if (pendingInlineFormatsRef.current && insertFormattedText(value)) return;
    runEditorCommand("insertText", value);
  };

  const handlePaste = (event) => {
    const text = event.clipboardData?.getData("text/plain");
    if (!text) return;

    event.preventDefault();
    if (pendingInlineFormatsRef.current && insertFormattedText(text)) return;
    runEditorCommand("insertText", text);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadAttachment) return;

    setIsUploading(true);
    setAttachmentError("");

    try {
      const attachment = await onUploadAttachment(file);
      setAttachments((prev) => [...prev, attachment]);
    } catch {
      setAttachmentError("Không thể tải file đính kèm.");
    } finally {
      setIsUploading(false);
    }
  };

  const hasComposerContent = Boolean(content.trim()) || attachments.length > 0;
  const composerBusy =
    disabled || isUploading || isVoiceSending || isPreparingRecording;
  const canAttach =
    Boolean(onUploadAttachment) &&
    mode !== "edit" &&
    !isPreparingRecording &&
    !isRecording &&
    !isVoiceSending;
  const canRecord =
    Boolean(onUploadAttachment) &&
    Boolean(onSend) &&
    mode !== "edit" &&
    !disabled &&
    !isUploading &&
    !isPreparingRecording &&
    !isVoiceSending &&
    !hasComposerContent;
  const canCreatePoll =
    Boolean(onCreatePoll) &&
    mode === "send" &&
    !disabled &&
    !isUploading &&
    !isPreparingRecording &&
    !isRecording &&
    !isVoiceSending;
  const canCreateReminder =
    Boolean(onCreateReminder) &&
    mode === "send" &&
    !disabled &&
    !isUploading &&
    !isPreparingRecording &&
    !isRecording &&
    !isVoiceSending;
  const canSend =
    hasComposerContent && !composerBusy && !isRecording;
  const isRecorderVisible = isPreparingRecording || isRecording;
  const recordingProgress = Math.min(
    100,
    (recordingSeconds / MAX_VOICE_DURATION_SECONDS) * 100,
  );
  const visibleDraftPreview = renderedDraftPreview;

  useEffect(() => {
    if (hasHydratedEditorRef.current) return;

    hasHydratedEditorRef.current = true;
    pendingInlineFormatsRef.current = null;
    setEditorContentFromMarkdown(initialContent);
  }, [initialContent, setEditorContentFromMarkdown]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.addEventListener("selectionchange", updateActiveFormatState);

    return () => {
      document.removeEventListener("selectionchange", updateActiveFormatState);
    };
  }, [updateActiveFormatState]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return undefined;

    editor.addEventListener("beforeinput", handleBeforeInput);

    return () => {
      editor.removeEventListener("beforeinput", handleBeforeInput);
    };
  }, [handleBeforeInput]);

  useEffect(() => {
    const nextDraftIdentity = draftPreview
      ? `${draftPreview.variant}-${draftPreview.id}`
      : `mode-${mode}`;

    if (draftIdentityRef.current !== nextDraftIdentity) {
      draftIdentityRef.current = nextDraftIdentity;
      const nextContent = mode === "edit" ? initialContent : "";
      pendingInlineFormatsRef.current = null;
      setContent(nextContent);
      setEditorContentFromMarkdown(nextContent);
      setAttachments([]);
      setAttachmentError("");
      setRecordingError("");
      setSelectedMentionIds([]);
      setMentionEveryone(false);
      setIsMentionMenuOpen(false);
      setMentionQuery("");
      recordingRequestCancelledRef.current = true;
      setIsPreparingRecording(false);
      const recorder = mediaRecorderRef.current;
      if (recorder?.state === "recording") {
        pendingRecordingActionRef.current = "cancel";
        recorder.stop();
      }
      onTypingChange?.(false);
    }
  }, [
    draftPreview,
    initialContent,
    mode,
    onTypingChange,
    setEditorContentFromMarkdown,
  ]);

  useEffect(() => {
    if (mode !== "send") {
      setIsPollModalOpen(false);
      setIsReminderModalOpen(false);
    }
  }, [mode]);

  useEffect(() => {
    return () => {
      recordingRequestCancelledRef.current = true;
      stopRecordingTimer();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      stopRecordingStream();
    };
  }, []);

  useEffect(() => {
    if (draftPreview) {
      setRenderedDraftPreview(draftPreview);
      setIsDraftExiting(false);
      return undefined;
    }

    if (!renderedDraftPreview) return undefined;

    setIsDraftExiting(true);
    const timeoutId = window.setTimeout(() => {
      setRenderedDraftPreview(null);
      setIsDraftExiting(false);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [draftPreview, renderedDraftPreview]);

  return (
    <>
    <div
      className={`bg-white px-3 pb-3 pt-3 sm:px-6 sm:pb-4 ${
        visibleDraftPreview
          ? "chat-composer-draft-shell"
          : "border-t border-slate-200"
      }`}
    >
      <div className="chat-composer-shell flex flex-col overflow-visible rounded-2xl border border-slate-300 bg-white shadow-sm transition-all focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20">
        {visibleDraftPreview && (
          <div
            className={`chat-draft-toast-slot ${
              isDraftExiting ? "is-exiting" : "is-entering"
            }`}
          >
            <div className="chat-draft-toast-slot-inner">
              <div className="px-3 pt-3">
                <div
                  key={visibleDraftPreview.id}
                  className={`chat-draft-toast chat-draft-toast-${visibleDraftPreview.variant} ${
                    isDraftExiting ? "is-exiting" : "is-entering"
                  } flex items-center justify-between gap-3 rounded-xl px-3 py-2.5`}
                >
                  <span className="chat-draft-toast-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                    <span className="material-symbols-outlined text-[17px]">
                      {visibleDraftPreview.icon}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold">
                      {visibleDraftPreview.title}
                    </span>
                    <span className="block truncate text-xs font-medium">
                      {visibleDraftPreview.text}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={onCancelDraft}
                    className="chat-draft-toast-close inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
                    title="Hủy"
                    aria-label="Hủy"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      close
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          className={`flex items-center gap-2 overflow-x-auto bg-slate-50/80 px-3 py-2 ${
            visibleDraftPreview ? "" : "rounded-t-2xl"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={composerBusy || !canAttach}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
              title="Đính kèm file"
              aria-label="Đính kèm file"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isUploading ? "sync" : "attach_file"}
              </span>
            </button>

            {secondaryComposerActions.map((item) => (
              <button
                key={item.title}
                type="button"
                disabled
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300"
                title={`${item.title} (sắp có)`}
                aria-label={item.title}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {item.icon}
                </span>
              </button>
            ))}

            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                saveEditorSelection();
              }}
              onClick={() => {
                setShowFormattingToolbar((value) => !value);
                editorRef.current?.focus();
              }}
              disabled={isRecorderVisible || isVoiceSending}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                showFormattingToolbar
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              } disabled:cursor-not-allowed disabled:text-slate-300`}
              title="Định dạng tin nhắn"
              aria-label="Định dạng tin nhắn"
              aria-pressed={showFormattingToolbar}
            >
              <span className="material-symbols-outlined text-[20px]">
                border_color
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsPollModalOpen(true)}
              disabled={!canCreatePoll}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
              title="Tạo bình chọn"
              aria-label="Tạo bình chọn"
            >
              <span className="material-symbols-outlined text-[20px]">
                bar_chart
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsReminderModalOpen(true)}
              disabled={!canCreateReminder}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
              title="Tạo nhắc hẹn"
              aria-label="Tạo nhắc hẹn"
            >
              <span className="material-symbols-outlined text-[20px]">
                alarm
              </span>
            </button>

            <button
              type="button"
              onClick={startRecording}
              disabled={!canRecord || isRecorderVisible}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed ${
                isRecorderVisible
                  ? "bg-red-50 text-red-600"
                  : "text-slate-600 hover:bg-violet-50 hover:text-violet-700 disabled:text-slate-300"
              }`}
              title={
                hasComposerContent
                  ? "Gửi hoặc xóa nội dung hiện tại trước khi thu âm"
                  : "Thu âm voice"
              }
              aria-label="Thu âm voice"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isRecorderVisible ? "graphic_eq" : "mic"}
              </span>
            </button>

          </div>
        </div>

        {(attachments.length > 0 || attachmentError || recordingError) && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map((attachment, index) => (
              <span
                key={`${attachment.fileUrl}-${index}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                <span className="material-symbols-outlined text-[14px]">
                  attach_file
                </span>
                <span className="max-w-40 truncate">{attachment.fileName}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) =>
                      prev.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  className="text-slate-500 hover:text-red-600"
                  title="Gỡ file đính kèm"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    close
                  </span>
                </button>
              </span>
            ))}
            {attachmentError && (
              <span className="text-xs font-semibold text-red-600">
                {attachmentError}
              </span>
            )}
            {recordingError && (
              <span className="text-xs font-semibold text-red-600">
                {recordingError}
              </span>
            )}
          </div>
        )}

        <div className="chat-composer-input-shell relative flex items-center">
          {isMentionMenuOpen && mentionOptions.length > 0 && !isRecorderVisible && (
            <div className="chat-mention-menu absolute bottom-[calc(100%+0.55rem)] left-3 right-3 z-40 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/16">
              <div className="mb-1 flex items-center gap-2 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
                <span className="material-symbols-outlined text-[15px]">
                  alternate_email
                </span>
                Đề cập
              </div>
              {mentionOptions.map((option, index) => {
                const avatarUrl = getAvatarUrl(option.avatar);
                const isActive = index === activeMentionIndex;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveMentionIndex(index)}
                    onClick={() => selectMentionOption(option)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {option.isEveryone ? (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                        <span className="material-symbols-outlined text-[19px]">
                          groups
                        </span>
                      </span>
                    ) : avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={option.label}
                        referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
                        className="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600 ring-1 ring-slate-200">
                        {option.label.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold">
                        @{option.label}
                      </span>
                      <span className="block truncate text-xs font-semibold text-slate-500">
                        {option.subLabel}
                      </span>
                    </span>
                    {isActive && (
                      <span className="material-symbols-outlined text-[18px]">
                        keyboard_return
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {isRecorderVisible ? (
            <div className="chat-voice-recorder flex w-full items-center gap-3 px-3 py-3">
              <button
                type="button"
                onClick={cancelRecording}
                className="chat-voice-recorder-trash inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Hủy thu âm"
                aria-label="Hủy thu âm"
              >
                <span className="material-symbols-outlined text-[22px]">
                  delete
                </span>
              </button>
              <div
                className={`chat-voice-recorder-track min-w-0 flex-1 ${
                  isPreparingRecording ? "is-preparing" : "is-recording"
                }`}
              >
                <span
                  className="chat-voice-recorder-progress"
                  style={{ width: `${recordingProgress}%` }}
                />
                <div className="relative z-10 flex min-w-0 items-center gap-3">
                  <span className="chat-voice-recorder-live" aria-hidden="true" />
                  <span className="w-11 shrink-0 text-sm font-extrabold text-white">
                    {isPreparingRecording
                      ? "0:00"
                      : formatAudioDuration(recordingSeconds)}
                  </span>
                  {isPreparingRecording && (
                    <span className="chat-voice-recorder-status">
                      Đang bật mic...
                    </span>
                  )}
                  <span
                    className="chat-voice-recorder-waveform"
                    aria-hidden="true"
                  >
                    {recorderWaveformBars.map((height, index) => (
                      <span
                        key={`${height}-${index}`}
                        style={{
                          "--bar-height": `${height}%`,
                          "--bar-index": index,
                        }}
                      />
                    ))}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={stopAndSendRecording}
                disabled={isPreparingRecording}
                className="chat-voice-recorder-send inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm shadow-violet-900/20 transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                title="Gửi voice"
                aria-label="Gửi voice"
              >
                <span className="material-symbols-outlined text-[22px]">
                  send
                </span>
              </button>
            </div>
          ) : isVoiceSending ? (
            <div className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600">
              <span className="material-symbols-outlined animate-spin text-[20px] text-violet-600">
                progress_activity
              </span>
              <span>Đang gửi tin nhắn thoại...</span>
            </div>
          ) : (
            <>
              <div
                ref={editorRef}
                contentEditable={!disabled}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-disabled={disabled}
                data-disabled={disabled ? "true" : "false"}
                data-placeholder={placeholder}
                onInput={syncContentFromEditor}
                onKeyDown={handleKeyDown}
                onKeyUp={() => {
                  saveEditorSelection();
                  updateActiveFormatState();
                }}
                onMouseDown={() => {
                  pendingInlineFormatsRef.current = null;
                }}
                onMouseUp={() => {
                  saveEditorSelection();
                  updateActiveFormatState();
                }}
                onFocus={() => {
                  saveEditorSelection();
                  updateActiveFormatState();
                }}
                onBlur={() => {
                  saveEditorSelection();
                  onTypingChange?.(false);
                }}
                onPaste={handlePaste}
                className="chat-composer-editor w-full overflow-y-auto border-none bg-transparent px-4 py-3.5 pr-24 text-[15px] font-medium text-slate-900 outline-none focus:ring-0"
              />
              <EmojiPickerButton
                align="right"
                buttonClassName="chat-composer-emoji-button"
                className="absolute right-12 top-2"
                label="Biểu tượng cảm xúc"
                onEmojiSelect={insertText}
                placement="top"
                popoverClassName="chat-composer-emoji-popover"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-900/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                title={mode === "edit" ? "Lưu chỉnh sửa" : "Gửi tin nhắn"}
                aria-label={mode === "edit" ? "Lưu chỉnh sửa" : "Gửi tin nhắn"}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {mode === "edit" ? "check" : "send"}
                </span>
              </button>
            </>
          )}
        </div>

        {showFormattingToolbar && (
          <div className="chat-format-panel rounded-b-2xl border-t border-slate-200 bg-white px-3 py-3 text-slate-700">
            <div className="flex flex-wrap items-center gap-1">
              {formatToolbarItems.map((item, index) =>
                item.divider ? (
                  <span
                    key={`format-divider-${index}`}
                    className="mx-1 h-6 w-px bg-slate-200"
                  />
                ) : (
                  <button
                    key={item.title}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      saveEditorSelection();
                    }}
                    onClick={() => handleFormat(item.action)}
                    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 transition-colors ${
                      item.action && activeFormats[item.action]
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                    title={item.title}
                    aria-label={item.title}
                    aria-pressed={
                      item.action &&
                      (item.command || fontSizeCommandValueByAction[item.action])
                        ? Boolean(activeFormats[item.action])
                        : undefined
                    }
                  >
                    {item.icon ? (
                      <span className="material-symbols-outlined text-[20px]">
                        {item.icon}
                      </span>
                    ) : (
                      <span className={item.className}>{item.label}</span>
                    )}
                  </button>
                )
              )}
            </div>
            {mode !== "send" && (
              <button
                type="button"
                onClick={onCancelDraft}
                className="mt-3 text-sm font-semibold text-slate-600 transition-colors hover:text-blue-700"
              >
                Hủy
              </button>
            )}
          </div>
        )}
      </div>
    </div>
    <PollCreateModal
      isOpen={isPollModalOpen}
      onClose={() => setIsPollModalOpen(false)}
      onCreatePoll={onCreatePoll}
      disabled={!canCreatePoll}
    />
    <ReminderCreateModal
      isOpen={isReminderModalOpen}
      onClose={() => setIsReminderModalOpen(false)}
      onCreateReminder={onCreateReminder}
      disabled={!canCreateReminder}
    />
    </>
  );
};

export default ChatInput;
