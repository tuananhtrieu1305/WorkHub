import assert from "node:assert/strict";
import test from "node:test";
import {
  getFirstFeedPostLink,
  parseFeedPostLink,
  removeFeedPostLinks,
} from "./feedPostLinkPreview.js";

test("parseFeedPostLink reads copied absolute feed links", () => {
  assert.deepEqual(
    parseFeedPostLink(
      "http://localhost:5173/feed#post-6a3172c5d3e85cfb1a2b4ba0",
    ),
    {
      raw: "http://localhost:5173/feed#post-6a3172c5d3e85cfb1a2b4ba0",
      postId: "6a3172c5d3e85cfb1a2b4ba0",
      href: "/feed#post-6a3172c5d3e85cfb1a2b4ba0",
    },
  );
});

test("getFirstFeedPostLink accepts relative feed links and trims punctuation", () => {
  assert.deepEqual(
    getFirstFeedPostLink("xem bài này /feed#post-post%20id."),
    {
      raw: "/feed#post-post%20id.",
      postId: "post id",
      href: "/feed#post-post%20id",
    },
  );
});

test("removeFeedPostLinks removes only feed post links from message text", () => {
  assert.equal(
    removeFeedPostLinks(
      "Mọi người xem nhé\nhttp://localhost:5173/feed#post-abc123",
    ),
    "Mọi người xem nhé",
  );
  assert.equal(
    removeFeedPostLinks("https://example.com/feed#other-abc"),
    "https://example.com/feed#other-abc",
  );
});
