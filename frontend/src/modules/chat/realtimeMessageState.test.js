import assert from "node:assert/strict";
import test from "node:test";
import { upsertMessageById } from "./realtimeMessageState.js";

test("upserting an updated poll refreshes poll activity snapshots", () => {
  const originalPoll = {
    id: "poll-1",
    type: "poll",
    content: "Chọn lịch?",
    poll: {
      question: "Chọn lịch?",
      totalVoters: 1,
      options: [{ id: "yes", text: "Có", voteCount: 1, voters: [] }],
    },
    createdAt: "2026-06-09T10:00:00.000Z",
  };
  const activityMessage = {
    id: "activity-1",
    type: "system",
    content: "An tham gia cuộc bình chọn: Chọn lịch?",
    metadata: {
      eventType: "poll_voted",
      targetMessageId: "poll-1",
      pollMessage: originalPoll,
    },
    createdAt: "2026-06-09T10:01:00.000Z",
  };
  const updatedPoll = {
    ...originalPoll,
    poll: {
      ...originalPoll.poll,
      totalVoters: 2,
      options: [{ id: "yes", text: "Có", voteCount: 2, voters: [] }],
    },
    updatedAt: "2026-06-09T10:02:00.000Z",
  };

  const nextMessages = upsertMessageById(
    [originalPoll, activityMessage],
    updatedPoll,
  );
  const nextActivity = nextMessages.find((message) => message.id === "activity-1");

  assert.equal(nextActivity.metadata.pollMessage.poll.totalVoters, 2);
  assert.equal(nextActivity.metadata.pollMessage.poll.options[0].voteCount, 2);
});
