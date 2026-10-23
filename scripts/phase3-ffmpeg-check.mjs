import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildExportPlan } from "../lib/export-plan.ts";

const dir = mkdtempSync(join(tmpdir(), "gfd-phase3-media-"));
const picture = join(dir, "picture.mp4");
const music = join(dir, "music.m4a");
const output = join(dir, "timeline.mp4");

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(undefined) : reject(new Error(stderr || `ffmpeg exited ${code}`))));
  });
}

function probe(file) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name:format=duration", "-of", "json", file], { windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error("ffprobe failed"))));
  });
}

await ffmpeg(["-f", "lavfi", "-i", "testsrc=size=320x180:rate=15:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", picture]);
await ffmpeg(["-f", "lavfi", "-i", "sine=frequency=880:duration=2", "-c:a", "aac", music]);

const plan = buildExportPlan(
  [
    {
      id: "video-1",
      projectId: "p1",
      track: "video",
      mediaId: "picture",
      takeId: "",
      sceneId: "",
      shotId: "",
      characterId: "",
      name: "Picture",
      startMs: 0,
      inMs: 200,
      outMs: 1700,
      volume: 1,
      fadeInMs: 0,
      fadeOutMs: 0,
    },
    {
      id: "music-1",
      projectId: "p1",
      track: "music",
      mediaId: "music",
      takeId: "",
      sceneId: "",
      shotId: "",
      characterId: "",
      name: "Music",
      startMs: 0,
      inMs: 0,
      outMs: 1700,
      volume: 0.4,
      fadeInMs: 100,
      fadeOutMs: 100,
    },
  ],
  [
    { id: "video", muted: false, solo: false, volume: 1 },
    { id: "motion", muted: false, solo: false, volume: 1 },
    { id: "dialogue", muted: false, solo: false, volume: 1 },
    { id: "voice", muted: false, solo: false, volume: 1 },
    { id: "music", muted: false, solo: false, volume: 0.8 },
    { id: "sfx", muted: false, solo: false, volume: 1 },
    { id: "captions", muted: false, solo: false, volume: 1 },
  ],
  [
    { mediaId: "picture", path: picture, hasVideo: true, hasAudio: true },
    { mediaId: "music", path: music, hasVideo: false, hasAudio: true },
  ],
  output,
);

if (plan.error) throw new Error(plan.error);
await new Promise((resolve, reject) => {
  const child = spawn("ffmpeg", plan.args, { windowsHide: true });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.on("error", reject);
  child.on("close", (code) => (code === 0 ? resolve(undefined) : reject(new Error(stderr || `export exited ${code}`))));
});

const inspected = await probe(output);
const bytes = readFileSync(output).length;
const video = inspected.streams.find((stream) => stream.codec_type === "video");
const audio = inspected.streams.find((stream) => stream.codec_type === "audio");
const result = {
  bytes,
  duration: Number(inspected.format.duration),
  video: video?.codec_name,
  audio: audio?.codec_name,
  output,
};
writeFileSync(join(dir, "result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (result.video !== "h264" || result.audio !== "aac" || result.duration < 1.2 || result.duration > 2.2) {
  process.exitCode = 1;
}
