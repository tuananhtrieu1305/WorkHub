import assert from "node:assert/strict";
import { RealtimeMeetingService } from "../src/services/realtimeMeetingService.js";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

process.env.CLOUDFLARE_REALTIME_ACCOUNT_ID = "account-id";
process.env.CLOUDFLARE_REALTIME_APP_ID = "app-id";
process.env.CLOUDFLARE_REALTIME_API_TOKEN = "token";

let requestBody = null;
globalThis.fetch = async (_url, options) => {
  requestBody = JSON.parse(options.body);
  return {
    ok: true,
    async json() {
      return { success: true, result: { id: "meeting-id" } };
    },
  };
};

try {
  const service = new RealtimeMeetingService();
  const regularResult = await service.createMeeting({
    title: "WorkHub 1-1 call",
  });

  assert.equal(regularResult.id, "meeting-id");
  assert.equal(requestBody.title, "WorkHub 1-1 call");
  assert.equal(requestBody.record_on_start, undefined);
  assert.equal(requestBody.transcribe_on_end, undefined);
  assert.equal(requestBody.summarize_on_end, undefined);

  const aiResult = await service.createMeeting({
    title: "WorkHub team meeting",
    enableAiSummary: true,
  });

  assert.equal(aiResult.id, "meeting-id");
  assert.equal(requestBody.title, "WorkHub team meeting");
  assert.equal(requestBody.record_on_start, true);
  assert.equal(requestBody.transcribe_on_end, true);
  assert.equal(requestBody.summarize_on_end, true);
  assert.deepEqual(requestBody.ai_config.transcription, {
    language: "vi",
  });
  assert.equal(requestBody.ai_config.summarization.word_limit, 500);
  assert.equal(requestBody.ai_config.summarization.text_format, "markdown");
  assert.equal(
    requestBody.ai_config.summarization.summary_type,
    "team_meeting",
  );
} finally {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
}
