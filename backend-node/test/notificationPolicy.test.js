import assert from "node:assert/strict";
import test from "node:test";
import {
  buildActorPrefix,
  buildAggregatedNotificationCopy,
  isMentionNotificationType,
  uniqueIdList,
} from "../src/utils/notificationPolicy.js";

test("uniqueIdList deduplicates ids and excludes the actor", () => {
  const ids = uniqueIdList(
    [
      "user-1",
      { _id: "user-2" },
      { id: "user-2" },
      "user-3",
      null,
      "",
    ],
    { exclude: ["user-1"] },
  );

  assert.deepEqual(ids, ["user-2", "user-3"]);
});

test("buildActorPrefix summarizes grouped actors", () => {
  assert.equal(buildActorPrefix("An", 1), "An");
  assert.equal(buildActorPrefix("An", 3), "An và 2 người khác");
});

test("buildAggregatedNotificationCopy creates social feed copy", () => {
  const copy = buildAggregatedNotificationCopy({
    type: "post_reaction",
    actorName: "An",
    actorCount: 4,
  });

  assert.equal(copy.title, "Bài viết có tương tác mới");
  assert.equal(
    copy.message,
    "An và 3 người khác đã bày tỏ cảm xúc về bài viết của bạn.",
  );
});

test("mention notification types are classified for the mentions inbox", () => {
  assert.equal(isMentionNotificationType("post_mention"), true);
  assert.equal(isMentionNotificationType("chat_mention"), true);
  assert.equal(isMentionNotificationType("post_comment"), false);
});
