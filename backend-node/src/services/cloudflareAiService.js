import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import ApiError from "../utils/apiError.js";

const execFileAsync = promisify(execFile);

const WHISPER_MODEL =
  process.env.CLOUDFLARE_AI_WHISPER_MODEL ||
  "@cf/openai/whisper-large-v3-turbo";
const SUMMARY_MODEL =
  process.env.CLOUDFLARE_AI_SUMMARY_MODEL ||
  "@cf/qwen/qwen3-30b-a3b-fp8";

const getAccountId = () =>
  process.env.CLOUDFLARE_AI_ACCOUNT_ID ||
  process.env.CLOUDFLARE_ACCOUNT_ID ||
  process.env.CLOUDFLARE_REALTIME_ACCOUNT_ID ||
  process.env.R2_ACCOUNT_ID;

const getApiToken = () =>
  process.env.CLOUDFLARE_AI_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

const parseBooleanEnv = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

export const shouldPreprocessAudio = () =>
  parseBooleanEnv(process.env.CLOUDFLARE_AI_AUDIO_PREPROCESS, true);

export const buildFfmpegPreprocessArgs = (inputPath, outputPath) => [
  "-y",
  "-hide_banner",
  "-loglevel",
  "error",
  "-i",
  inputPath,
  "-ac",
  "1",
  "-ar",
  "16000",
  "-af",
  "loudnorm,highpass=f=80,lowpass=f=8000,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.5",
  outputPath,
];

export const preprocessAudioBuffer = async (buffer) => {
  if (!shouldPreprocessAudio()) {
    return { buffer, applied: false, reason: "disabled" };
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "workhub-audio-"));
  const inputPath = path.join(tempDir, "input.audio");
  const outputPath = path.join(tempDir, "output.flac");
  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
  const timeout = Number.parseInt(
    process.env.CLOUDFLARE_AI_AUDIO_PREPROCESS_TIMEOUT_MS || "120000",
    10,
  );

  try {
    await writeFile(inputPath, buffer);
    await execFileAsync(
      ffmpegPath,
      buildFfmpegPreprocessArgs(inputPath, outputPath),
      { timeout },
    );

    return {
      buffer: await readFile(outputPath),
      applied: true,
      reason: "",
    };
  } catch (error) {
    console.warn("Cloudflare AI audio preprocess skipped:", {
      message: error.message,
    });
    return { buffer, applied: false, reason: error.message };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};

const getWorkersAiUrl = (model) => {
  const accountId = getAccountId();
  if (!accountId) {
    throw new ApiError(503, "Cloudflare AI account id is not configured");
  }
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
};

const getHeaders = () => {
  const token = getApiToken();
  if (!token) {
    throw new ApiError(503, "Cloudflare AI API token is not configured");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const postWorkersAi = async (model, payload) => {
  const response = await fetch(getWorkersAiUrl(model), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    throw new ApiError(
      502,
      json?.errors?.[0]?.message || "Cloudflare Workers AI request failed",
    );
  }

  return json.result || json.data || json;
};

export const downloadAudioAsBase64 = async (url) => {
  if (!url) {
    throw new ApiError(400, "Recording URL is required");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError(502, "Unable to download Cloudflare recording");
  }

  const contentLength = Number.parseInt(
    response.headers.get("content-length") || "0",
    10,
  );
  const maxBytes =
    Number.parseInt(process.env.CLOUDFLARE_AI_MAX_AUDIO_MB || "25", 10) *
    1024 *
    1024;
  if (contentLength && contentLength > maxBytes) {
    throw new ApiError(413, "Recording is too large for AI transcription");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) {
    throw new ApiError(413, "Recording is too large for AI transcription");
  }

  const processed = await preprocessAudioBuffer(buffer);
  if (processed.buffer.length > maxBytes) {
    throw new ApiError(
      413,
      "Preprocessed recording is too large for AI transcription",
    );
  }

  return processed.buffer.toString("base64");
};

export const transcribeRecordingUrl = async (url) => {
  const audio = await downloadAudioAsBase64(url);
  const vadFilter = parseBooleanEnv(
    process.env.CLOUDFLARE_AI_WHISPER_VAD_FILTER,
    false,
  );
  const buildPayload = (useVadFilter) => ({
    audio,
    language: process.env.CLOUDFLARE_AI_TRANSCRIPTION_LANGUAGE || "vi",
    task: "transcribe",
    vad_filter: useVadFilter,
    beam_size: Number.parseInt(process.env.CLOUDFLARE_AI_WHISPER_BEAM_SIZE || "8", 10),
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
      "Vietnamese workplace call audio. Preserve English product names, proper nouns, and technical terms such as WorkHub, Cloudflare, RealtimeKit, Workers AI, API, frontend, backend, MongoDB, Socket.IO, task, deadline, document preview, and upload file.",
  });

  let result = await postWorkersAi(WHISPER_MODEL, buildPayload(vadFilter));
  let text =
    result?.text || result?.transcription_info?.text || result?.transcript || "";

  if (!String(text || "").trim() && vadFilter) {
    const retryResult = await postWorkersAi(WHISPER_MODEL, buildPayload(false));
    result = {
      ...retryResult,
      retry_reason: "empty_transcript_after_vad",
      first_attempt: result,
    };
    text =
      retryResult?.text ||
      retryResult?.transcription_info?.text ||
      retryResult?.transcript ||
      "";
  }

  return {
    model: WHISPER_MODEL,
    text: String(text || "").trim(),
    raw: result,
  };
};

const extractJsonObject = (text) => {
  const source = String(text || "").trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || source;

  const parsedObjects = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < candidate.length; index += 1) {
    const char = candidate[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        try {
          parsedObjects.push(JSON.parse(candidate.slice(start, index + 1)));
        } catch {
          // Ignore malformed JSON-like fragments in model output.
        }
        start = -1;
      }
    }
  }

  return (
    parsedObjects.reverse().find((item) => item?.summary || item?.title) || null
  );
};

const normalizeList = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 20);
};

const normalizeActionItems = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        return { title: item.trim(), owner: "", dueDate: "", priority: "medium" };
      }
      return {
        title: String(item?.title || item?.task || "").trim(),
        owner: String(item?.owner || item?.assignee || "").trim(),
        dueDate: String(item?.dueDate || item?.deadline || "").trim(),
        priority: ["low", "medium", "high", "urgent"].includes(item?.priority)
          ? item.priority
          : "medium",
      };
    })
    .filter((item) => item.title)
    .slice(0, 20);
};

const normalizeMeetingMetadata = (metadata = {}) => ({
  meetingDate: String(metadata.meetingDate || "[NGÀY]").trim() || "[NGÀY]",
  meetingTimeRange:
    String(metadata.meetingTimeRange || "[THỜI_GIAN]").trim() || "[THỜI_GIAN]",
  meetingTitle:
    String(metadata.meetingTitle || metadata.title || "[TIÊU_ĐỀ]").trim() ||
    "[TIÊU_ĐỀ]",
  participantCount:
    Number.isFinite(Number(metadata.participantCount)) &&
    Number(metadata.participantCount) >= 0
      ? Number(metadata.participantCount)
      : "[SỐ_LƯỢNG]",
});

const splitSummaryBullets = (summary) => {
  const text = String(summary || "").trim();
  if (!text) return ["Không có đủ nội dung để tóm tắt."];

  const bulletLines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean);
  const candidates =
    bulletLines.length > 1
      ? bulletLines
      : text
          .split(/(?<=[.!?。！？])\s+/)
          .map((item) => item.trim())
          .filter(Boolean);

  return candidates
    .filter(
      (item) =>
        !/^đây là cuộc họp ngày/i.test(item) &&
        !/^cuộc họp ngày/i.test(item) &&
        !/^các nội dung chính:?$/i.test(item),
    )
    .slice(0, 6)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
};

const formatRequiredSummary = (summary, metadata) => {
  const bullets = splitSummaryBullets(summary);
  const safeBullets = bullets.length
    ? bullets
    : ["Không có đủ nội dung để tóm tắt."];

  return [
    `Đây là cuộc họp ngày ${metadata.meetingDate} trong khoảng thời gian ${metadata.meetingTimeRange} với tiêu đề "${metadata.meetingTitle}" với sự tham gia của ${metadata.participantCount} thành viên.`,
    "",
    "Các nội dung chính:",
    ...safeBullets.map((item) => `- ${item}`),
  ].join("\n");
};

export const summarizeTranscript = async (transcript, metadata = {}) => {
  const meetingMetadata = normalizeMeetingMetadata(metadata);
  const requiredSummaryTemplate = `Đây là cuộc họp ngày ${meetingMetadata.meetingDate} trong khoảng thời gian ${meetingMetadata.meetingTimeRange} với tiêu đề "${meetingMetadata.meetingTitle}" với sự tham gia của ${meetingMetadata.participantCount} thành viên.

Các nội dung chính:
- [Nội dung tóm tắt 1]
- [Nội dung tóm tắt 2]`;

  const prompt = [
    "Bạn là một AI Meeting Assistant chuyên nghiệp của WorkHub.",
    "Nhiệm vụ của bạn là xử lý và tóm tắt văn bản thô được trích xuất từ phần mềm Speech-to-Text.",
    "",
    "NHIỆM VỤ:",
    "1. Đọc hiểu đoạn transcript đầu vào. Transcript có thể chứa lỗi nhận diện giọng nói, sai chính tả, sai thuật ngữ chuyên ngành công nghệ; hãy hiệu chỉnh nhẹ dựa trên ngữ cảnh trước khi tóm tắt.",
    "2. Lọc bỏ từ ngữ thừa, filler words, giao tiếp ậm ờ, câu lặp và nhiễu không có ý nghĩa.",
    "3. Chỉ trích xuất thông tin thực sự xuất hiện trong transcript. Không suy đoán, không tự thêm bối cảnh, không bịa người phụ trách/thời hạn/quyết định.",
    "4. Nếu transcript ngắn hoặc không đủ dữ kiện, hãy trả summary rất ngắn và để các danh sách không có dữ kiện là mảng rỗng.",
    "",
    "METADATA CUỘC HỌP:",
    `- Ngày: ${meetingMetadata.meetingDate}`,
    `- Thời gian: ${meetingMetadata.meetingTimeRange}`,
    `- Tiêu đề: ${meetingMetadata.meetingTitle}`,
    `- Số lượng thành viên tham gia: ${meetingMetadata.participantCount}`,
    "",
    "CẤU TRÚC FIELD summary BẮT BUỘC:",
    requiredSummaryTemplate,
    "",
    "CẤU TRÚC ĐẦU RA PHẢI LÀ JSON HỢP LỆ, KHÔNG MARKDOWN, KHÔNG GIẢI THÍCH THÊM:",
    '{"title":"","summary":"","decisions":[],"actionItems":[{"title":"","owner":"","dueDate":"","priority":"medium"}],"followUps":[]}',
    "",
    "Quy ước mapping:",
    "- title: tiêu đề ngắn cho cuộc họp/video.",
    "- summary: trả đúng cấu trúc bắt buộc ở trên. Phần 'Các nội dung chính' gồm 2-6 bullet ngắn, mỗi bullet là một ý chính rõ ràng.",
    "- decisions: luôn trả mảng rỗng [].",
    "- actionItems: luôn trả mảng rỗng [].",
    "- followUps: luôn trả mảng rỗng [].",
    "",
    "Ràng buộc chất lượng:",
    "- Tất cả field dạng text trong JSON BẮT BUỘC viết bằng tiếng Việt tự nhiên. Không dùng tiếng Anh trừ thuật ngữ kỹ thuật hoặc tên riêng có trong transcript.",
    "- Giữ nguyên thuật ngữ tiếng Anh/chuyên ngành nếu chúng thực sự xuất hiện trong transcript; không tự thêm thuật ngữ hoặc tên sản phẩm không có trong transcript.",
    "- Không lặp lại cùng một ý.",
    "- Không thêm thông tin không có trong transcript hoặc metadata.",
    "- Summary không được dài hơn transcript một cách bất thường.",
    "- Nếu không có nội dung đáng kể, phần 'Các nội dung chính' chỉ gồm một bullet: 'Không có đủ nội dung để tóm tắt.'",
    "- Văn phong chuyên nghiệp, mạch lạc, tiếng Việt tự nhiên.",
    "",
    "Transcript:",
    transcript,
  ].join("\n");

  const result = await postWorkersAi(SUMMARY_MODEL, {
    prompt,
    max_tokens: Number.parseInt(
      process.env.CLOUDFLARE_AI_SUMMARY_MAX_TOKENS || "1400",
      10,
    ),
    temperature: Number.parseFloat(
      process.env.CLOUDFLARE_AI_SUMMARY_TEMPERATURE || "0.2",
    ),
    repetition_penalty: Number.parseFloat(
      process.env.CLOUDFLARE_AI_SUMMARY_REPETITION_PENALTY || "1.1",
    ),
  });
  const text =
    result?.response || result?.text || result?.generated_text || JSON.stringify(result);
  const parsed = extractJsonObject(text) || {};

  return {
    model: SUMMARY_MODEL,
    raw: result,
    title: String(parsed.title || "AI Meeting Summary").trim(),
    summary: formatRequiredSummary(parsed.summary || text || "", meetingMetadata),
    decisions: normalizeList(parsed.decisions),
    actionItems: normalizeActionItems(parsed.actionItems || parsed.action_items),
    followUps: normalizeList(parsed.followUps || parsed.follow_ups),
  };
};
