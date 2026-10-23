export type CaptionCue = { startMs: number; endMs: number; text: string };

function stampToMs(value: string) {
  const cleaned = value.trim().replace(",", ".");
  const parts = cleaned.split(":");
  if (parts.length < 2) return null;
  const secondsPart = parts.pop() ?? "";
  const [seconds, fraction = "0"] = secondsPart.split(".");
  const minutes = Number(parts.pop());
  const hours = parts.length > 0 ? Number(parts.pop()) : 0;
  if (![hours, minutes, Number(seconds)].every((part) => Number.isFinite(part))) return null;
  return ((hours * 60 + minutes) * 60 + Number(seconds)) * 1000 + Number(fraction.padEnd(3, "0").slice(0, 3));
}

function msToStamp(ms: number) {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function parseCaptions(source: string): CaptionCue[] {
  const blocks = source.replace(/^\uFEFF/, "").replace(/\r/g, "").split(/\n{2,}/);
  const cues: CaptionCue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter((line) => line && line !== "WEBVTT" && !line.startsWith("NOTE") && !line.startsWith("STYLE") && !/^\d+$/.test(line));
    const timing = lines.find((line) => line.includes("-->"));
    if (!timing) continue;
    const [rawStart, rawEnd] = timing.split("-->");
    const startMs = stampToMs((rawStart ?? "").trim().split(/\s+/)[0] ?? "");
    const endMs = stampToMs((rawEnd ?? "").trim().split(/\s+/)[0] ?? "");
    const text = lines.filter((line) => line !== timing).join("\n").trim();
    if (startMs === null || endMs === null || endMs - startMs < 40 || !text) continue;
    cues.push({ startMs, endMs, text });
  }
  return cues;
}

export function cuesToSrt(cues: { startMs: number; endMs: number; text: string }[]) {
  return cues.map((cue, index) => `${index + 1}\n${msToStamp(cue.startMs)} --> ${msToStamp(cue.endMs)}\n${cue.text}\n`).join("\n");
}
