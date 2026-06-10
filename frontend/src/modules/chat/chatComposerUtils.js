const formatConfigs = {
  bold: {
    prefix: "**",
    suffix: "**",
    placeholder: "văn bản",
  },
  italic: {
    prefix: "*",
    suffix: "*",
    placeholder: "văn bản",
  },
  underline: {
    prefix: "<u>",
    suffix: "</u>",
    placeholder: "văn bản",
  },
  strike: {
    prefix: "~~",
    suffix: "~~",
    placeholder: "văn bản",
  },
  code: {
    prefix: "`",
    suffix: "`",
    placeholder: "code",
  },
  link: {
    prefix: "[",
    suffix: "](https://)",
    placeholder: "liên kết",
  },
};

const wrapSelection = ({ text, selectionStart, selectionEnd }, config) => {
  const selectedText = text.slice(selectionStart, selectionEnd) || config.placeholder;
  const nextText = `${text.slice(0, selectionStart)}${config.prefix}${selectedText}${config.suffix}${text.slice(selectionEnd)}`;
  const nextSelectionStart = selectionStart + config.prefix.length;

  return {
    text: nextText,
    selectionStart: nextSelectionStart,
    selectionEnd: nextSelectionStart + selectedText.length,
  };
};

const prefixSelectedLines = ({ text, selectionStart, selectionEnd }) => {
  const selectedText = text.slice(selectionStart, selectionEnd) || "mục danh sách";
  const prefixedText = selectedText
    .split("\n")
    .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
    .join("\n");

  return {
    text: `${text.slice(0, selectionStart)}${prefixedText}${text.slice(selectionEnd)}`,
    selectionStart,
    selectionEnd: selectionStart + prefixedText.length,
  };
};

const numberSelectedLines = ({ text, selectionStart, selectionEnd }) => {
  const selectedText = text.slice(selectionStart, selectionEnd) || "mục danh sách";
  const numberedText = selectedText
    .split("\n")
    .map((line, index) =>
      /^\d+\.\s/.test(line) ? line : `${index + 1}. ${line}`
    )
    .join("\n");

  return {
    text: `${text.slice(0, selectionStart)}${numberedText}${text.slice(selectionEnd)}`,
    selectionStart,
    selectionEnd: selectionStart + numberedText.length,
  };
};

const updateSelectedLines = (
  { text, selectionStart, selectionEnd },
  fallback,
  updateLine
) => {
  const selectedText = text.slice(selectionStart, selectionEnd) || fallback;
  const nextSelectedText = selectedText.split("\n").map(updateLine).join("\n");

  return {
    text: `${text.slice(0, selectionStart)}${nextSelectedText}${text.slice(selectionEnd)}`,
    selectionStart,
    selectionEnd: selectionStart + nextSelectedText.length,
  };
};

const toggleSelectionCase = ({ text, selectionStart, selectionEnd }) => {
  return updateSelectedLines(
    { text, selectionStart, selectionEnd },
    "văn bản",
    (line) => (line === line.toUpperCase() ? line.toLowerCase() : line.toUpperCase())
  );
};

const clearFormatting = ({ text, selectionStart, selectionEnd }) => {
  const selectedText = text.slice(selectionStart, selectionEnd) || text;
  const nextSelectedText = selectedText
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/<u>([^<]+)<\/u>/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const targetStart = selectionStart === selectionEnd ? 0 : selectionStart;
  const targetEnd = selectionStart === selectionEnd ? text.length : selectionEnd;

  return {
    text: `${text.slice(0, targetStart)}${nextSelectedText}${text.slice(targetEnd)}`,
    selectionStart: targetStart,
    selectionEnd: targetStart + nextSelectedText.length,
  };
};

export const applyComposerFormat = ({
  text,
  selectionStart,
  selectionEnd,
  action,
}) => {
  if (action === "list") {
    return prefixSelectedLines({ text, selectionStart, selectionEnd });
  }

  if (action === "orderedList") {
    return numberSelectedLines({ text, selectionStart, selectionEnd });
  }

  if (action === "indent") {
    return updateSelectedLines(
      { text, selectionStart, selectionEnd },
      "văn bản",
      (line) => `  ${line}`
    );
  }

  if (action === "outdent") {
    return updateSelectedLines(
      { text, selectionStart, selectionEnd },
      "văn bản",
      (line) => line.replace(/^ {1,2}/, "")
    );
  }

  if (action === "case") {
    return toggleSelectionCase({ text, selectionStart, selectionEnd });
  }

  if (action === "clear") {
    return clearFormatting({ text, selectionStart, selectionEnd });
  }

  const config = formatConfigs[action];
  if (!config) {
    return { text, selectionStart, selectionEnd };
  }

  return wrapSelection({ text, selectionStart, selectionEnd }, config);
};
