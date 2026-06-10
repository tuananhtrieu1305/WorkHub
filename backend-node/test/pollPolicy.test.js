import assert from "node:assert/strict";
import test from "node:test";
import {
  addPollOption,
  applyPollVote,
  closePoll,
  sortPollOptionsByVotesAndText,
  getCurrentUserPollOptionIds,
  isPollClosed,
  normalizePollPayload,
} from "../src/utils/pollPolicy.js";

const now = new Date("2026-06-09T10:00:00.000Z");

const optionId = (value) => ({ _id: value });

test("normalizes poll payload with question, options, settings, and expiry", () => {
  const { poll, pinOnCreate } = normalizePollPayload(
    {
      question: "  Chọn lịch họp?  ",
      options: [" Thứ 2 ", "Thứ 3"],
      settings: {
        multiple: true,
        allowOptions: true,
        hideResultsUntilVoted: true,
        hideVoters: true,
      },
      expiresAt: "2026-06-10T10:00:00.000Z",
      pinOnCreate: true,
    },
    { creatorId: "user-1", now },
  );

  assert.equal(poll.question, "Chọn lịch họp?");
  assert.deepEqual(
    poll.options.map((item) => item.text),
    ["Thứ 2", "Thứ 3"],
  );
  assert.equal(poll.settings.multiple, true);
  assert.equal(poll.settings.allowOptions, true);
  assert.equal(poll.settings.hideResultsUntilVoted, true);
  assert.equal(poll.settings.hideVoters, true);
  assert.equal(poll.expiresAt.toISOString(), "2026-06-10T10:00:00.000Z");
  assert.equal(pinOnCreate, true);
});

test("poll payload requires at least two unique options", () => {
  assert.throws(
    () =>
      normalizePollPayload(
        { question: "Chọn?", options: ["A"] },
        { creatorId: "user-1", now },
      ),
    /at least 2 options/,
  );

  assert.throws(
    () =>
      normalizePollPayload(
        { question: "Chọn?", options: ["A", "a"] },
        { creatorId: "user-1", now },
      ),
    /unique/,
  );
});

test("single-choice poll rejects multiple selected options", () => {
  const poll = {
    options: [optionId("a"), optionId("b")],
    settings: { multiple: false },
  };

  assert.throws(
    () => applyPollVote(poll, ["a", "b"], { userId: "user-1", now }),
    /only one option/,
  );
});

test("applying a poll vote replaces the user's previous choices", () => {
  const poll = {
    options: [
      { _id: "a", voters: [{ userId: "user-1", votedAt: now }] },
      { _id: "b", voters: [] },
    ],
    settings: { multiple: false },
  };

  applyPollVote(poll, ["b"], { userId: "user-1", now });

  assert.deepEqual(getCurrentUserPollOptionIds(poll, "user-1"), ["b"]);
  assert.equal(poll.options[0].voters.length, 0);
  assert.equal(poll.options[1].voters.length, 1);
});

test("adding a poll option follows allow-options setting and dedupes text", () => {
  const poll = {
    options: [{ _id: "a", text: "A", voters: [] }],
    settings: { allowOptions: false },
  };

  assert.throws(
    () => addPollOption(poll, "B", { userId: "user-1", now }),
    /does not allow/,
  );

  poll.settings.allowOptions = true;
  addPollOption(poll, "B", { userId: "user-1", now });
  assert.equal(poll.options.at(-1).text, "B");

  assert.throws(
    () => addPollOption(poll, " b ", { userId: "user-1", now }),
    /unique/,
  );
});

test("poll closes after expiration time", () => {
  assert.equal(
    isPollClosed({
      expiresAt: "2026-06-09T09:59:59.000Z",
      settings: {},
      options: [],
    }, now),
    true,
  );
});

test("closing a poll records closedAt and blocks future votes", () => {
  const poll = {
    options: [optionId("a"), optionId("b")],
    settings: { multiple: false },
    closedAt: null,
  };

  closePoll(poll, { now });

  assert.equal(poll.closedAt, now);
  assert.equal(isPollClosed(poll, now), true);
  assert.throws(
    () => applyPollVote(poll, ["a"], { userId: "user-1", now }),
    /Poll is closed/,
  );
  assert.throws(() => closePoll(poll, { now }), /already closed/);
});

test("sorts poll options by vote count descending then text", () => {
  const options = [
    { text: "Táo", voters: [{ userId: "user-1" }] },
    { text: "Cam", voters: [{ userId: "user-2" }, { userId: "user-3" }] },
    { text: "Bưởi", voters: [{ userId: "user-4" }, { userId: "user-5" }] },
    { text: "Ổi", voters: [] },
  ];

  const sortedOptions = sortPollOptionsByVotesAndText(options);

  assert.deepEqual(
    sortedOptions.map((option) => option.text),
    ["Bưởi", "Cam", "Táo", "Ổi"],
  );
  assert.deepEqual(
    options.map((option) => option.text),
    ["Táo", "Cam", "Bưởi", "Ổi"],
  );
});
