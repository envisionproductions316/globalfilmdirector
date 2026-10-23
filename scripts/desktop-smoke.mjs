/**
 * Headless checks for desktop modules (does not open a GUI window).
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveFfmpegBinaries } from "../desktop/ffmpeg-path.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bins = resolveFfmpegBinaries({ projectRoot: root });
assert.ok(bins.ffmpeg, "FFmpeg binary name/path should resolve");
assert.ok(existsSync(path.join(root, "desktop", "main.mjs")), "desktop/main.mjs missing");
assert.ok(existsSync(path.join(root, "desktop", "preload.cjs")), "desktop/preload.cjs missing");
assert.ok(existsSync(path.join(root, ".next", "standalone", "server.js")), "Run npm run build before desktop smoke");

console.log(
  JSON.stringify({
    ok: true,
    ffmpeg: bins.ffmpeg,
    ffprobe: bins.ffprobe,
    standalone: true,
  }),
);
