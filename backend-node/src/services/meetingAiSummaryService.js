import Meeting from "../models/Meeting.js";
import MeetingSummary from "../models/MeetingSummary.js";
import { getRealtimeMeetingService } from "./realtimeMeetingService.js";
import {
  summarizeTranscript,
  transcribeRecordingUrl,
} from "./cloudflareAiService.js";

let ioInstance = null;
const recordingPollTimers = new Map();
const RECORDING_POLL_DELAYS_MS = [30000, 60000, 120000, 240000];

export const setMeetingAiSummaryIo = (io) => {
  ioInstance = io;
};

const toId = (value) => String(value?._id || value?.id || value || "");

const formatDate = (date) => {
  if (!date) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
};

const formatTime = (date) => {
  if (!date) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
};

const countJoinedParticipants = (meeting) => {
  const participants = Array.isArray(meeting?.participants)
    ? meeting.participants
    : [];
  const joinedCount = participants.filter(
    (participant) =>
      participant?.joinedAt ||
      participant?.leftAt ||
      participant?.lastHeartbeatAt,
  ).length;

  return joinedCount || participants.length || 0;
};

export const buildMeetingSummaryMetadata = (meeting) => {
  const startedAt = meeting?.startedAt || meeting?.createdAt || null;
  const endedAt = meeting?.endedAt || null;
  const startTime = formatTime(startedAt);
  const endTime = formatTime(endedAt);

  return {
    meetingDate: formatDate(startedAt || endedAt),
    meetingTimeRange:
      startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime,
    meetingTitle: meeting?.title || "Cuộc họp",
    participantCount: countJoinedParticipants(meeting),
  };
};

const getNestedValues = (value, result = []) => {
  if (value == null) return result;
  if (typeof value !== "object") {
    result.push(value);
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => getNestedValues(item, result));
    return result;
  }
  Object.values(value).forEach((item) => getNestedValues(item, result));
  return result;
};

const findStringByKey = (payload, keyPattern) => {
  const stack = [payload];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;

    for (const [key, value] of Object.entries(current)) {
      if (keyPattern.test(key) && typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (value && typeof value === "object") stack.push(value);
    }
  }
  return "";
};

const findFirstUrl = (payload) => {
  const preferred = findStringByKey(
    payload,
    /^(recording_)?(download_)?url$|recordingUrl|downloadUrl|download_url|fileUrl|file_url/i,
  );
  if (preferred && /^https?:\/\//i.test(preferred)) return preferred;

  return (
    getNestedValues(payload)
      .filter((value) => typeof value === "string")
      .find(
        (value) =>
          /^https?:\/\/.+/i.test(value) &&
          /record|\.mp4|\.webm|\.mp3|\.wav/i.test(value),
      ) || ""
  );
};

const findSessionId = (payload) =>
  findStringByKey(payload, /^sessionId$|^session_id$/i);

const findMeetingId = (payload) =>
  findStringByKey(payload, /^meetingId$|^meeting_id$|^roomId$|^room_id$/i);

const findStatus = (payload) =>
  findStringByKey(payload, /^status$|^recording_status$|^recordingStatus$/i);

const findEventType = (payload) =>
  findStringByKey(payload, /^event$|^eventType$|^type$/i);

const isRecordingReadyEvent = (payload) => {
  const eventType = findEventType(payload);
  if (eventType && eventType !== "recording.statusUpdate") return false;

  const status = findStatus(payload).toLowerCase();
  if (!status) return Boolean(findFirstUrl(payload));

  return [
    "completed",
    "complete",
    "uploaded",
    "available",
    "ready",
    "ended",
    "stopped",
    "success",
  ].includes(status);
};

export const extractRecordingWebhookData = (payload = {}) => ({
  eventType: findEventType(payload),
  sessionId: findSessionId(payload),
  meetingId: findMeetingId(payload),
  recordingUrl: findFirstUrl(payload),
  status: findStatus(payload),
});

const toRecordingDownloadUrl = (recording) =>
  recording?.audio_download_url ||
  recording?.audioDownloadUrl ||
  recording?.download_url ||
  recording?.downloadUrl ||
  "";

const buildRecordingPayload = ({ meetingId, recording }) => ({
  event: "recording.statusUpdate",
  data: {
    meetingId,
    sessionId: recording?.session_id || recording?.sessionId || "",
    recording: {
      id: recording?.id,
      status: recording?.status || "UPLOADED",
      downloadUrl: toRecordingDownloadUrl(recording),
      raw: recording,
    },
  },
});

const emitSummaryEvent = (meeting, summary) => {
  ioInstance?.emit?.("meeting_ai_summary_updated", {
    meetingId: toId(meeting?._id),
    cloudflareMeetingId: meeting?.cloudflareMeetingId || "",
    summary: {
      id: toId(summary?._id),
      status: summary?.status || "processing",
      errorMessage: summary?.errorMessage || "",
    },
  });
};

export const processRecordingForMeetingId = async (cloudflareMeetingId) => {
  if (!cloudflareMeetingId) {
    return { skipped: true, reason: "missing_meeting_id" };
  }

  const realtimeService = getRealtimeMeetingService();
  const recordings = await realtimeService.listRecordings({
    meetingId: cloudflareMeetingId,
  });
  const recording = recordings.find(
    (item) => item?.status === "UPLOADED" && toRecordingDownloadUrl(item),
  );

  if (!recording) {
    return { skipped: true, reason: "recording_not_uploaded" };
  }

  return processRecordingWebhook(
    buildRecordingPayload({ meetingId: cloudflareMeetingId, recording }),
  );
};

export const scheduleMeetingRecordingSummary = (meeting, { attempt = 0 } = {}) => {
  const cloudflareMeetingId = meeting?.cloudflareMeetingId;
  if (!cloudflareMeetingId) return;

  const existingTimer = recordingPollTimers.get(cloudflareMeetingId);
  if (existingTimer) clearTimeout(existingTimer);

  const delayMs =
    RECORDING_POLL_DELAYS_MS[
      Math.min(attempt, RECORDING_POLL_DELAYS_MS.length - 1)
    ];

  const timer = setTimeout(async () => {
    recordingPollTimers.delete(cloudflareMeetingId);
    try {
      const result = await processRecordingForMeetingId(cloudflareMeetingId);
      console.log("Meeting recording summary poll result:", {
        cloudflareMeetingId,
        attempt,
        result,
      });

      if (
        result?.skipped &&
        result.reason === "recording_not_uploaded" &&
        attempt < RECORDING_POLL_DELAYS_MS.length - 1
      ) {
        scheduleMeetingRecordingSummary(meeting, { attempt: attempt + 1 });
      }
    } catch (error) {
      console.error("Meeting recording summary poll error:", {
        cloudflareMeetingId,
        attempt,
        message: error.message,
      });
      if (attempt < RECORDING_POLL_DELAYS_MS.length - 1) {
        scheduleMeetingRecordingSummary(meeting, { attempt: attempt + 1 });
      }
    }
  }, delayMs);

  timer.unref?.();
  recordingPollTimers.set(cloudflareMeetingId, timer);
};

export const processRecordingWebhook = async (payload = {}) => {
  if (!isRecordingReadyEvent(payload)) {
    console.log("Cloudflare recording webhook skipped:", {
      reason: "recording_not_ready",
      event: extractRecordingWebhookData(payload),
    });
    return { skipped: true, reason: "recording_not_ready" };
  }

  const { sessionId, meetingId, recordingUrl } =
    extractRecordingWebhookData(payload);
  if (!meetingId || !recordingUrl) {
    const result = {
      skipped: true,
      reason: "missing_meeting_reference_or_recording_url",
    };
    console.log("Cloudflare recording webhook skipped:", {
      ...result,
      event: extractRecordingWebhookData(payload),
    });
    return result;
  }

  const meeting = await Meeting.findOne({ cloudflareMeetingId: meetingId });
  if (!meeting) {
    const result = { skipped: true, reason: "meeting_not_found" };
    console.log("Cloudflare recording webhook skipped:", {
      ...result,
      event: { sessionId, meetingId, hasRecordingUrl: Boolean(recordingUrl) },
    });
    return result;
  }
  if (!meeting.aiSummaryEnabled) {
    const result = { skipped: true, reason: "ai_summary_disabled" };
    console.log("Cloudflare recording webhook skipped:", {
      ...result,
      event: { sessionId, meetingId, hasRecordingUrl: Boolean(recordingUrl) },
    });
    return result;
  }

  let summary = await MeetingSummary.findOne({ meetingId: meeting._id });
  if (summary?.status === "completed") {
    return { skipped: true, reason: "already_completed" };
  }

  summary =
    summary ||
    (await MeetingSummary.create({
      meetingId: meeting._id,
      organizationId: meeting.organizationId || null,
      generatedBy: meeting.hostUserId || meeting.createdBy,
      source: "recording",
      status: "processing",
      transcript: "",
    }));

  summary.cloudflareSessionId = sessionId;
  summary.recordingUrl = recordingUrl;
  summary.rawWebhook = payload;
  summary.status = "processing";
  summary.errorMessage = "";
  await summary.save();
  emitSummaryEvent(meeting, summary);

  try {
    const transcription = await transcribeRecordingUrl(recordingUrl);
    if (!transcription.text) {
      summary.rawResponse = JSON.stringify({
        transcription: transcription.raw,
      }).slice(0, 20000);
      await summary.save();
      throw new Error("Workers AI returned an empty transcript");
    }

    summary.transcript = transcription.text;
    summary.model = transcription.model;
    summary.rawResponse = JSON.stringify({
      transcription: transcription.raw,
    }).slice(0, 20000);
    await summary.save();
    emitSummaryEvent(meeting, summary);

    const aiSummary = await summarizeTranscript(
      transcription.text,
      buildMeetingSummaryMetadata(meeting),
    );
    summary.title = aiSummary.title || "AI Meeting Summary";
    summary.summary = aiSummary.summary;
    summary.decisions = aiSummary.decisions;
    summary.actionItems = aiSummary.actionItems;
    summary.followUps = aiSummary.followUps;
    summary.model = `${transcription.model}; ${aiSummary.model}`;
    summary.rawResponse = JSON.stringify({
      transcription: transcription.raw,
      summary: aiSummary.raw,
    }).slice(0, 20000);
    summary.status = "completed";
    await summary.save();
    emitSummaryEvent(meeting, summary);

    return { skipped: false, summaryId: toId(summary._id) };
  } catch (error) {
    summary.status = "failed";
    summary.errorMessage = error.message || "AI meeting summary failed";
    await summary.save();
    emitSummaryEvent(meeting, summary);
    throw error;
  }
};
