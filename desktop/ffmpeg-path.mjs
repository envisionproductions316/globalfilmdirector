import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolve FFmpeg / ffprobe for desktop packaging.
 * Order: env → resources/ffmpeg → project resources/ffmpeg → PATH names.
 */
export function resolveFfmpegBinaries({ resourcesPath = "", projectRoot = "" } = {}) {
  const exe = process.platform === "win32" ? ".exe" : "";
  const candidates = [];

  if (process.env.GFD_FFMPEG_PATH) {
    candidates.push({ ffmpeg: process.env.GFD_FFMPEG_PATH, ffprobe: process.env.GFD_FFPROBE_PATH || "" });
  }

  const dirs = [
    resourcesPath ? path.join(resourcesPath, "ffmpeg") : "",
    projectRoot ? path.join(projectRoot, "resources", "ffmpeg") : "",
    projectRoot ? path.join(projectRoot, "desktop", "resources", "ffmpeg") : "",
  ].filter(Boolean);

  for (const dir of dirs) {
    const ffmpeg = path.join(dir, `ffmpeg${exe}`);
    const ffprobe = path.join(dir, `ffprobe${exe}`);
    if (existsSync(ffmpeg)) {
      candidates.push({
        ffmpeg,
        ffprobe: existsSync(ffprobe) ? ffprobe : "",
      });
    }
  }

  // Fallback: rely on PATH (dev machines with winget FFmpeg).
  candidates.push({ ffmpeg: `ffmpeg${exe === ".exe" ? ".exe" : "ffmpeg"}`.replace("ffmpeg.exe.exe", "ffmpeg.exe"), ffprobe: `ffprobe${exe}` });
  // Normalize PATH fallback names
  candidates[candidates.length - 1] = { ffmpeg: "ffmpeg", ffprobe: "ffprobe" };

  for (const entry of candidates) {
    if (!entry.ffmpeg) continue;
    // Env / resource paths must exist; PATH names are accepted as-is.
    if (entry.ffmpeg === "ffmpeg" || entry.ffmpeg === "ffprobe" || existsSync(entry.ffmpeg)) {
      return {
        ffmpeg: entry.ffmpeg,
        ffprobe: entry.ffprobe || (entry.ffmpeg === "ffmpeg" ? "ffprobe" : ""),
      };
    }
  }

  return { ffmpeg: "", ffprobe: "" };
}
