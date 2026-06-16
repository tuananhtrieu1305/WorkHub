import assert from "node:assert/strict";

const expectedModel = "@cf/qwen/qwen3-30b-a3b-fp8";
const originalFetch = globalThis.fetch;

process.env.CLOUDFLARE_AI_ACCOUNT_ID = "test-account";
process.env.CLOUDFLARE_AI_API_TOKEN = "test-token";
delete process.env.CLOUDFLARE_AI_SUMMARY_MODEL;

let requestedUrl = "";
let requestedPayload = null;

globalThis.fetch = async (url, options) => {
  requestedUrl = String(url);
  requestedPayload = JSON.parse(options.body);

  return {
    ok: true,
    async json() {
      return {
        success: true,
        result: {
          response: [
            "Model reasoning before JSON.",
            '{"title":"Example","summary":"Example should be ignored.","decisions":[],"actionItems":[],"followUps":[]}',
            "More reasoning.",
            '{"title":"Demo","summary":"Demo summary. More detail.","decisions":[],"actionItems":[],"followUps":[]}',
            '```json\n{"title":"Partial"',
          ].join("\n"),
        },
      };
    },
  };
};

try {
  const { summarizeTranscript } = await import(
    "../src/services/cloudflareAiService.js?defaults-test"
  );
  const summary = await summarizeTranscript("Demo transcript", {
    meetingDate: "16/06/2026",
    meetingTimeRange: "10:00 - 10:30",
    meetingTitle: "Weekly Sync",
    participantCount: 3,
  });

  assert.equal(summary.model, expectedModel);
  assert.ok(requestedUrl.endsWith(`/ai/run/${expectedModel}`));
  assert.ok(
    requestedPayload.prompt.includes(
      'Đây là cuộc họp ngày 16/06/2026 trong khoảng thời gian 10:00 - 10:30 với tiêu đề "Weekly Sync" với sự tham gia của 3 thành viên.',
    ),
  );
  assert.ok(requestedPayload.prompt.includes("Các nội dung chính:"));
  assert.equal(
    summary.summary,
    'Đây là cuộc họp ngày 16/06/2026 trong khoảng thời gian 10:00 - 10:30 với tiêu đề "Weekly Sync" với sự tham gia của 3 thành viên.\n\nCác nội dung chính:\n- Demo summary.\n- More detail.',
  );
  assert.equal(requestedPayload.temperature, 0.2);
  assert.equal(requestedPayload.repetition_penalty, 1.1);
  assert.equal(typeof requestedPayload.max_tokens, "number");
} finally {
  globalThis.fetch = originalFetch;
}
