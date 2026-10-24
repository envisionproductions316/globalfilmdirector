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
    const ffmpeg = process.env.GFD_FFMPEG_PATH;
    let ffprobe = process.env.GFD_FFPROBE_PATH || "";
    if (!ffprobe && ffmpeg) {
      const sibling = path.join(path.dirname(ffmpeg), `ffprobe${exe}`);
      if (existsSync(sibling)) ffprobe = sibling;
    }
    candidates.push({ ffmpeg, ffprobe });
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

  candidates.push({ ffmpeg: "ffmpeg", ffprobe: "ffprobe" });

  for (const entry of candidates) {
    if (!entry.ffmpeg) continue;
    const isPathName = entry.ffmpeg === "ffmpeg" || entry.ffmpeg === "ffprobe";
    if (isPathName || existsSync(entry.ffmpeg)) {
      let ffprobe = entry.ffprobe;
      if (!ffprobe && !isPathName) {
        const sibling = path.join(path.dirname(entry.ffmpeg), `ffprobe${exe}`);
        if (existsSync(sibling)) ffprobe = sibling;
      }
      if (!ffprobe && isPathName) ffprobe = "ffprobe";
      return { ffmpeg: entry.ffmpeg, ffprobe };
    }
  }

  return { ffmpeg: "", ffprobe: "" };
}
