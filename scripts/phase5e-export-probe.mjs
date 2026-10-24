/**
 * Phase 5E — prove local FFmpeg export produces a playable MP4 (not UI-only).
 * Requires Next dev/prod on GFD_ORIGIN (default http://127.0.0.1:5180).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = process.env.GFD_ORIGIN || "http://127.0.0.1:5180";
const sample = path.join(root, "docs", "phase5e-screenshots", "phase5e-sample.mp4");
const outDir = path.join(root, "docs", "phase5e-screenshots");

const probe = await fetch(`${origin}/api/export`);
const probeBody = await probe.json();
if (!probe.ok || !probeBody.available || !probeBody.h264 || !probeBody.aac) {
  console.error(JSON.stringify({ ok: false, step: "probe", probeBody }));
  process.exit(1);
}

const mediaId = "phase5e-sample";
const bytes = await readFile(sample);
const clips = [
  {
    id: "clip-v1",
    projectId: "phase5e",
    track: "video",
    mediaId,
    name: "Phase5E sample",
    startMs: 0,
    inMs: 0,
    outMs: 1000,
    groupId: "g1",
  },
  {
    id: "clip-a1",
    projectId: "phase5e",
    track: "dialogue",
    mediaId,
    name: "Phase5E sample audio",
    startMs: 0,
    inMs: 0,
    outMs: 1000,
    groupId: "g1",
  },
];

const form = new FormData();
const mix = [
  { id: "video", muted: false, solo: false, volume: 1 },
  { id: "motion", muted: false, solo: false, volume: 1 },
  { id: "dialogue", muted: false, solo: false, volume: 1 },
  { id: "voice", muted: false, solo: false, volume: 1 },
  { id: "music", muted: false, solo: false, volume: 1 },
  { id: "sfx", muted: false, solo: false, volume: 1 },
  { id: "captions", muted: false, solo: false, volume: 1 },
];
form.set("manifest", JSON.stringify({ title: "Phase5E export probe", clips, mix }));
form.append("file", new Blob([bytes], { type: "video/mp4" }), mediaId);

const started = await fetch(`${origin}/api/export`, { method: "POST", body: form });
const startBody = await started.json();
if (!started.ok || !startBody.id) {
  console.error(JSON.stringify({ ok: false, step: "start", status: started.status, startBody }));
  process.exit(1);
}

let final = null;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const statusRes = await fetch(`${origin}/api/export?id=${encodeURIComponent(startBody.id)}`);
  final = await statusRes.json();
  if (final.status === "done" || final.status === "error" || final.status === "cancelled") break;
}

if (!final || final.status !== "done") {
  console.error(JSON.stringify({ ok: false, step: "poll", final }));
  process.exit(1);
}

let fileRes = null;
for (let i = 0; i < 10; i++) {
  fileRes = await fetch(`${origin}/api/export?id=${encodeURIComponent(startBody.id)}&file=1`);
  if (fileRes.ok) break;
  await new Promise((r) => setTimeout(r, 300));
}
if (!fileRes?.ok) {
  console.error(JSON.stringify({ ok: false, step: "download", status: fileRes?.status, final }));
  process.exit(1);
}
const outBytes = Buffer.from(await fileRes.arrayBuffer());
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, "phase5e-export-output.mp4");
await writeFile(outPath, outBytes);

console.log(
  JSON.stringify({
    ok: true,
    ffmpeg: probeBody.version,
    jobId: startBody.id,
    bytes: outBytes.length,
    videoCodec: final.videoCodec,
    audioCodec: final.audioCodec,
    probedDuration: final.probedDuration,
    outPath,
  }),
);
