import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildExportPlan, type ExportSource } from "@/lib/export-plan";
import { completeClip, completeMix, type TimelineClip, type TrackMix } from "@/lib/timeline";

export type ExportManifest = {
  title: string;
  clips: TimelineClip[];
  mix: TrackMix[];
};

export type ExportStatus = {
  id: string;
  status: "running" | "done" | "error" | "cancelled";
  progress: number;
  error: string;
  notes: string[];
  durationMs: number;
  bytes: number;
  videoCodec: string;
  audioCodec: string;
  probedDuration: number;
};

type ExportJob = ExportStatus & {
  outputPath: string;
  directory: string;
  process: ChildProcess | null;
};

const jobs = new Map<string, ExportJob>();
let ffmpegPath = "";
let probeAt = 0;
let probeResult: { available: boolean; version: string; h264: boolean; aac: boolean; error: string } | null = null;

const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const MAX_CLIPS = 40;
const MAX_DURATION_MS = 30 * 60 * 1000;

function run(command: string, args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = (stdout + chunk.toString()).slice(-12000);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    child.on("error", (error) => resolve({ code: 1, stdout, stderr: error.message }));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

export async function probeFfmpeg() {
  if (probeResult && Date.now() - probeAt < 30_000) return probeResult;
  const listed = await run("ffmpeg", ["-hide_banner", "-version"]);
  const versionLine = `${listed.stdout}\n${listed.stderr}`.split(/\r?\n/).find((line) => line.startsWith("ffmpeg version")) ?? "";
  const available = listed.code === 0 && versionLine.startsWith("ffmpeg version");
  const codecs = available ? await run("ffmpeg", ["-hide_banner", "-encoders"]) : { code: 1, stdout: "", stderr: "" };
  const encoderText = `${codecs.stdout}\n${codecs.stderr}`;
  probeResult = {
    available,
    version: versionLine.replace("ffmpeg version ", "").split(" ")[0] || "",
    h264: encoderText.includes("libx264"),
    aac: encoderText.includes("aac"),
    error: available ? "" : "FFmpeg is not available on this computer. Nothing was exported.",
  };
  ffmpegPath = available ? "ffmpeg" : "";
  probeAt = Date.now();
  return probeResult;
}

async function probeStreams(filePath: string) {
  const output = await readProbe(filePath);
  return { hasVideo: Boolean(output.videoCodec), hasAudio: Boolean(output.audioCodec), ...output };
}

function readProbe(filePath: string) {
  return new Promise<{ videoCodec: string; audioCodec: string; duration: number }>((resolve) => {
    const child = spawn("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name:format=duration", "-of", "json", filePath], { windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.on("close", () => {
      try {
        const parsed = JSON.parse(stdout) as { streams?: { codec_type?: string; codec_name?: string }[]; format?: { duration?: string } };
        const video = parsed.streams?.find((stream) => stream.codec_type === "video");
        const audio = parsed.streams?.find((stream) => stream.codec_type === "audio");
        resolve({
          videoCodec: video?.codec_name || "",
          audioCodec: audio?.codec_name || "",
          duration: Number(parsed.format?.duration || 0),
        });
      } catch {
        resolve({ videoCodec: "", audioCodec: "", duration: 0 });
      }
    });
    child.on("error", () => resolve({ videoCodec: "", audioCodec: "", duration: 0 }));
  });
}

function publicStatus(job: ExportJob): ExportStatus {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
    notes: job.notes,
    durationMs: job.durationMs,
    bytes: job.bytes,
    videoCodec: job.videoCodec,
    audioCodec: job.audioCodec,
    probedDuration: job.probedDuration,
  };
}

export function exportStatus(id: string) {
  const job = jobs.get(id);
  return job ? publicStatus(job) : null;
}

export async function exportFile(id: string) {
  const job = jobs.get(id);
  if (!job || job.status !== "done") return null;
  const bytes = await readFile(job.outputPath);
  const safe = job.id.replace(/[^a-zA-Z0-9-]/g, "");
  return { bytes, name: `timeline-${safe}.mp4` };
}

export function cancelExport(id: string) {
  const job = jobs.get(id);
  if (!job || job.status !== "running") return exportStatus(id);
  job.status = "cancelled";
  job.error = "Export cancelled. No file was delivered.";
  job.process?.kill();
  return publicStatus(job);
}

function safeId(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80);
  return cleaned || "media";
}

export async function startExport(manifest: ExportManifest, files: { mediaId: string; bytes: Buffer }[]) {
  const ffmpeg = await probeFfmpeg();
  if (!ffmpeg.available || !ffmpeg.h264 || !ffmpeg.aac) {
    return { error: ffmpeg.error || "This FFmpeg build cannot encode H.264 and AAC. Nothing was exported.", status: 503 as const };
  }
  const clips = manifest.clips.map((clip) => completeClip(clip, "export")).filter((clip): clip is TimelineClip => Boolean(clip)).slice(0, MAX_CLIPS);
  const mix = completeMix(manifest.mix);
  if (clips.length === 0) return { error: "There are no timeline clips to export.", status: 400 as const };
  const durationMs = clips.reduce((max, clip) => Math.max(max, clip.startMs + Math.max(0, clip.outMs - clip.inMs)), 0);
  if (durationMs > MAX_DURATION_MS) return { error: "This timeline is longer than 30 minutes. Nothing was exported.", status: 400 as const };
  const total = files.reduce((sum, file) => sum + file.bytes.length, 0);
  if (files.some((file) => file.bytes.length > MAX_FILE_BYTES) || total > MAX_TOTAL_BYTES) {
    return { error: "The media is too large for this local export. Nothing was exported.", status: 400 as const };
  }

  const id = crypto.randomUUID();
  const directory = path.join(tmpdir(), `gfd-export-${id}`);
  await mkdir(directory, { recursive: true });
  const sources: ExportSource[] = [];
  for (const file of files) {
    const filePath = path.join(directory, `${safeId(file.mediaId)}.bin`);
    await writeFile(filePath, file.bytes);
    const probed = await probeStreams(filePath);
    sources.push({ mediaId: file.mediaId, path: filePath, hasVideo: probed.hasVideo, hasAudio: probed.hasAudio });
  }
  const outputPath = path.join(directory, "timeline.mp4");
  const plan = buildExportPlan(clips, mix, sources, outputPath);
  if (plan.error) {
    await rm(directory, { recursive: true, force: true });
    return { error: plan.error, notes: plan.notes, status: 400 as const };
  }

  const job: ExportJob = {
    id,
    status: "running",
    progress: 0,
    error: "",
    notes: plan.notes,
    durationMs: plan.durationMs,
    bytes: 0,
    videoCodec: "",
    audioCodec: "",
    probedDuration: 0,
    outputPath,
    directory,
    process: null,
  };
  jobs.set(id, job);

  const child = spawn(ffmpegPath || "ffmpeg", ["-progress", "pipe:1", "-nostats", ...plan.args], { windowsHide: true });
  job.process = child;
  let stderr = "";
  let progressText = "";
  child.stdout.on("data", (chunk: Buffer) => {
    progressText += chunk.toString();
    const marks = [...progressText.matchAll(/out_time_ms=(\d+)/g)];
    const raw = marks.length ? Number(marks[marks.length - 1][1]) : 0;
    const elapsed = raw > plan.durationMs * 10 ? raw / 1000 : raw;
    if (plan.durationMs > 0) job.progress = Math.max(0, Math.min(0.99, elapsed / plan.durationMs));
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });
  child.on("error", (error) => {
    job.status = "error";
    job.error = error.message || "FFmpeg could not be started. Nothing was exported.";
  });
  child.on("close", (code) => {
    void finishJob(job, code, stderr);
  });
  return { id, status: 202 as const };
}

async function finishJob(job: ExportJob, code: number | null, stderr: string) {
  if (job.status === "cancelled") {
    await rm(job.directory, { recursive: true, force: true }).catch(() => undefined);
    return;
  }
  if (code !== 0) {
    job.status = "error";
    job.error = stderr.trim() || "FFmpeg did not finish the export. No file was delivered.";
    return;
  }
  try {
    const info = await stat(job.outputPath);
    const probed = await readProbe(job.outputPath);
    if (info.size < 32 || !probed.videoCodec) {
      job.status = "error";
      job.error = "FFmpeg finished without a playable video file.";
      return;
    }
    job.bytes = info.size;
    job.videoCodec = probed.videoCodec;
    job.audioCodec = probed.audioCodec;
    job.probedDuration = probed.duration;
    job.progress = 1;
    job.status = "done";
  } catch {
    job.status = "error";
    job.error = "The export file could not be read. Nothing was delivered.";
  }
}
