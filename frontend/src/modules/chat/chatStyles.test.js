import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatCss = readFileSync(
  new URL("../../styles/chat/chat.css", import.meta.url),
  "utf8",
);

test("hover timestamp portal is visible when mounted", () => {
  const match = chatCss.match(/\.chat-message-hover-time-portal\s*\{([^}]*)\}/);

  assert.ok(match, "Missing .chat-message-hover-time-portal CSS rule");
  assert.doesNotMatch(match[1], /opacity\s*:\s*0\b/);
});

test("message bubbles avoid pseudo tails and keep avatar-side bottom corners rounded", () => {
  assert.doesNotMatch(chatCss, /chat-message-bubble-tail/);
  assert.doesNotMatch(chatCss, /\.chat-message-bubble[^{}]*::(?:before|after)/);
  assert.match(
    chatCss,
    /\.chat-message-bubble-avatar-anchor\.chat-message-bubble-other\s*\{[^}]*border-bottom-left-radius:\s*1\.05rem/s,
  );
  assert.match(
    chatCss,
    /\.chat-message-bubble-avatar-anchor\.chat-message-bubble-mine\s*\{[^}]*border-bottom-right-radius:\s*1\.05rem/s,
  );
});

test("message bubble contrast does not rely on drop shadows", () => {
  const bubbleRule = chatCss.match(/\.chat-message-bubble\s*\{([^}]*)\}/);

  assert.ok(bubbleRule, "Missing .chat-message-bubble CSS rule");
  assert.match(bubbleRule[1], /box-shadow\s*:\s*none\s*!important\b/);
  assert.doesNotMatch(
    chatCss,
    /\.chat-message-group:hover\s+\.chat-message-bubble(?:-[\w-]+)?\s*\{/,
  );
  assert.match(
    chatCss,
    /\.chat-message-bubble-other\s*\{[^}]*border:\s*1\.5px solid #94a3b8 !important/s,
  );
  assert.match(chatCss, /\.chat-message-bubble-other\s*\{[^}]*outline:/s);
  assert.match(chatCss, /\.chat-message-bubble-mine\s*\{[^}]*outline:/s);
});

test("message avatars do not use a white border ring", () => {
  const avatarRule = chatCss.match(/\.chat-message-avatar\s*\{([^}]*)\}/);

  assert.ok(avatarRule, "Missing .chat-message-avatar CSS rule");
  assert.match(avatarRule[1], /border\s*:\s*0\b/);
  assert.doesNotMatch(avatarRule[1], /rgba\(\s*255,\s*255,\s*255/);
});

test("tight-group follower bubbles square the corner nearest the avatar", () => {
  assert.match(
    chatCss,
    /\.chat-message-bubble-linked-before\.chat-message-bubble-other\s*\{[^}]*border-top-left-radius:\s*0\.28rem/s,
  );
  assert.match(
    chatCss,
    /\.chat-message-bubble-linked-before\.chat-message-bubble-mine\s*\{[^}]*border-top-right-radius:\s*0\.28rem/s,
  );
});

test("reply previews stay to one line and support media thumbnails", () => {
  assert.match(chatCss, /\.chat-reply-context-title\s*\{/);
  assert.match(
    chatCss,
    /\.chat-reply-preview-button\s*\{[^}]*width:\s*fit-content/s,
  );
  assert.match(
    chatCss,
    /\.chat-reply-preview-text\s*\{[^}]*text-overflow:\s*ellipsis/s,
  );
  assert.match(
    chatCss,
    /\.chat-reply-preview-text\s*\{[^}]*white-space:\s*nowrap/s,
  );
  assert.match(chatCss, /\.chat-reply-preview-media\s*\{[^}]*width:\s*2rem/s);
});

test("outgoing reply preview aligns with the outgoing bubble", () => {
  assert.match(
    chatCss,
    /\.chat-reply-context-mine\s*\{[^}]*margin-left:\s*auto/s,
  );
  assert.match(
    chatCss,
    /\.chat-reply-context-mine\s*\{[^}]*align-items:\s*flex-end/s,
  );
  assert.match(
    chatCss,
    /\.chat-reply-context-mine \.chat-reply-preview-button\s*\{[^}]*align-self:\s*flex-end/s,
  );
});

test("reply target highlight uses a visible bubble outline", () => {
  assert.match(
    chatCss,
    /\.chat-message-bubble-highlighted\s*\{[^}]*animation:\s*chatMessageBubbleHighlight 2\.6s/s,
  );
  assert.match(
    chatCss,
    /\.chat-message-bubble-highlighted\.chat-message-bubble-other\s*\{[^}]*outline:\s*4px solid rgba\(14,\s*165,\s*233/s,
  );
  assert.match(
    chatCss,
    /\.chat-message-bubble-highlighted\.chat-message-bubble-mine\s*\{[^}]*outline:\s*4px solid rgba\(34,\s*211,\s*238/s,
  );
  assert.doesNotMatch(chatCss, /#facc15|rgba\(250,\s*204,\s*21/);
  assert.match(chatCss, /transform:\s*scale\(1\.05\)/);
});
