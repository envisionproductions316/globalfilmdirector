"use client";

import { useEffect, useState } from "react";
import { getMedia } from "@/lib/media-db";
import { useStudio } from "@/lib/studio";
import { formatTimecode } from "@/lib/timeline";

export function ExportControl() {
  const studio = useStudio();
  const [ffmpeg, setFfmpeg] = useState("Checking the local FFmpeg encoder…");
  const [status, setStatus] = useState("No export is running.");
  const [jobId, setJobId] = useState("");
  const [download, setDownload] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/export")
      .then((response) => response.json())
      .then((body: { available?: boolean; version?: string; h264?: boolean; aac?: boolean; error?: string }) => {
        if (cancelled) return;
        if (body.available && body.h264 && body.aac) setFfmpeg(`Local FFmpeg ${body.version} can encode H.264 and AAC. Blender, ComfyUI, APG, GCIE, and Envision Cloud are not connected.`);
        else setFfmpeg(body.error || "FFmpeg cannot encode this timeline on this computer.");
      })
      .catch(() => {
        if (!cancelled) setFfmpeg("The local encoder could not be checked. Nothing was exported.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    if (download) URL.revokeObjectURL(download);
  }, [download]);

  async function start() {
    if (busy) return;
    if (studio.clips.length === 0) {
      setStatus("The timeline has no clips. Nothing was exported.");
      return;
    }
    setBusy(true);
    setStatus("Preparing media…");
    if (download) URL.revokeObjectURL(download);
    setDownload("");
    try {
      const form = new FormData();
      form.set("manifest", JSON.stringify({ title: studio.activeProject.title, clips: studio.clips, mix: studio.mix }));
      const ids = [...new Set(studio.clips.map((clip) => clip.mediaId))];
      for (const id of ids) {
        const record = await getMedia(id);
        if (!record) {
          setStatus(`“${id}” is missing from this device. Nothing was exported.`);
          setBusy(false);
          return;
        }
        form.append("file", new File([record.blob], id, { type: record.mime || "application/octet-stream" }));
      }
      const started = await fetch("/api/export", { method: "POST", body: form });
      const body = (await started.json()) as { id?: string; error?: string };
      if (!started.ok || !body.id) {
        setStatus(body.error || "Export did not start. No file was delivered.");
        setBusy(false);
        return;
      }
      setJobId(body.id);
      setStatus("Encoding MP4…");
      const result = await poll(body.id);
      if (result.status !== "done") {
        setStatus(result.error || "Export did not finish. No file was delivered.");
        setBusy(false);
        return;
      }
      const file = await fetch(`/api/export?id=${encodeURIComponent(body.id)}&file=1`);
      if (!file.ok) {
        setStatus("The encoder finished, but the file could not be downloaded.");
        setBusy(false);
        return;
      }
      const blob = await file.blob();
      const url = URL.createObjectURL(blob);
      setDownload(url);
      const seconds = result.probedDuration.toFixed(2);
      setStatus(`Export complete. ${result.videoCodec} / ${result.audioCodec || "no audio"}, ${seconds}s, ${result.bytes} bytes. This is the timeline encode, not an animated render.`);
      studio.recordExport(`Timeline MP4 ${seconds}s`);
    } catch {
      setStatus("Export stopped before a file was written.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!jobId) return;
    await fetch(`/api/export?id=${encodeURIComponent(jobId)}`, { method: "DELETE" });
    setStatus("Export cancelled. No file was delivered.");
    setBusy(false);
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-muted" data-testid="ffmpeg-status">{ffmpeg}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent" data-testid="export-timeline" onClick={() => void start()} disabled={busy}>
          {busy ? "Exporting…" : "Export MP4"}
        </button>
        {busy ? (
          <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" onClick={() => void cancel()}>
            Cancel export
          </button>
        ) : null}
        {download ? (
          <a className="inline-flex h-9 items-center rounded-[7px] bg-inset px-3 text-sm" href={download} download={`${studio.activeProject.title || "timeline"}.mp4`}>
            Download MP4
          </a>
        ) : null}
      </div>
      <p className="mt-3 text-sm" data-testid="export-status">{status}</p>
    </div>
  );
}

async function poll(id: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const response = await fetch(`/api/export?id=${encodeURIComponent(id)}`);
    const body = (await response.json()) as { status: "running" | "done" | "error" | "cancelled"; error: string; probedDuration: number; videoCodec: string; audioCodec: string; bytes: number; progress: number };
    if (body.status === "running") continue;
    return body;
  }
  return { status: "error" as const, error: "Export took too long and was left unfinished.", probedDuration: 0, videoCodec: "", audioCodec: "", bytes: 0, progress: 0 };
}
