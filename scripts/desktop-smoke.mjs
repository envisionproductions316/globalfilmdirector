/**
 * Headless checks for desktop modules (does not open a GUI window).
 * Packaged GUI login remains a manual / Phase 5D operator step.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveFfmpegBinaries } from "../desktop/ffmpeg-path.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bins = resolveFfmpegBinaries({ projectRoot: root });
assert.ok(bins.ffmpeg, "FFmpeg binary name/path should resolve");
assert.ok(existsSync(path.join(root, "desktop", "main.mjs")), "desktop/main.mjs missing");
assert.ok(existsSync(path.join(root, "desktop", "preload.cjs")), "desktop/preload.cjs missing");
assert.ok(existsSync(path.join(root, "desktop", "auth.mjs")), "desktop/auth.mjs missing");
assert.ok(existsSync(path.join(root, "desktop", "verify-id-token.mjs")), "desktop/verify-id-token.mjs missing");

const standalone = existsSync(path.join(root, ".next", "standalone", "server.js"));
const unpackedDir = path.join(root, "release", "win-unpacked");
const unpacked = existsSync(unpackedDir);
let packagedExe = null;
if (unpacked) {
  const exe = readdirSync(unpackedDir).find((name) => name.toLowerCase().endsWith(".exe"));
  packagedExe = exe ? path.join(unpackedDir, exe) : null;
}

const authSource = await import("node:fs/promises").then((fs) => fs.readFile(path.join(root, "desktop", "auth.mjs"), "utf8"));
assert.match(authSource, /safeStorage/, "desktop auth must use safeStorage");
assert.match(authSource, /oauth\/revoke|revokeRefreshToken/, "desktop auth must attempt refresh revoke");
assert.match(authSource, /127\.0\.0\.1|loopback|callback/, "desktop auth must use loopback callback");

console.log(
  JSON.stringify({
    ok: true,
    ffmpeg: bins.ffmpeg,
    ffprobe: bins.ffprobe,
    standalone,
    packagedWinUnpacked: unpacked,
    packagedExe: packagedExe ? path.basename(packagedExe) : null,
    note: "GUI system-browser login not launched by this smoke script.",
  }),
);
