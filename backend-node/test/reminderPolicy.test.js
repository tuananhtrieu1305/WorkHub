import test from "node:test";
import assert from "node:assert/strict";
import {
  applyReminderResponse,
  cancelReminder,
  getCurrentUserReminderStatus,
  getNextReminderOccurrence,
  markReminderTriggered,
  normalizeReminderPayload,
} from "../src/utils/reminderPolicy.js";

test("normalizes reminder payload with future schedule and creator acceptance", () => {
  const now = new Date("2026-06-10T03:00:00.000Z");
  const reminder = normalizeReminderPayload(
    {
      title: "  Họp sprint   planning  ",
      scheduledAt: "2026-06-10T03:30:00.000Z",
      recurrence: "weekly",
    },
    { creatorId: "user-1", now },
  );

  assert.equal(reminder.title, "Họp sprint planning");
  assert.equal(reminder.scheduledAt.toISOString(), "2026-06-10T03:30:00.000Z");
  assert.equal(reminder.nextTriggerAt.toISOString(), "2026-06-10T03:30:00.000Z");
  assert.equal(reminder.recurrence, "weekly");
  assert.equal(reminder.responses.length, 1);
  assert.equal(reminder.responses[0].status, "accepted");
});

test("reminder payload rejects past schedule", () => {
  assert.throws(
    () =>
      normalizeReminderPayload(
        {
          title: "Quá hạn",
          scheduledAt: "2026-06-10T02:59:00.000Z",
        },
        { creatorId: "user-1", now: new Date("2026-06-10T03:00:00.000Z") },
      ),
    /must not be in the past/,
  );
});

test("applying reminder response replaces previous user response", () => {
  const reminder = normalizeReminderPayload(
    {
      title: "Demo",
      scheduledAt: "2026-06-10T04:00:00.000Z",
    },
    { creatorId: "user-1", now: new Date("2026-06-10T03:00:00.000Z") },
  );

  applyReminderResponse(reminder, "declined", {
    userId: "user-1",
    now: new Date("2026-06-10T03:05:00.000Z"),
  });

  assert.equal(reminder.responses.length, 1);
  assert.equal(getCurrentUserReminderStatus(reminder, "user-1"), "declined");
});

test("cancel reminder records cancellation and clears next trigger", () => {
  const reminder = normalizeReminderPayload(
    {
      title: "Cancel me",
      scheduledAt: "2026-06-10T04:00:00.000Z",
    },
    { creatorId: "user-1", now: new Date("2026-06-10T03:00:00.000Z") },
  );

  cancelReminder(reminder, {
    userId: "user-1",
    now: new Date("2026-06-10T03:10:00.000Z"),
  });

  assert.equal(reminder.status, "cancelled");
  assert.equal(reminder.nextTriggerAt, null);
  assert.equal(reminder.cancelledBy, "user-1");
});

test("triggering recurring reminder advances next trigger after current time", () => {
  const reminder = normalizeReminderPayload(
    {
      title: "Daily standup",
      scheduledAt: "2026-06-10T03:00:00.000Z",
      recurrence: "daily",
    },
    { creatorId: "user-1", now: new Date("2026-06-10T02:00:00.000Z") },
  );

  markReminderTriggered(reminder, {
    now: new Date("2026-06-12T03:05:00.000Z"),
  });

  assert.equal(reminder.status, "active");
  assert.equal(reminder.triggerCount, 1);
  assert.equal(reminder.nextTriggerAt.toISOString(), "2026-06-13T03:00:00.000Z");
});

test("monthly recurrence clamps to the target month last day", () => {
  const nextDate = getNextReminderOccurrence(
    new Date("2026-01-31T08:00:00.000Z"),
    "monthly",
    { after: new Date("2026-01-31T08:00:00.000Z") },
  );

  assert.equal(nextDate.toISOString(), "2026-02-28T08:00:00.000Z");
});
