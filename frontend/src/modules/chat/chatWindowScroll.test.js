import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatWindowSource = readFileSync(
  new URL("./ChatWindow.jsx", import.meta.url),
  "utf8",
);

test("message pane scrolls to the latest message after a conversation loads", () => {
  assert.match(chatWindowSource, /const messagesPaneRef = useRef\(null\)/);
  assert.match(chatWindowSource, /ref=\{messagesPaneRef\}/);
  assert.match(chatWindowSource, /useLayoutEffect\(\(\) => \{/);
  assert.match(
    chatWindowSource,
    /isLoadingMessages \|\| messages\.length === 0/,
  );
  assert.match(chatWindowSource, /pane\.scrollTop = pane\.scrollHeight/);
  assert.match(
    chatWindowSource,
    /\[conversationId, isLoadingMessages, latestMessageKey, messages\.length\]/,
  );
});

test("reply preview jump scrolls to the target message and highlights it", () => {
  assert.match(chatWindowSource, /const messageNodeRefs = useRef\(new Map\(\)\)/);
  assert.match(chatWindowSource, /const \[highlightedMessageId, setHighlightedMessageId\]/);
  assert.match(chatWindowSource, /targetNode\.scrollIntoView\(\{/);
  assert.match(chatWindowSource, /behavior:\s*"smooth"/);
  assert.match(chatWindowSource, /block:\s*"center"/);
  assert.match(chatWindowSource, /setHighlightedMessageId\(targetMessageId\)/);
  assert.match(chatWindowSource, /onJumpToMessage=\{handleJumpToMessage\}/);
});
