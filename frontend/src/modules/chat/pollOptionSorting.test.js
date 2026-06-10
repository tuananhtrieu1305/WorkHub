import assert from "node:assert/strict";
import test from "node:test";
import { sortPollOptionsByVotesAndText } from "./pollOptionSorting.js";

test("sorts poll options by vote count descending then text", () => {
  const options = [
    { text: "Táo", voteCount: 1 },
    { text: "Cam", voteCount: 2 },
    { text: "Bưởi", voteCount: 2 },
    { text: "Ổi", voteCount: 0 },
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

test("can sort using displayed draft vote counts", () => {
  const options = [
    { id: "a", text: "Táo", voteCount: 1 },
    { id: "b", text: "Cam", voteCount: 2 },
    { id: "c", text: "Bưởi", voteCount: 2 },
  ];
  const displayedCounts = new Map([
    ["a", 3],
    ["b", 2],
    ["c", 2],
  ]);

  const sortedOptions = sortPollOptionsByVotesAndText(options, {
    getVoteCount: (option) => displayedCounts.get(option.id),
  });

  assert.deepEqual(
    sortedOptions.map((option) => option.text),
    ["Táo", "Bưởi", "Cam"],
  );
});
