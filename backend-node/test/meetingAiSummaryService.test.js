import assert from "node:assert/strict";
import {
  buildMeetingSummaryMetadata,
  extractRecordingWebhookData,
} from "../src/services/meetingAiSummaryService.js";

const payload = {
  event: "recording.statusUpdate",
  data: {
    sessionId: "session-123",
    meetingId: "meeting-456",
    recording: {
      status: "completed",
      downloadUrl: "https://example.com/recording.mp4",
    },
  },
};

const result = extractRecordingWebhookData(payload);

assert.equal(result.eventType, "recording.statusUpdate");
assert.equal(result.sessionId, "session-123");
assert.equal(result.meetingId, "meeting-456");
assert.equal(result.status, "completed");
assert.equal(result.recordingUrl, "https://example.com/recording.mp4");

const metadata = buildMeetingSummaryMetadata({
  title: "Sprint Planning",
  startedAt: new Date("2026-06-16T03:00:00.000Z"),
  endedAt: new Date("2026-06-16T03:30:00.000Z"),
  participants: [
    { joinedAt: new Date("2026-06-16T03:00:00.000Z") },
    { lastHeartbeatAt: new Date("2026-06-16T03:20:00.000Z") },
    {},
  ],
});

assert.equal(metadata.meetingDate, "16/06/2026");
assert.equal(metadata.meetingTimeRange, "10:00 - 10:30");
assert.equal(metadata.meetingTitle, "Sprint Planning");
assert.equal(metadata.participantCount, 2);
