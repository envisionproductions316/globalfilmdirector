import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const fails = [];

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => resolve({ code: 1, stdout, stderr: error.message }));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) fails.push(`Node ${process.versions.node} is too old. Use Node 20 or newer.`);

if (!existsSync(path.join(root, "node_modules", "next"))) {
  fails.push("Dependencies are missing. Run: npm install");
}

const built =
  existsSync(path.join(root, ".next", "BUILD_ID")) ||
  existsSync(path.join(root, ".next", "standalone", "server.js"));
if (!built) fails.push("Production build is missing. Run: npm run build");

const ffmpeg = await run("ffmpeg", ["-hide_banner", "-version"]);
const ffprobe = await run("ffprobe", ["-hide_banner", "-version"]);
const ffmpegOk = ffmpeg.code === 0 && `${ffmpeg.stdout}\n${ffmpeg.stderr}`.includes("ffmpeg version");
const probeOk = ffprobe.code === 0 && `${ffprobe.stdout}\n${ffprobe.stderr}`.includes("ffprobe");
const versionLine = `${ffmpeg.stdout}\n${ffmpeg.stderr}`.split(/\r?\n/).find((line) => line.startsWith("ffmpeg version")) || "";

const host = process.env.HOST || process.env.HOSTNAME || "127.0.0.1";
const port = process.env.PORT || "5180";

const report = {
  ok: fails.length === 0 && ffmpegOk && probeOk,
  node: process.versions.node,
  buildPresent: built,
  ffmpeg: ffmpegOk ? versionLine.replace("ffmpeg version ", "").split(" ")[0] : "",
  ffprobe: probeOk,
  url: `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`,
  fails: [
    ...fails,
    ...(!ffmpegOk ? ["FFmpeg is not on PATH. Install FFmpeg before exporting MP4s."] : []),
    ...(!probeOk ? ["ffprobe is not on PATH. Install a full FFmpeg build."] : []),
  ],
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  console.error("\nStudio is not ready for production usage yet. Fix the fails list above.");
  process.exit(1);
}
console.error("\nReady. Build present, Node OK, FFmpeg OK.");
console.error(`Start with: npm start`);
console.error(`Open: ${report.url}`);
