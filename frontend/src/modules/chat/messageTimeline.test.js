import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMessageTimeline,
  formatMessageTimestamp,
  getHoverTimestampPlacement,
} from "./messageTimeline.js";

const now = new Date("2026-06-09T12:00:00+07:00");

test("formats today's message timestamp as time only", () => {
  assert.equal(
    formatMessageTimestamp("2026-06-09T10:53:00+07:00", { now }),
    "10:53",
  );
});

test("formats older message timestamp with date after the time", () => {
  assert.equal(
    formatMessageTimestamp("2026-06-01T10:53:00+07:00", { now }),
    "10:53 1 Tháng 6, 2026",
  );
});

test("builds timeline separators and message spacing from send times", () => {
  const messages = [
    {
      id: "m1",
      createdAt: "2026-06-01T10:00:00+07:00",
      sender: { _id: "u1" },
    },
    {
      id: "m2",
      createdAt: "2026-06-01T10:01:30+07:00",
      sender: { _id: "u1" },
    },
    {
      id: "m3",
      createdAt: "2026-06-01T10:04:00+07:00",
      sender: { _id: "u1" },
    },
    {
      id: "m4",
      createdAt: "2026-06-01T10:26:00+07:00",
      sender: { _id: "u1" },
    },
  ];

  const timeline = buildMessageTimeline(messages, { now });

  assert.deepEqual(
    timeline.map((item) => ({
      type: item.type,
      id: item.id,
      label: item.label,
      spacing: item.spacing,
      showSenderHeader: item.showSenderHeader,
      showAvatar: item.showAvatar,
      hasTightNext: item.hasTightNext,
      timestampLabel: item.timestampLabel,
    })),
    [
      {
        type: "separator",
        id: "separator-m1",
        label: "10:00",
        spacing: undefined,
        showSenderHeader: undefined,
        showAvatar: undefined,
        hasTightNext: undefined,
        timestampLabel: undefined,
      },
      {
        type: "message",
        id: "m1",
        label: undefined,
        spacing: "after-separator",
        showSenderHeader: true,
        showAvatar: false,
        hasTightNext: true,
        timestampLabel: "10:00 1 Tháng 6, 2026",
      },
      {
        type: "message",
        id: "m2",
        label: undefined,
        spacing: "tight",
        showSenderHeader: false,
        showAvatar: false,
        hasTightNext: false,
        timestampLabel: "10:01 1 Tháng 6, 2026",
      },
      {
        type: "message",
        id: "m3",
        label: undefined,
        spacing: "relaxed",
        showSenderHeader: false,
        showAvatar: true,
        hasTightNext: false,
        timestampLabel: "10:04 1 Tháng 6, 2026",
      },
      {
        type: "separator",
        id: "separator-m4",
        label: "10:26",
        spacing: undefined,
        showSenderHeader: undefined,
        showAvatar: undefined,
        hasTightNext: undefined,
        timestampLabel: undefined,
      },
      {
        type: "message",
        id: "m4",
        label: undefined,
        spacing: "after-separator",
        showSenderHeader: true,
        showAvatar: true,
        hasTightNext: false,
        timestampLabel: "10:26 1 Tháng 6, 2026",
      },
    ],
  );
});

test("keeps sender headers at the start and avatars at the end until the 20 minute separator", () => {
  const timeline = buildMessageTimeline(
    [
      {
        id: "m1",
        createdAt: "2026-06-09T10:00:00+07:00",
        sender: { _id: "u1" },
      },
      {
        id: "m2",
        createdAt: "2026-06-09T10:02:01+07:00",
        sender: { _id: "u1" },
      },
      {
        id: "m3",
        createdAt: "2026-06-09T10:22:01+07:00",
        sender: { _id: "u1" },
      },
    ],
    { now },
  );

  assert.deepEqual(
    timeline.map((item) => ({
      type: item.type,
      id: item.id,
      label: item.label,
      spacing: item.spacing,
      showSenderHeader: item.showSenderHeader,
      showAvatar: item.showAvatar,
    })),
    [
      {
        type: "separator",
        id: "separator-m1",
        label: "10:00",
        spacing: undefined,
        showSenderHeader: undefined,
        showAvatar: undefined,
      },
      {
        type: "message",
        id: "m1",
        label: undefined,
        spacing: "after-separator",
        showSenderHeader: true,
        showAvatar: false,
      },
      {
        type: "message",
        id: "m2",
        label: undefined,
        spacing: "relaxed",
        showSenderHeader: false,
        showAvatar: true,
      },
      {
        type: "separator",
        id: "separator-m3",
        label: "10:22",
        spacing: undefined,
        showSenderHeader: undefined,
        showAvatar: undefined,
      },
      {
        type: "message",
        id: "m3",
        label: undefined,
        spacing: "after-separator",
        showSenderHeader: true,
        showAvatar: true,
      },
    ],
  );
});

test("places hover timestamp opposite each message side", () => {
  assert.equal(getHoverTimestampPlacement(true), "right");
  assert.equal(getHoverTimestampPlacement(false), "left");
});
