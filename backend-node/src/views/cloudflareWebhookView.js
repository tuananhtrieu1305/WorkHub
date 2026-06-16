import express from "express";
import {
  extractRecordingWebhookData,
  processRecordingWebhook,
} from "../services/meetingAiSummaryService.js";

const router = express.Router();

router.post("/realtime", (req, res) => {
  const payload = req.body || {};
  const event = extractRecordingWebhookData(payload);

  res.status(202).json({
    accepted: true,
    eventType: event.eventType || null,
    sessionId: event.sessionId || null,
    meetingId: event.meetingId || null,
  });

  processRecordingWebhook(payload).catch((error) => {
    console.error("Cloudflare realtime webhook processing error:", error.message);
  });
});

export default router;
