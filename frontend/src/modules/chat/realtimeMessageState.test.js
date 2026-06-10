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

test("message timeline shows the latest poll card for each independent poll", () => {
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

  assert.equal(activityItems[0].showPollActivityCard, true);
  assert.equal(activityItems[1].showPollActivityCard, true);
  assert.equal(activityItems[0].pollActivityTargetMessageId, "poll-1");
  assert.equal(activityItems[1].pollActivityTargetMessageId, "poll-2");
});

test("message timeline hides the original poll card after poll activity notices exist", () => {
  const originalPoll = {
    id: "poll-1",
    type: "poll",
    content: "Chọn lịch?",
    poll: {
      question: "Chọn lịch?",
      options: [{ id: "yes", text: "Có", voteCount: 0, voters: [] }],
    },
    createdAt: "2026-06-09T10:00:00.000Z",
  };
  const firstActivity = {
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
  const latestActivity = {
    id: "activity-2",
    type: "system",
    content: 'Binh đã thêm lựa chọn "Thứ 4" vào cuộc bình chọn: Chọn lịch?',
    metadata: {
      eventType: "poll_option_added",
      targetMessageId: "poll-1",
      pollMessage: originalPoll,
    },
    createdAt: "2026-06-09T10:02:00.000Z",
  };

  const timeline = buildMessageTimeline([
    originalPoll,
    firstActivity,
    latestActivity,
  ]);
  const messageItems = timeline.filter((item) => item.type === "message");

  assert.deepEqual(
    messageItems.map((item) => item.id),
    ["activity-1", "activity-2"],
  );
  assert.equal(messageItems[0].showPollActivityCard, false);
  assert.equal(messageItems[1].showPollActivityCard, true);
  assert.equal(messageItems[1].pollActivityTargetMessageId, "poll-1");
});

test("message timeline treats poll creation notices as poll activity", () => {
  const originalPoll = {
    id: "poll-1",
    type: "poll",
    content: "Chọn lịch?",
    poll: {
      question: "Chọn lịch?",
      options: [{ id: "yes", text: "Có", voteCount: 0, voters: [] }],
    },
    createdAt: "2026-06-09T10:00:00.000Z",
  };
  const createdActivity = {
    id: "activity-1",
    type: "system",
    content: "An đã tạo cuộc bình chọn mới: Chọn lịch?",
    metadata: {
      eventType: "poll_created",
      targetMessageId: "poll-1",
      pollMessage: originalPoll,
    },
    createdAt: "2026-06-09T10:00:01.000Z",
  };

  const timeline = buildMessageTimeline([originalPoll, createdActivity]);
  const messageItems = timeline.filter((item) => item.type === "message");

  assert.deepEqual(
    messageItems.map((item) => item.id),
    ["activity-1"],
  );
  assert.equal(messageItems[0].showPollActivityCard, true);
  assert.equal(messageItems[0].pollActivityTargetMessageId, "poll-1");
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

test("message timeline treats poll share and close notices as poll activity", () => {
  const sharedActivity = {
    id: "activity-1",
    type: "system",
    content: "An đã gửi bình chọn vào nhóm: Chọn lịch?",
    metadata: {
      eventType: "poll_shared",
      targetMessageId: "poll-1",
    },
    createdAt: "2026-06-09T10:01:00.000Z",
  };
  const closedActivity = {
    id: "activity-2",
    type: "system",
    content: "An đã khóa bình chọn: Chọn lịch?",
    metadata: {
      eventType: "poll_closed",
      targetMessageId: "poll-1",
    },
    createdAt: "2026-06-09T10:02:00.000Z",
  };

  const timeline = buildMessageTimeline([sharedActivity, closedActivity]);
  const activityItems = timeline.filter((item) => item.type === "message");

  assert.equal(activityItems[0].showPollActivityCard, false);
  assert.equal(activityItems[1].showPollActivityCard, true);
});
