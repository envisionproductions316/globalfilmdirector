import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = mkdtempSync(join(tmpdir(), "gfd-phase2-"));
const port = 9346;
const browser = spawn(chrome, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--headless=new",
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
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

  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await open("http://127.0.0.1:5180/capture");
  results.devices = await evaluate(`(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return { missing: true };
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const rec = new MediaRecorder(stream);
    const sizes = [];
    rec.ondataavailable = (event) => sizes.push(event.data.size);
    const stopped = new Promise((resolve) => { rec.onstop = () => resolve(sizes.reduce((sum, size) => sum + size, 0)); });
    rec.start(200);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    rec.stop();
    const bytes = await stopped;
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true, mime: rec.mimeType, bytes };
  })()`);
  results.before = await evaluate(`(() => document.body.innerText.includes("Select character"))()`);
  await evaluate(`(() => { [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Start camera")?.click(); return true; })()`);
  await sleep(800);
  results.camera = await evaluate(`(() => document.body.innerText)()`);
  await evaluate(`(() => { [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Record")?.click(); return true; })()`);
  await sleep(1200);
  await evaluate(`(() => { [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Stop")?.click(); return true; })()`);
  await sleep(700);
  results.afterStop = await evaluate(`(() => {
    const text = document.body.innerText;
    const start = text.indexOf("Your Camera Performance");
    return text.slice(start, start + 500);
  })()`);
  await evaluate(`(() => { [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Save take")?.click(); return true; })()`);
  await sleep(900);
  results.savedText = await evaluate(`(() => document.body.innerText.includes("Raw recording saved") || document.body.innerText.includes("Saved for"))()`);
  results.stored = await evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem("gfd.studio.v1") || "{}");
    return { takes: (raw.takes || []).length, schema: raw.schemaVersion, character: raw.takes?.[0]?.characterId, scene: raw.takes?.[0]?.sceneId, tracking: raw.takes?.[0]?.tracking, retarget: raw.takes?.[0]?.retarget };
  })()`);
  results.media = await evaluate(`(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("gfd-media");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise((resolve, reject) => {
      const request = db.transaction("recordings").objectStore("recordings").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return { count: records.length, bytes: records[0]?.bytes || 0, type: records[0]?.blob?.type || "" };
  })()`);

  await open("http://127.0.0.1:5180/characters");
  await evaluate(`(() => { [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Max")?.click(); return true; })()`);
  await sleep(400);
  results.history = await evaluate(`(() => document.body.innerText.includes("Performance history") && document.body.innerText.includes("Max take"))()`);
  await open("http://127.0.0.1:5180/characters");
  await evaluate(`(() => { [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Max")?.click(); return true; })()`);
  await sleep(500);
  results.restored = await evaluate(`(() => document.body.innerText.includes("Max take"))()`);

  await open("http://127.0.0.1:5180/storyboard");
  await evaluate(`(() => { [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Sequence")?.click(); return true; })()`);
  await sleep(300);
  const beforeOrder = await evaluate(`(() => [...document.querySelectorAll("span")].map((node) => node.textContent.trim()).filter((text) => text.startsWith("0")))()`);
  await evaluate(`(() => { [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Later")?.click(); return true; })()`);
  await sleep(300);
  await open("http://127.0.0.1:5180/storyboard");
  await evaluate(`(() => { [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Sequence")?.click(); return true; })()`);
  await sleep(300);
  const afterOrder = await evaluate(`(() => [...document.querySelectorAll("span")].map((node) => node.textContent.trim()).filter((text) => /^0\\d/.test(text)))()`);
  results.order = { beforeOrder, afterOrder, moved: JSON.stringify(beforeOrder) !== JSON.stringify(afterOrder) };

  await evaluate(`(() => { [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Continuity")?.click(); return true; })()`);
  await sleep(200);
  results.continuity = await evaluate(`(() => document.body.innerText.includes("No continuity warnings") || document.body.innerText.includes("recording file is missing"))()`);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await open("http://127.0.0.1:5180/capture");
  results.mobile = await evaluate(`(() => ({
    heading: getComputedStyle([...document.querySelectorAll("h1")].find((node) => node.textContent.includes("Mobile Camera"))).display,
    record: [...document.querySelectorAll("button")].some((button) => button.textContent.includes("Record")),
    bottom: document.body.innerText.includes("Home"),
  }))()`);
  await evaluate(`(() => { [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Night") || button.textContent.includes("Day"))?.click(); return true; })()`);
  await sleep(200);
  results.theme = await evaluate(`(() => getComputedStyle(document.body).backgroundColor)()`);
  console.log(JSON.stringify(results, null, 2));
  ws.close();
} finally {
  browser.kill();
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Chrome can keep the temporary profile locked after exit.
  }
}
