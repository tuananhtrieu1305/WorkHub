const formatConfigs = {
  bold: {
    prefix: "**",
    suffix: "**",
    placeholder: "văn bản",
  },
  italic: {
    prefix: "_",
    suffix: "_",
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

export const applyComposerFormat = ({
  text,
  selectionStart,
  selectionEnd,
  action,
}) => {
  if (action === "list") {
    return prefixSelectedLines({ text, selectionStart, selectionEnd });
  }

  const config = formatConfigs[action];
  if (!config) {
    return { text, selectionStart, selectionEnd };
  }

  return wrapSelection({ text, selectionStart, selectionEnd }, config);
};
