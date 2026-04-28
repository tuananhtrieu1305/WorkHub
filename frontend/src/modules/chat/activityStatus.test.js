import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACTIVITY_STATUS_OPTIONS,
  getEffectiveActivityStatus,
  getActivityStatusMeta,
  getDefaultActivityStatusDuration,
  ACTIVITY_STATUS_DURATIONS,
  normalizeActivityStatus,
} from "./activityStatus.js";

describe("chat activity status metadata", () => {
  it("normalizes unknown status values to online instead of offline", () => {
    assert.equal(normalizeActivityStatus(), "online");
    assert.equal(normalizeActivityStatus("legacy-offline"), "online");
  });

  it("provides labels and icons for the four configured statuses", () => {
    assert.deepEqual(
      ACTIVITY_STATUS_OPTIONS.map((option) => option.value),
      ["online", "idle", "dnd", "invisible"],
    );

    assert.equal(getActivityStatusMeta("online").label, "Đang hoạt động");
    assert.equal(getActivityStatusMeta("idle").label, "Chờ");
    assert.equal(getActivityStatusMeta("dnd").label, "Không làm phiền");
    assert.equal(getActivityStatusMeta("invisible").label, "");
    assert.ok(getActivityStatusMeta("invisible").icon);
  });

  it("uses offline display when a user has no active socket connection", () => {
    assert.equal(
      getEffectiveActivityStatus({ activityStatus: "online", isOnline: false }),
      "offline",
    );
    assert.equal(getActivityStatusMeta("offline").label, "");
    assert.equal(getActivityStatusMeta("offline").icon, "offline_ring");
  });

  it("provides all configured duration choices and defaults direct status clicks to forever", () => {
    assert.deepEqual(
      ACTIVITY_STATUS_DURATIONS.map((duration) => ({
        label: duration.label,
        expiresInMinutes: duration.expiresInMinutes,
      })),
      [
        { label: "Trong vòng 15 phút", expiresInMinutes: 15 },
        { label: "Trong vòng 1 giờ", expiresInMinutes: 60 },
        { label: "Trong vòng 8 giờ", expiresInMinutes: 8 * 60 },
        { label: "Trong vòng 24 giờ", expiresInMinutes: 24 * 60 },
        { label: "Trong 3 ngày", expiresInMinutes: 3 * 24 * 60 },
        { label: "Vĩnh viễn", expiresInMinutes: null },
      ],
    );

    assert.equal(getDefaultActivityStatusDuration(), null);
  });
});
