const inlineMarkdownPattern =
  /(\*\*([^*]+)\*\*|\*([^*]+)\*|<u>([^<]+)<\/u>|~~([^~]+)~~|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

const blockElementNames = new Set(["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "FOOTER", "HEADER", "H1", "H2", "H3", "H4", "H5", "H6", "MAIN", "P", "PRE", "SECTION"]);

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sanitizeHref = (href = "") => {
  const normalizedHref = String(href || "").trim();
  return /^(https?:|mailto:)/i.test(normalizedHref) ? normalizedHref : "#";
};

const isBulletLine = (line) => line.trim().startsWith("- ");

const isOrderedLine = (line) => /^\d+\.\s/.test(line.trim());

const trimListMarker = (line) =>
  line.trim().replace(/^(?:-\s|\d+\.\s)/, "");

const inlineMarkdownToHtml = (text = "") => {
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = inlineMarkdownPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)));
    }

    if (match[2]) {
      parts.push(`<strong>${escapeHtml(match[2])}</strong>`);
    } else if (match[3]) {
      parts.push(`<em>${escapeHtml(match[3])}</em>`);
    } else if (match[4]) {
      parts.push(`<u>${escapeHtml(match[4])}</u>`);
    } else if (match[5]) {
      parts.push(`<s>${escapeHtml(match[5])}</s>`);
    } else if (match[6]) {
      parts.push(`<code>${escapeHtml(match[6])}</code>`);
    } else if (match[7]) {
      const label = escapeHtml(match[7]);
      const href = escapeHtml(sanitizeHref(match[8]));
      parts.push(`<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`);
    }

    lastIndex = inlineMarkdownPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.slice(lastIndex)));
  }

  return parts.join("");
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
