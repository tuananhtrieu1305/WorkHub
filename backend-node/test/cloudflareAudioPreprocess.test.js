import assert from "node:assert/strict";
import {
  buildFfmpegPreprocessArgs,
  shouldPreprocessAudio,
} from "../src/services/cloudflareAiService.js";

const args = buildFfmpegPreprocessArgs("/tmp/input.mp3", "/tmp/output.wav");

assert.deepEqual(args.slice(0, 5), [
  "-y",
  "-hide_banner",
  "-loglevel",
  "error",
  "-i",
]);
assert.ok(args.includes("/tmp/input.mp3"));
assert.ok(args.includes("-ac"));
assert.ok(args.includes("1"));
assert.ok(args.includes("-ar"));
assert.ok(args.includes("16000"));

const filterIndex = args.indexOf("-af");
assert.ok(filterIndex > -1);
assert.equal(
  args[filterIndex + 1],
  "loudnorm,highpass=f=80,lowpass=f=8000,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.5",
);
assert.equal(args.at(-1), "/tmp/output.wav");

delete process.env.CLOUDFLARE_AI_AUDIO_PREPROCESS;
assert.equal(shouldPreprocessAudio(), true);

process.env.CLOUDFLARE_AI_AUDIO_PREPROCESS = "false";
assert.equal(shouldPreprocessAudio(), false);
