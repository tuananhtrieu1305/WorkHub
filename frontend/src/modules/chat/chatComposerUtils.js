const blockElementNames = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "FOOTER", "HEADER", "H1", "H2", "H3", "H4", "H5", "H6", "MAIN", "P", "PRE", "SECTION"]);

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const sanitizeHref = (href = "") => {
  const normalizedHref = String(href || "").trim();
  return /^(https?:|mailto:)/i.test(normalizedHref) ? normalizedHref : "#";
};

const findClosingSingleAsterisk = (value, fromIndex) => {
  let index = value.indexOf("*", fromIndex);

  while (index !== -1) {
    if (value[index - 1] !== "*" && value[index + 1] !== "*") {
      return index;
    }

    index = value.indexOf("*", index + 1);
  }

  return -1;
};

const findLinkToken = (value, fromIndex) => {
  const start = value.indexOf("[", fromIndex);
  if (start === -1) return null;

  const labelEnd = value.indexOf("](", start + 1);
  if (labelEnd === -1) return null;

  const hrefEnd = value.indexOf(")", labelEnd + 2);
  if (hrefEnd === -1) return null;

  return {
    start,
    end: hrefEnd + 1,
    node: {
      type: "link",
      href: sanitizeHref(value.slice(labelEnd + 2, hrefEnd)),
      children: parseInlineMarkdown(value.slice(start + 1, labelEnd)),
    },
  };
};

const findDelimitedToken = (value, fromIndex, token) => {
  const start = value.indexOf(token.open, fromIndex);
  if (start === -1) return null;

  const contentStart = start + token.open.length;
  const close =
    token.open === "*"
      ? findClosingSingleAsterisk(value, contentStart)
      : value.indexOf(token.close, contentStart);

  if (close === -1) return null;

  const rawContent = value.slice(contentStart, close);
  if (!rawContent) return null;

  return {
    start,
    end: close + token.close.length,
    node:
      token.type === "code"
        ? { type: "code", text: rawContent }
        : { type: token.type, children: parseInlineMarkdown(rawContent) },
  };
};

const inlineTokens = [
  { type: "code", open: "`", close: "`", priority: 0 },
  { type: "strong", open: "**", close: "**", priority: 1 },
  { type: "strike", open: "~~", close: "~~", priority: 2 },
  { type: "underline", open: "<u>", close: "</u>", priority: 3 },
  { type: "small", open: "<small>", close: "</small>", priority: 4 },
  { type: "big", open: "<big>", close: "</big>", priority: 5 },
  { type: "emphasis", open: "*", close: "*", priority: 6 },
];

const findNextInlineToken = (value, fromIndex) => {
  const candidates = [
    findLinkToken(value, fromIndex),
    ...inlineTokens.map((token) => findDelimitedToken(value, fromIndex, token)),
  ].filter(Boolean);

  if (!candidates.length) return null;

  return candidates.sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    const leftPriority =
      inlineTokens.find((token) => token.type === left.node.type)?.priority ??
      0;
    const rightPriority =
      inlineTokens.find((token) => token.type === right.node.type)?.priority ??
      0;
    return leftPriority - rightPriority;
  })[0];
};

export const parseInlineMarkdown = (text = "") => {
  const value = String(text);
  const nodes = [];
  let index = 0;

  while (index < value.length) {
    const token = findNextInlineToken(value, index);

    if (!token) {
      nodes.push({ type: "text", text: value.slice(index) });
      break;
    }

    if (token.start > index) {
      nodes.push({ type: "text", text: value.slice(index, token.start) });
    }

    nodes.push(token.node);
    index = token.end;
  }

  return nodes.filter((node) => node.type !== "text" || node.text);
};

const inlineNodesToHtml = (nodes = []) =>
  nodes
    .map((node) => {
      if (node.type === "text") return escapeHtml(node.text);
      if (node.type === "code") return `<code>${escapeHtml(node.text)}</code>`;
      if (node.type === "link") {
        return `<a href="${escapeHtml(node.href)}" target="_blank" rel="noreferrer">${inlineNodesToHtml(node.children)}</a>`;
      }

      const children = inlineNodesToHtml(node.children);

      if (node.type === "strong") return `<strong>${children}</strong>`;
      if (node.type === "emphasis") return `<em>${children}</em>`;
      if (node.type === "underline") return `<u>${children}</u>`;
      if (node.type === "strike") return `<s>${children}</s>`;
      if (node.type === "small") return `<small>${children}</small>`;
      if (node.type === "big") return `<big>${children}</big>`;

      return children;
    })
    .join("");

const isBulletLine = (line) => line.trim().startsWith("- ");

const isOrderedLine = (line) => /^\d+\.\s/.test(line.trim());

const trimListMarker = (line) =>
  line.trim().replace(/^(?:-\s|\d+\.\s)/, "");

const inlineMarkdownToHtml = (text = "") => {
  return inlineNodesToHtml(parseInlineMarkdown(text));
};

export const markdownToComposerHtml = (markdown = "") => {
  if (!markdown) return "";

  const lines = String(markdown).split(/\r?\n/);
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (isBulletLine(line) || isOrderedLine(line)) {
      const listType = isOrderedLine(line) ? "ol" : "ul";
      const items = [];

      while (
        index < lines.length &&
        (listType === "ol" ? isOrderedLine(lines[index]) : isBulletLine(lines[index]))
      ) {
        items.push(`<li>${inlineMarkdownToHtml(trimListMarker(lines[index]))}</li>`);
        index += 1;
      }

      blocks.push(`<${listType}>${items.join("")}</${listType}>`);
      continue;
    }

    const textLines = [];
    while (
      index < lines.length &&
      !isBulletLine(lines[index]) &&
      !isOrderedLine(lines[index])
    ) {
      textLines.push(inlineMarkdownToHtml(lines[index]));
      index += 1;
    }
    blocks.push(textLines.join("<br>"));
  }

  return blocks.join("<br>");
};

const normalizeTextContent = (value = "") =>
  String(value).replace(/\u00a0/g, " ");

const getElementTextDecoration = (element) =>
  `${element.style?.textDecoration || ""} ${element.style?.textDecorationLine || ""}`;

const isStrongElement = (element) => {
  const tagName = element.tagName;
  const fontWeight = element.style?.fontWeight || "";
  return (
    tagName === "B" ||
    tagName === "STRONG" ||
    fontWeight === "bold" ||
    Number.parseInt(fontWeight, 10) >= 600
  );
};

const isEmphasisElement = (element) =>
  element.tagName === "I" ||
  element.tagName === "EM" ||
  element.style?.fontStyle === "italic";

const isUnderlineElement = (element) =>
  element.tagName === "U" || getElementTextDecoration(element).includes("underline");

const isStrikeElement = (element) =>
  ["S", "STRIKE", "DEL"].includes(element.tagName) ||
  getElementTextDecoration(element).includes("line-through");

const getElementFontScale = (element) => {
  const tagName = element.tagName;
  const fontSizeAttribute = element.getAttribute?.("size");
  const inlineFontSize = element.style?.fontSize || "";

  if (tagName === "SMALL") return "small";
  if (tagName === "BIG") return "big";
  if (tagName === "FONT" && fontSizeAttribute) {
    const size = Number.parseInt(fontSizeAttribute, 10);
    if (size <= 2) return "small";
    if (size >= 4) return "big";
  }

  if (/^(x-small|small|smaller)$/i.test(inlineFontSize)) return "small";
  if (/^(large|x-large|xx-large|larger)$/i.test(inlineFontSize)) return "big";

  const pixelSize = Number.parseFloat(inlineFontSize);
  if (Number.isFinite(pixelSize)) {
    if (/rem$/i.test(inlineFontSize)) {
      if (pixelSize <= 0.9) return "small";
      if (pixelSize >= 1.1) return "big";
    } else if (/em$/i.test(inlineFontSize)) {
      if (pixelSize <= 0.9) return "small";
      if (pixelSize >= 1.1) return "big";
    } else if (/px$/i.test(inlineFontSize)) {
      if (pixelSize <= 14) return "small";
      if (pixelSize >= 17) return "big";
    }
  }

  return "";
};

const wrapMarkdown = (value, prefix, suffix = prefix) => {
  if (!value) return "";
  return `${prefix}${value}${suffix}`;
};

const serializeInlineChildren = (element) =>
  Array.from(element.childNodes)
    .map((child) => serializeInlineNode(child))
    .join("");

const serializeInlineNode = (node) => {
  if (!node) return "";

  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeTextContent(node.textContent || "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node;
  const tagName = element.tagName;

  if (tagName === "BR") return "\n";

  if (tagName === "UL" || tagName === "OL") {
    return `\n${serializeListElement(element)}`;
  }

  let value = serializeInlineChildren(element);

  if (tagName === "A") {
    return `[${value}](${sanitizeHref(element.getAttribute("href"))})`;
  }

  if (tagName === "CODE") value = wrapMarkdown(value, "`");
  if (isStrikeElement(element)) value = wrapMarkdown(value, "~~");
  if (isUnderlineElement(element)) value = wrapMarkdown(value, "<u>", "</u>");
  if (isEmphasisElement(element)) value = wrapMarkdown(value, "*");
  if (isStrongElement(element)) value = wrapMarkdown(value, "**");

  const fontScale = getElementFontScale(element);
  if (fontScale === "small") value = wrapMarkdown(value, "<small>", "</small>");
  if (fontScale === "big") value = wrapMarkdown(value, "<big>", "</big>");

  return value;
};

const serializeListItem = (item, index, ordered, depth = 0) => {
  const nestedLines = [];
  const inlineParts = [];

  Array.from(item.childNodes).forEach((child) => {
    if (
      child.nodeType === Node.ELEMENT_NODE &&
      (child.tagName === "UL" || child.tagName === "OL")
    ) {
      nestedLines.push(serializeListElement(child, depth + 1));
      return;
    }

    inlineParts.push(serializeInlineNode(child));
  });

  const indent = "  ".repeat(depth);
  const marker = ordered ? `${index + 1}. ` : "- ";
  const text = inlineParts.join("").replace(/\n+$/g, "").trim();
  if (!text && nestedLines.length === 0) return "";

  const line = `${indent}${marker}${text}`;

  return [line, ...nestedLines].filter(Boolean).join("\n");
};

const serializeListElement = (element, depth = 0) => {
  const ordered = element.tagName === "OL";
  const items = Array.from(element.children).filter(
    (child) => child.tagName === "LI",
  );

  return items
    .map((item, index) => serializeListItem(item, index, ordered, depth))
    .join("\n");
};

const serializeBlockElement = (element) => {
  if (element.tagName === "UL" || element.tagName === "OL") {
    return serializeListElement(element);
  }

  return serializeInlineChildren(element).replace(/\n+$/g, "");
};

export const serializeComposerContent = (root) => {
  if (!root) return "";

  const blocks = [];
  let inlineBuffer = "";

  const flushInlineBuffer = () => {
    if (inlineBuffer) {
      blocks.push(inlineBuffer.replace(/\n+$/g, ""));
      inlineBuffer = "";
    }
  };

  Array.from(root.childNodes).forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tagName = child.tagName;

      if (tagName === "UL" || tagName === "OL" || blockElementNames.has(tagName)) {
        flushInlineBuffer();
        blocks.push(serializeBlockElement(child));
        return;
      }
    }

    inlineBuffer += serializeInlineNode(child);
  });

  flushInlineBuffer();

  return blocks
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
