import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const messageBubbleSource = readFileSync(
  new URL("./MessageBubble.jsx", import.meta.url),
  "utf8",
);

test("hover timestamp only opens on active pointer movement", () => {
  assert.doesNotMatch(messageBubbleSource, /onMouseEnter=/);
  assert.doesNotMatch(messageBubbleSource, /onFocusCapture=/);
  assert.match(messageBubbleSource, /onPointerMove=\{updateHoverTimePosition\}/);
});

test("hover timestamp opens from message content, not the full row or action area", () => {
  const messageGroupBlocks = messageBubbleSource.match(
    /className=\{`chat-message-group[\s\S]*?`\}[\s\S]*?>/g,
  );
  const messageStackBlocks = messageBubbleSource.match(
    /className=\{`chat-message-stack[\s\S]*?`\}[\s\S]*?>/g,
  );
  const renderActionsMatch = messageBubbleSource.match(
    /const\s+renderActions\s+=\s+\(\)\s+=>\s+\([\s\S]*?\n\s{2}\);/,
  );

  assert.ok(messageGroupBlocks?.length, "Missing message group blocks");
  assert.ok(messageStackBlocks?.length, "Missing message stack blocks");
  assert.ok(renderActionsMatch, "Missing renderActions block");

  messageGroupBlocks.forEach((block) => {
    assert.doesNotMatch(block, /onPointerMove=\{updateHoverTimePosition\}/);
  });
  messageStackBlocks.forEach((block) => {
    assert.doesNotMatch(block, /onPointerMove=\{updateHoverTimePosition\}/);
  });
  assert.doesNotMatch(
    renderActionsMatch[0],
    /onPointerMove=\{updateHoverTimePosition\}/,
  );
  assert.match(messageBubbleSource, /ref=\{bubbleRef\}/);
  assert.match(messageBubbleSource, /onPointerMove=\{updateHoverTimePosition\}/);
});

test("scrolling hides an open hover timestamp instead of repositioning it", () => {
  assert.match(
    messageBubbleSource,
    /window\.addEventListener\("scroll",\s*hideHoverTime,\s*true\)/,
  );
  assert.doesNotMatch(
    messageBubbleSource,
    /window\.addEventListener\("scroll",\s*updatePosition,\s*true\)/,
  );
});

test("message sender headers do not include inline timestamps", () => {
  assert.doesNotMatch(
    messageBubbleSource,
    /<span className="text-xs font-semibold text-slate-500">\s*\{messageTimestamp\}\s*<\/span>/,
  );
});

test("reply preview renders actor-to-target copy and media thumbnail", () => {
  assert.match(messageBubbleSource, /\{actorName\} đã trả lời \{targetName\}/);
  assert.match(messageBubbleSource, /className="chat-reply-preview-button"/);
  assert.match(
    messageBubbleSource,
    /<ReplyMediaThumbnail attachment=\{previewAttachment\} \/>/,
  );
  assert.match(messageBubbleSource, /onClick=\{\(\) => onJumpToMessage\?\.\(replyTo\)\}/);
});

test("reply target self label is lowercase to read naturally mid-sentence", () => {
  assert.match(messageBubbleSource, /\{ selfLabel: "bạn" \}/);
});

test("message sender header is hidden when the message is a reply", () => {
  assert.match(
    messageBubbleSource,
    /const shouldShowSenderHeader = showSenderHeader && !message\.replyTo;/,
  );
  assert.doesNotMatch(messageBubbleSource, /\{showSenderHeader && \(/);
});
