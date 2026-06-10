import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  markdownToComposerHtml,
  parseInlineMarkdown,
  sanitizeHref,
} from "./chatComposerUtils.js";

describe("chatComposerUtils inline formatting", () => {
  it("parses nested bold, underline, italic, and strike formatting", () => {
    const nodes = parseInlineMarkdown("**<u>*~~Hello~~*</u>**");

    assert.deepEqual(nodes, [
      {
        type: "strong",
        children: [
          {
            type: "underline",
            children: [
              {
                type: "emphasis",
                children: [
                  {
                    type: "strike",
                    children: [{ type: "text", text: "Hello" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("hydrates nested inline formatting to composer HTML", () => {
    const html = markdownToComposerHtml("**<u>*Hello*</u>**");

    assert.equal(html, "<strong><u><em>Hello</em></u></strong>");
  });

  it("hydrates controlled font-size markers inside lists", () => {
    const html = markdownToComposerHtml("- <small>Small</small>\n- <big>Big</big>");

    assert.equal(html, "<ul><li><small>Small</small></li><li><big>Big</big></li></ul>");
  });

  it("keeps unsafe links inert", () => {
    assert.equal(sanitizeHref("javascript:alert(1)"), "#");
    assert.equal(sanitizeHref("https://example.com"), "https://example.com");
  });
});
