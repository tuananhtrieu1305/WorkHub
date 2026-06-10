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

test("upserting an updated reminder refreshes reminder activity snapshots", () => {
  const originalReminder = {
    id: "reminder-1",
    type: "reminder",
    content: "Nhắc họp",
    reminder: {
      title: "Nhắc họp",
      scheduledAt: "2026-06-10T09:00:00.000Z",
      participants: [{ userId: "user-1", status: "accepted" }],
      acceptedCount: 1,
      declinedCount: 0,
    },
    createdAt: "2026-06-09T10:00:00.000Z",
  };
  const activityMessage = {
    id: "activity-1",
    type: "system",
    content: "An đã tạo nhắc hẹn mới: Nhắc họp",
    metadata: {
      eventType: "reminder_created",
      targetMessageId: "reminder-1",
      reminderMessage: originalReminder,
    },
    createdAt: "2026-06-09T10:01:00.000Z",
  };
  const updatedReminder = {
    ...originalReminder,
    reminder: {
      ...originalReminder.reminder,
      participants: [
        ...originalReminder.reminder.participants,
        { userId: "user-2", status: "declined" },
      ],
      acceptedCount: 1,
      declinedCount: 1,
    },
    updatedAt: "2026-06-09T10:02:00.000Z",
  };

  const nextMessages = upsertMessageById(
    [originalReminder, activityMessage],
    updatedReminder,
  );
  const nextActivity = nextMessages.find((message) => message.id === "activity-1");

  assert.equal(nextActivity.metadata.reminderMessage.reminder.declinedCount, 1);
  assert.equal(
    nextActivity.metadata.reminderMessage.reminder.participants[1].userId,
    "user-2",
  );
});

test("message timeline hides the original reminder card after reminder activity notices exist", () => {
  const originalReminder = {
    id: "reminder-1",
    type: "reminder",
    content: "Nhắc họp",
    reminder: {
      title: "Nhắc họp",
      scheduledAt: "2026-06-10T09:00:00.000Z",
    },
    createdAt: "2026-06-09T10:00:00.000Z",
  };
  const createdActivity = {
    id: "activity-1",
    type: "system",
    content: "An đã tạo nhắc hẹn mới: Nhắc họp",
    metadata: {
      eventType: "reminder_created",
      targetMessageId: "reminder-1",
      reminderMessage: originalReminder,
    },
    createdAt: "2026-06-09T10:01:00.000Z",
  };
  const dueActivity = {
    id: "activity-2",
    type: "system",
    content: "Đến giờ nhắc hẹn: Nhắc họp",
    metadata: {
      eventType: "reminder_due",
      targetMessageId: "reminder-1",
      reminderMessage: originalReminder,
    },
    createdAt: "2026-06-09T10:02:00.000Z",
  };

  const timeline = buildMessageTimeline([
    originalReminder,
    createdActivity,
    dueActivity,
  ]);
  const messageItems = timeline.filter((item) => item.type === "message");

  assert.deepEqual(
    messageItems.map((item) => item.id),
    ["activity-1", "activity-2"],
  );
  assert.equal(messageItems[0].showReminderActivityCard, false);
  assert.equal(messageItems[1].showReminderActivityCard, true);
  assert.equal(messageItems[1].reminderActivityTargetMessageId, "reminder-1");
});

test("upserting an updated reminder refreshes reminder response activity snapshots", () => {
  const originalReminder = {
    id: "reminder-1",
    type: "reminder",
    content: "Nhắc họp",
    reminder: {
      title: "Nhắc họp",
      scheduledAt: "2026-06-10T09:00:00.000Z",
      accepted: [{ userId: "user-1", status: "accepted" }],
      declined: [],
      acceptedCount: 1,
      declinedCount: 0,
    },
    createdAt: "2026-06-09T10:00:00.000Z",
  };
  const activityMessage = {
    id: "activity-1",
    type: "system",
    content: "Binh xác nhận: không tham gia Nhắc họp.",
    metadata: {
      eventType: "reminder_response",
      targetMessageId: "reminder-1",
      reminderResponseStatus: "declined",
      reminderMessage: originalReminder,
    },
    createdAt: "2026-06-09T10:01:00.000Z",
  };
  const updatedReminder = {
    ...originalReminder,
    reminder: {
      ...originalReminder.reminder,
      declined: [{ userId: "user-2", status: "declined" }],
      declinedCount: 1,
    },
    updatedAt: "2026-06-09T10:02:00.000Z",
  };

  const nextMessages = upsertMessageById(
    [originalReminder, activityMessage],
    updatedReminder,
  );
  const nextActivity = nextMessages.find((message) => message.id === "activity-1");

  assert.equal(nextActivity.metadata.reminderMessage.reminder.declinedCount, 1);
  assert.equal(
    nextActivity.metadata.reminderMessage.reminder.declined[0].userId,
    "user-2",
  );
});

test("message timeline treats reminder response notices as reminder activity", () => {
  const originalReminder = {
    id: "reminder-1",
    type: "reminder",
    content: "Nhắc họp",
    reminder: {
      title: "Nhắc họp",
      scheduledAt: "2026-06-10T09:00:00.000Z",
    },
    createdAt: "2026-06-09T10:00:00.000Z",
  };
  const firstActivity = {
    id: "activity-1",
    type: "system",
    content: "An đã tạo nhắc hẹn mới: Nhắc họp",
    metadata: {
      eventType: "reminder_created",
      targetMessageId: "reminder-1",
      reminderMessage: originalReminder,
    },
    createdAt: "2026-06-09T10:01:00.000Z",
  };
  const responseActivity = {
    id: "activity-2",
    type: "system",
    content: "Binh xác nhận: không tham gia Nhắc họp.",
    metadata: {
      eventType: "reminder_response",
      targetMessageId: "reminder-1",
      reminderResponseStatus: "declined",
      reminderMessage: originalReminder,
    },
    createdAt: "2026-06-09T10:02:00.000Z",
  };

  const timeline = buildMessageTimeline([
    originalReminder,
    firstActivity,
    responseActivity,
  ]);
  const messageItems = timeline.filter((item) => item.type === "message");

  assert.deepEqual(
    messageItems.map((item) => item.id),
    ["activity-1", "activity-2"],
  );
  assert.equal(messageItems[0].showReminderActivityCard, false);
  assert.equal(messageItems[1].showReminderActivityCard, true);
  assert.equal(messageItems[1].reminderActivityTargetMessageId, "reminder-1");
});

test("new reminder response notice updates the visible reminder card in realtime", () => {
  const originalReminder = {
    id: "reminder-1",
    type: "reminder",
    content: "Nhắc họp",
    reminder: {
      title: "Nhắc họp",
      scheduledAt: "2026-06-10T09:00:00.000Z",
      accepted: [{ userId: "user-1", status: "accepted" }],
      declined: [],
      acceptedCount: 1,
      declinedCount: 0,
    },
    createdAt: "2026-06-09T10:00:00.000Z",
  };
  const createdActivity = {
    id: "activity-1",
    type: "system",
    content: "An đã tạo nhắc hẹn mới: Nhắc họp",
    metadata: {
      eventType: "reminder_created",
      targetMessageId: "reminder-1",
      reminderMessage: originalReminder,
    },
    createdAt: "2026-06-09T10:01:00.000Z",
  };
  const responseActivity = {
    id: "activity-2",
    type: "system",
    content: "Binh xác nhận: không tham gia Nhắc họp.",
    metadata: {
      eventType: "reminder_response",
      targetMessageId: "reminder-1",
      reminderResponseStatus: "declined",
      reminderMessage: {
        ...originalReminder,
        reminder: {
          ...originalReminder.reminder,
          declined: [{ userId: "user-2", status: "declined" }],
          declinedCount: 1,
        },
      },
    },
    createdAt: "2026-06-09T10:02:00.000Z",
  };

  const nextMessages = upsertMessageById(
    [originalReminder, createdActivity],
    responseActivity,
  );
  const timeline = buildMessageTimeline(nextMessages);
  const messageItems = timeline.filter((item) => item.type === "message");
  const latestItem = messageItems.at(-1);

  assert.equal(latestItem.id, "activity-2");
  assert.equal(latestItem.showReminderActivityCard, true);
  assert.equal(
    latestItem.message.metadata.reminderMessage.reminder.declinedCount,
    1,
  );
});
