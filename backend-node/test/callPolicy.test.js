import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCallHeartbeat,
  isCallHeartbeatStale,
} from "../src/utils/callPolicy.js";

test("active call heartbeat is not stale after a short browser scheduling gap", () => {
  const lastHeartbeatAt = new Date("2026-06-16T10:33:47.663Z");
  const now = new Date("2026-06-16T10:34:23.875Z");

  assert.equal(isCallHeartbeatStale(lastHeartbeatAt, now), false);
});

test("active call heartbeat becomes stale after the normal grace window", () => {
  const lastHeartbeatAt = new Date("2026-06-16T10:00:00.000Z");
  const now = new Date("2026-06-16T10:00:41.000Z");

  assert.equal(isCallHeartbeatStale(lastHeartbeatAt, now), true);
});

test("call heartbeat updates only the matching participant", () => {
  const now = new Date("2026-06-16T10:34:00.000Z");
  const previous = new Date("2026-06-16T10:33:00.000Z");
  const participants = [
    { userId: "user-1", lastHeartbeatAt: previous, disconnectedAt: previous },
    { userId: "user-2", lastHeartbeatAt: previous, disconnectedAt: previous },
  ];

  const result = applyCallHeartbeat(participants, "user-2", now);

  assert.equal(result.updated, true);
  assert.equal(result.participants[0].lastHeartbeatAt, previous);
  assert.equal(result.participants[1].lastHeartbeatAt, now);
  assert.equal(result.participants[1].disconnectedAt, null);
});

test("call heartbeat updates mongoose-like subdocument data", () => {
  const now = new Date("2026-06-16T10:34:00.000Z");
  const previous = new Date("2026-06-16T10:33:00.000Z");
  const participants = [
    {
      userId: "user-1",
      toObject: () => ({
        userId: "user-1",
        role: "caller",
        lastHeartbeatAt: previous,
        disconnectedAt: previous,
      }),
    },
  ];

  const result = applyCallHeartbeat(participants, "user-1", now);

  assert.equal(result.updated, true);
  assert.equal(result.participants[0].lastHeartbeatAt, now);
  assert.equal(result.participants[0].disconnectedAt, null);
  assert.equal(result.participants[0].toObject, undefined);
});
