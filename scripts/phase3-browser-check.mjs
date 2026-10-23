import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = mkdtempSync(join(tmpdir(), "gfd-phase3-browser-"));
const mediaDir = mkdtempSync(join(tmpdir(), "gfd-phase3-browser-media-"));
const port = 9347;
const clipA = join(mediaDir, "clip-a.mp4");
const clipB = join(mediaDir, "clip-b.mp4");
const music = join(mediaDir, "theme.m4a");

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

await ffmpeg(["-f", "lavfi", "-i", "testsrc=size=320x180:rate=15:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", clipA]);
await ffmpeg(["-f", "lavfi", "-i", "testsrc=size=320x180:rate=15:duration=2", "-f", "lavfi", "-i", "sine=frequency=660:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", clipB]);
await ffmpeg(["-f", "lavfi", "-i", "sine=frequency=880:duration=2", "-c:a", "aac", music]);

const browser = spawn(chrome, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--headless=new",
  "--autoplay-policy=no-user-gesture-required",
  "--window-size=1440,900",
  "about:blank",
], { stdio: "ignore" });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function debuggerSocket() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = list.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      await sleep(200);
    }
  }
  throw new Error("Chrome debugging port did not open.");
}

const results = {};

try {
  const ws = new WebSocket(await debuggerSocket());
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const waits = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === "Page.loadEventFired") {
      const resolve = waits.get("load");
      if (resolve) {
        waits.delete("load");
        resolve();
      }
    }
  });
  function send(method, params = {}) {
    const id = ++nextId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => pending.set(id, resolve));
  }
  async function evaluate(expression) {
    const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.result?.exceptionDetails) throw new Error(JSON.stringify(response.result.exceptionDetails));
    return response.result?.result?.value;
  }
  async function open(url) {
    const loaded = new Promise((resolve) => waits.set("load", resolve));
    await send("Page.enable");
    await send("Page.navigate", { url });
    await loaded;
    await sleep(900);
  }
  async function chooseFile(selector, file) {
    const document = await send("DOM.getDocument", { depth: 1 });
    const found = await send("DOM.querySelector", { nodeId: document.result.root.nodeId, selector });
    if (!found.result.nodeId) throw new Error(`Missing ${selector}`);
    await send("DOM.setFileInputFiles", { nodeId: found.result.nodeId, files: [file] });
    await sleep(1200);
  }

  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await open("http://127.0.0.1:5180/edit");
  results.heading = await evaluate(`(() => document.querySelector("h1")?.textContent)()`);
  await chooseFile("[data-testid=import-media]", clipA);
  await chooseFile("[data-testid=import-media]", clipB);
  results.afterImport = await evaluate(`(() => document.querySelector("[data-testid=timeline-order]")?.textContent)()`);
  await evaluate(`(() => { document.querySelector("[data-track=video] [data-testid^=clip-]")?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 })); return true; })()`);
  await sleep(200);
  await evaluate(`(() => { document.querySelector("[data-testid=nudge-later]")?.click(); return true; })()`);
  await sleep(300);
  results.afterReorder = await evaluate(`(() => document.querySelector("[data-testid=timeline-order]")?.textContent)()`);
  await evaluate(`(() => {
    const input = document.querySelector("[data-testid=trim-out]");
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const tracker = input._valueTracker;
    if (tracker) tracker.setValue("0");
    // Out point is edited in seconds (1.00s → 1000ms source out).
    setter.call(input, "1");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  await sleep(400);
  results.trim = await evaluate(`(() => ({
    value: document.querySelector("[data-testid=trim-out]")?.value,
    order: document.querySelector("[data-testid=timeline-order]")?.textContent,
    duration: document.querySelector("[data-testid=playhead]")?.textContent,
  }))()`);
  const beforePlay = await evaluate(`(() => document.querySelector("[data-testid=playhead]")?.dataset.playheadMs)()`);
  await evaluate(`(() => { document.querySelector("[data-testid=play-sequence]")?.click(); return true; })()`);
  await sleep(900);
  const duringPlay = await evaluate(`(() => document.querySelector("[data-testid=playhead]")?.dataset.playheadMs)()`);
  results.playback = { beforePlay, duringPlay, moved: Number(duringPlay) > Number(beforePlay) };

  await open("http://127.0.0.1:5180/edit");
  results.restored = await evaluate(`(() => document.querySelector("[data-testid=timeline-order]")?.textContent)()`);

  await open("http://127.0.0.1:5180/audio");
  await chooseFile("[data-testid=import-audio]", music);
  results.music = await evaluate(`(() => document.body.innerText.includes("theme.m4a"))()`);
  await evaluate(`(() => {
    const input = document.querySelector("[data-testid=track-volume-music]");
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const tracker = input._valueTracker;
    if (tracker) tracker.setValue("1");
    setter.call(input, "0.4");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  await sleep(300);
  results.volume = await evaluate(`(() => document.querySelector("[data-testid=track-volume-music]")?.value)()`);

  await open("http://127.0.0.1:5180/export");
  await evaluate(`(() => { document.querySelector("[data-testid=export-timeline]")?.click(); return true; })()`);
  let exportStatus = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(1000);
    exportStatus = await evaluate(`(() => document.querySelector("[data-testid=export-status]")?.textContent || "")()`);
    if (exportStatus.includes("Export complete") || exportStatus.includes("Nothing was exported") || exportStatus.includes("did not")) break;
  }
  results.exportStatus = exportStatus;
  await evaluate(`(() => { [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Night") || button.textContent.includes("Day"))?.click(); return true; })()`);
  await sleep(300);
  results.theme = await evaluate(`(() => getComputedStyle(document.body).backgroundColor)()`);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await open("http://127.0.0.1:5180/edit");
  results.mobile = await evaluate(`(() => getComputedStyle(document.querySelector("[data-testid=mobile-clips]")).display)()`);
  console.log(JSON.stringify(results, null, 2));
  ws.close();
} finally {
  browser.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* profile lock */ }
}
