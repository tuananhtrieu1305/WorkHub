import { readFile, writeFile } from "node:fs/promises";
import {
  preprocessAudioBuffer,
  summarizeTranscript,
} from "../services/cloudflareAiService.js";

const inputPath = process.argv[2] || "/tmp/audioTest.mp3";
const outputPath = process.argv[3] || "/tmp/audioTest-preprocess-pipeline.json";

const getAccountId = () =>
  process.env.CLOUDFLARE_AI_ACCOUNT_ID ||
  process.env.CLOUDFLARE_ACCOUNT_ID ||
  process.env.CLOUDFLARE_REALTIME_ACCOUNT_ID ||
  process.env.R2_ACCOUNT_ID;

const getToken = () =>
  process.env.CLOUDFLARE_AI_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

const input = await readFile(inputPath);
const processed = await preprocessAudioBuffer(input);
const accountId = getAccountId();
const token = getToken();

if (!accountId || !token) {
  throw new Error("Missing Cloudflare AI credentials");
}

const whisperModel =
  process.env.CLOUDFLARE_AI_WHISPER_MODEL ||
  "@cf/openai/whisper-large-v3-turbo";
const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${whisperModel}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio: processed.buffer.toString("base64"),
      language: process.env.CLOUDFLARE_AI_TRANSCRIPTION_LANGUAGE || "vi",
      task: "transcribe",
      vad_filter: false,
      beam_size: Number.parseInt(
        process.env.CLOUDFLARE_AI_WHISPER_BEAM_SIZE || "8",
        10,
      ),
      condition_on_previous_text: true,
      no_speech_threshold: Number.parseFloat(
        process.env.CLOUDFLARE_AI_WHISPER_NO_SPEECH_THRESHOLD || "0.6",
      ),
      compression_ratio_threshold: Number.parseFloat(
        process.env.CLOUDFLARE_AI_WHISPER_COMPRESSION_RATIO_THRESHOLD || "2.4",
      ),
      log_prob_threshold: Number.parseFloat(
        process.env.CLOUDFLARE_AI_WHISPER_LOG_PROB_THRESHOLD || "-1.0",
      ),
      hallucination_silence_threshold: Number.parseFloat(
        process.env.CLOUDFLARE_AI_WHISPER_HALLUCINATION_SILENCE_THRESHOLD ||
          "1.5",
      ),
      initial_prompt:
        process.env.CLOUDFLARE_AI_TRANSCRIPTION_PROMPT ||
        "Vietnamese workplace call audio. Preserve English product names, proper nouns, and technical terms when spoken.",
    }),
  },
);

const whisper = await response.json().catch(() => ({}));
if (!response.ok || whisper.success === false) {
  throw new Error(JSON.stringify(whisper));
}

const whisperResult = whisper.result || {};
const transcript = String(
  whisperResult.text ||
    whisperResult.transcription_info?.text ||
    whisperResult.transcript ||
    "",
).trim();

const summary = await summarizeTranscript(transcript, {
  meetingDate: "16/06/2026",
  meetingTimeRange: "10:00 - 10:30",
  meetingTitle: "NASA Discovery Review",
  participantCount: 3,
});

const output = {
  preprocess: {
    applied: processed.applied,
    reason: processed.reason,
    inputBytes: input.length,
    outputBytes: processed.buffer.length,
  },
  transcript,
  summary,
};

await writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");
console.log(JSON.stringify(output, null, 2));
