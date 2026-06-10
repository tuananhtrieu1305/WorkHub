import assert from "node:assert/strict";
import test from "node:test";
import { upsertMessageById } from "./realtimeMessageState.js";
import { buildMessageTimeline } from "./messageTimeline.js";

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

test("upserting an updated poll refreshes poll option activity snapshots", () => {
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
    content: 'An đã thêm lựa chọn "Thứ 4" vào cuộc bình chọn: Chọn lịch?',
    metadata: {
      eventType: "poll_option_added",
      targetMessageId: "poll-1",
      pollMessage: originalPoll,
    },
    createdAt: "2026-06-09T10:01:00.000Z",
  };
  const updatedPoll = {
    ...originalPoll,
    poll: {
      ...originalPoll.poll,
      options: [
        ...originalPoll.poll.options,
        { id: "wed", text: "Thứ 4", voteCount: 0, voters: [] },
      ],
    },
    updatedAt: "2026-06-09T10:02:00.000Z",
  };

  const nextMessages = upsertMessageById(
    [originalPoll, activityMessage],
    updatedPoll,
  );
  const nextActivity = nextMessages.find((message) => message.id === "activity-1");

  assert.equal(nextActivity.metadata.pollMessage.poll.options.length, 2);
  assert.equal(nextActivity.metadata.pollMessage.poll.options[1].text, "Thứ 4");
});

test("message timeline shows the poll card only on the latest poll activity", () => {
  const firstActivity = {
    id: "activity-1",
    type: "system",
    content: "An tham gia cuộc bình chọn: Chọn lịch?",
    metadata: {
      eventType: "poll_voted",
      targetMessageId: "poll-1",
    },
    createdAt: "2026-06-09T10:01:00.000Z",
  };
  const latestActivity = {
    id: "activity-2",
    type: "system",
    content: "Binh tham gia cuộc bình chọn: Chọn lịch?",
    metadata: {
      eventType: "poll_voted",
      targetMessageId: "poll-2",
    },
    createdAt: "2026-06-09T10:02:00.000Z",
  };

  const timeline = buildMessageTimeline([firstActivity, latestActivity]);
  const activityItems = timeline.filter((item) => item.type === "message");

  assert.equal(activityItems[0].showPollActivityCard, false);
  assert.equal(activityItems[1].showPollActivityCard, true);
});

test("message timeline treats added poll options as poll activity", () => {
  const voteActivity = {
    id: "activity-1",
    type: "system",
    content: "An tham gia cuộc bình chọn: Chọn lịch?",
    metadata: {
      eventType: "poll_voted",
      targetMessageId: "poll-1",
    },
    createdAt: "2026-06-09T10:01:00.000Z",
  };
  const optionActivity = {
    id: "activity-2",
    type: "system",
    content: 'Binh đã thêm lựa chọn "Thứ 4" vào cuộc bình chọn: Chọn lịch?',
    metadata: {
      eventType: "poll_option_added",
      targetMessageId: "poll-1",
    },
    createdAt: "2026-06-09T10:02:00.000Z",
  };

  const timeline = buildMessageTimeline([voteActivity, optionActivity]);
  const activityItems = timeline.filter((item) => item.type === "message");

  assert.equal(activityItems[0].showPollActivityCard, false);
  assert.equal(activityItems[1].showPollActivityCard, true);
});
