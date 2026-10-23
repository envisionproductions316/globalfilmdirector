"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { SequencePlayer } from "@/components/timeline/SequencePlayer";
import { Waveform } from "@/components/timeline/Waveform";
import { useStudio } from "@/lib/studio";
import { parseCaptions } from "@/lib/captions";
import {
  FRAME_MS,
  ZOOM_MAX,
  ZOOM_MIN,
  clipSpan,
  formatSeconds,
  formatTimecode,
  gapSpan,
  importAllowed,
  secondsToMs,
  snapMs,
  timelineDuration,
  TRACK_META,
  trackMeta,
  trimClip,
  type TrackId,
} from "@/lib/timeline";

function readMediaFile(file: File) {
  const audioName = file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name);
  return new Promise<{ durationMs: number; hasVideo: boolean }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const element = document.createElement(audioName ? "audio" : "video");
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("This file took too long to read."));
    }, 8000);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const durationMs = Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : 0;
      const hasVideo = element instanceof HTMLVideoElement && element.videoWidth > 0;
      URL.revokeObjectURL(url);
      resolve({ durationMs, hasVideo });
    };
    element.onerror = () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error("This file could not be read."));
    };
    element.src = url;
  });
}

async function fileHasAudio(file: File) {
  if (file.type.startsWith("audio/")) return true;
  const size = file.size;
  const slices = size <= 8_000_000 ? [file] : [file.slice(0, 1_000_000), file.slice(size - 1_000_000)];
  const decoded = new TextDecoder("latin1").decode(await new Blob(slices).arrayBuffer());
  if (/mp4a|OpusHead|A_OPUS|A_VORBIS|sowt|twos|\x00flac/.test(decoded)) return true;
  if (size > 12_000_000) return false;
  const context = new AudioContext();
  try {
    await context.decodeAudioData(await file.arrayBuffer());
    return true;
  } catch {
    return false;
  } finally {
    await context.close().catch(() => undefined);
  }
}

type DragState =
  | { kind: "move"; id: string; startMs: number; track: TrackId }
  | { kind: "trim"; id: string; edge: "in" | "out"; inMs: number; outMs: number; startMs: number };

export function ProductionTimeline({ mode }: { mode: "edit" | "audio" }) {
  const studio = useStudio();
  const [playhead, setPlayhead] = useState(studio.playheadMs);
  const [playing, setPlaying] = useState(false);
  const [seekRevision, setSeekRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState("");
  const [snap, setSnap] = useState(true);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordStream = useRef<MediaStream | null>(null);
  const recordChunks = useRef<Blob[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const snapRef = useRef(snap);
  const recordStarted = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const duration = Math.max(timelineDuration(studio.clips), 1000);
  const width = Math.max(duration / 1000 + 8, 12) * studio.pixelsPerSecond;
  const selected = studio.selectedClip;
  snapRef.current = snap;

  useEffect(() => {
    setPlayhead(studio.playheadMs);
    setSeekRevision((current) => current + 1);
    setPlaying(false);
  }, [studio.activeProjectId]);

  useEffect(() => () => {
    recordStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        return;
      }
      if (!studio.selectedClipId) return;
      const clip = studio.clips.find((item) => item.id === studio.selectedClipId);
      if (!clip) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step = event.shiftKey ? 1000 : FRAME_MS;
        const delta = event.key === "ArrowLeft" ? -step : step;
        const next = Math.max(0, clip.startMs + delta);
        const error = studio.moveTimelineClip(clip.id, snapRef.current ? snapMs(next) : next, clip.track);
        if (error) setMessage(error);
        return;
      }
      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        setMessage(studio.splitTimelineClip(clip.id, playhead) || "Clip split at the playhead. The source file was not cut.");
        return;
      }
      if (event.key === "[") {
        event.preventDefault();
        const local = playhead - clip.startMs;
        if (local > 0 && local < clipSpan(clip)) studio.trimTimelineClip(clip.id, "in", clip.inMs + local);
        return;
      }
      if (event.key === "]") {
        event.preventDefault();
        const local = playhead - clip.startMs;
        if (local > 0 && local < clipSpan(clip)) studio.trimTimelineClip(clip.id, "out", clip.inMs + local);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio, playhead]);

  function seek(ms: number) {
    const raw = Math.max(0, Math.min(ms, duration));
    const next = snap ? snapMs(raw, FRAME_MS) : raw;
    setPlayhead(next);
    setSeekRevision((current) => current + 1);
    studio.setPlayhead(next);
  }

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      studio.setPlayhead(playhead);
      return;
    }
    if (playhead >= timelineDuration(studio.clips) - 40) seek(0);
    setPlaying(true);
  }

  async function importFiles(files: FileList | null, preferred: TrackId) {
    if (!files?.length) return;
    const libraryOnly = studio.assetCategory === "assets";
    for (const file of files) {
      if (/\.(srt|vtt)$/i.test(file.name)) {
        if (libraryOnly) {
          setMessage("Caption files go on the timeline. Switch to Media Library to import .srt / .vtt.");
          continue;
        }
        const cues = parseCaptions(await file.text());
        setMessage(studio.importCaptions(file.name, cues) || `${cues.length} captions from ${file.name} are on the timeline.`);
        continue;
      }
      if (!importAllowed(file.type, file.name)) {
        setMessage(`${file.name} is not a supported video, audio, or caption file.`);
        continue;
      }
      try {
        const meta = await readMediaFile(file);
        const hasAudio = meta.hasVideo ? await fileHasAudio(file) : true;
        const track = meta.hasVideo ? "video" : preferred === "video" ? "music" : preferred;
        const error = await studio.saveImportedMedia({
          name: file.name,
          mime: file.type || (meta.hasVideo ? "video/mp4" : "audio/mpeg"),
          blob: file,
          durationMs: meta.durationMs,
          hasVideo: meta.hasVideo,
          hasAudio,
          kind: "import",
          track,
          place: !libraryOnly,
        });
        setMessage(
          error ||
            (libraryOnly
              ? `${file.name} was saved to My Assets. Place it on the timeline when ready.`
              : `${file.name} was added to the shared timeline.`),
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : `${file.name} could not be imported.`);
      }
    }
  }

  function placeAssetOnTimeline(assetId: string) {
    const preferred =
      mode === "audio"
        ? studio.selectedAudioTrack === "sfx" || studio.selectedAudioTrack === "dialogue" || studio.selectedAudioTrack === "voice"
          ? (studio.selectedAudioTrack as TrackId)
          : "music"
        : undefined;
    const error = studio.placeAsset(assetId, preferred);
    const asset = studio.assets.find((item) => item.id === assetId);
    setMessage(error || `${asset?.name || "File"} was placed on the timeline.`);
  }

  async function startNarration() {
    if (recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("This browser cannot record narration.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      recordStream.current = stream;
      recordChunks.current = [];
      recordStarted.current = Date.now();
      const rec = new MediaRecorder(stream);
      recorder.current = rec;
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) recordChunks.current.push(event.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordChunks.current, { type: rec.mimeType || "audio/webm" });
        const elapsed = Math.max(40, Date.now() - recordStarted.current);
        const file = new File([blob], "narration.webm", { type: blob.type || "audio/webm" });
        void readMediaFile(file)
          .then((meta) => meta.durationMs)
          .catch(() => elapsed)
          .then((durationMs) =>
            studio.saveImportedMedia({
              name: "Narration",
              mime: blob.type || "audio/webm",
              blob,
              durationMs: Math.max(40, durationMs),
              hasVideo: false,
              hasAudio: true,
              kind: "narration",
              track: "voice",
            }),
          )
          .then((error) => setMessage(error || "Narration was saved on the lead vocal track. It was not generated speech."));
      };
      rec.start(250);
      setRecording(true);
      setMessage("Microphone is recording narration. Stop to save it.");
    } catch {
      setMessage("Microphone permission was denied. Narration was not recorded.");
    }
  }

  function stopNarration() {
    recorder.current?.stop();
    setRecording(false);
  }

  function msFromClientX(clientX: number, lane: HTMLElement) {
    const rect = lane.getBoundingClientRect();
    const scrollLeft = scroller.current?.scrollLeft ?? 0;
    return ((clientX - rect.left + scrollLeft) / studio.pixelsPerSecond) * 1000;
  }

  function onClipPointerDown(event: ReactPointerEvent<HTMLDivElement>, id: string) {
    if (event.button !== 0) return;
    const clip = studio.clips.find((item) => item.id === id);
    if (!clip) return;
    studio.selectClip(id);
    const originX = event.clientX;
    const originStart = clip.startMs;
    const originTrack = clip.track;
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      const delta = ((moveEvent.clientX - originX) / studio.pixelsPerSecond) * 1000;
      const lane = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY).find((element) => element instanceof HTMLElement && element.dataset.track);
      const track = (lane instanceof HTMLElement && lane.dataset.track ? lane.dataset.track : originTrack) as TrackId;
      let startMs = Math.max(0, Math.round(originStart + delta));
      if (snapRef.current) startMs = snapMs(startMs);
      const next: DragState = { kind: "move", id, startMs, track };
      dragRef.current = next;
      setDrag(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (current && current.kind === "move" && current.id === id) {
        const error = studio.moveTimelineClip(id, current.startMs, current.track);
        if (error) setMessage(error);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function mediaDurationFor(clipId: string) {
    const clip = studio.clips.find((item) => item.id === clipId);
    if (!clip) return 0;
    const take = studio.takes.find((item) => item.mediaId === clip.mediaId);
    const asset = studio.assets.find((item) => item.id === clip.mediaId);
    return take?.durationMs || asset?.durationMs || clip.outMs;
  }

  function onTrimPointerDown(event: ReactPointerEvent<HTMLButtonElement>, id: string, edge: "in" | "out") {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0) return;
    const clip = studio.clips.find((item) => item.id === id);
    if (!clip) return;
    studio.selectClip(id);
    const originX = event.clientX;
    const origin = { ...clip };
    const mediaDuration = mediaDurationFor(id);
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      const delta = ((moveEvent.clientX - originX) / studio.pixelsPerSecond) * 1000;
      let sourceMs = edge === "in" ? origin.inMs + delta : origin.outMs + delta;
      if (snapRef.current) sourceMs = snapMs(sourceMs, FRAME_MS);
      const preview = trimClip(origin, edge, sourceMs, mediaDuration);
      studio.trimTimelineClip(id, edge, sourceMs);
      const next: DragState = { kind: "trim", id, edge, inMs: preview.inMs, outMs: preview.outMs, startMs: preview.startMs };
      dragRef.current = next;
      setDrag(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      dragRef.current = null;
      setDrag(null);
      setMessage(edge === "in" ? "In point adjusted. Source file kept." : "Out point adjusted. Source file kept.");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onPlayheadPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const lane = scroller.current;
    if (!lane) return;
    const move = (moveEvent: PointerEvent) => {
      const rect = lane.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left + lane.scrollLeft;
      seek((x / studio.pixelsPerSecond) * 1000);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    move(event.nativeEvent);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function clipView(clip: (typeof studio.clips)[number]) {
    if (drag?.kind === "move" && drag.id === clip.id) {
      return { ...clip, startMs: drag.startMs, track: drag.track };
    }
    if (drag?.kind === "move") {
      const dragged = studio.clips.find((item) => item.id === drag.id);
      if (dragged?.groupId && clip.groupId === dragged.groupId) {
        return { ...clip, startMs: clip.startMs + (drag.startMs - dragged.startMs) };
      }
    }
    if (drag?.kind === "trim" && drag.id === clip.id) {
      return { ...clip, inMs: drag.inMs, outMs: drag.outMs, startMs: drag.startMs };
    }
    return clip;
  }

  const shown = mode === "audio" ? TRACK_META.filter((track) => track.kind !== "note") : TRACK_META;

  return (
    <div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <article className="rounded-[10px] bg-card px-4 py-4" data-testid="media-bin">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-base font-bold">
              {studio.assetCategory === "assets" ? "My Assets" : mode === "audio" ? "Audio files" : "Media Library"}
            </h2>
            <div className="flex gap-1">
              <button
                type="button"
                className={`h-8 rounded-md px-2 text-xs ${studio.assetCategory !== "assets" ? "bg-active text-ink" : "bg-inset text-muted"}`}
                data-testid="bin-media"
                onClick={() => studio.setAssetCategory(mode === "audio" ? (studio.selectedAudioTrack === "sfx" ? "sfx" : "music") : "media")}
              >
                Library
              </button>
              <button
                type="button"
                className={`h-8 rounded-md px-2 text-xs ${studio.assetCategory === "assets" ? "bg-active text-ink" : "bg-inset text-muted"}`}
                data-testid="bin-assets"
                onClick={() => studio.setAssetCategory("assets")}
              >
                Assets ({studio.assets.length})
              </button>
            </div>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            {studio.assetCategory === "assets"
              ? "Imported files stay on this device. Import here to store without placing; Place adds a clip to the shared timeline."
              : mode === "audio"
                ? "Takes and imported audio. Import places on the preferred audio track."
                : "Takes from Capture and imported media. Import places on the timeline immediately."}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <label className="text-xs text-muted">
              {studio.assetCategory === "assets" ? "Import to My Assets" : "Import media"}
              <input
                className="mt-1 block w-full text-sm"
                data-testid={mode === "audio" ? "import-audio" : "import-media"}
                type="file"
                accept={
                  studio.assetCategory === "assets"
                    ? "video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/mp4,audio/webm,audio/ogg,audio/aac,.mp4,.webm,.mov,.mp3,.wav,.m4a,.ogg,.aac"
                    : "video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/mp4,audio/webm,audio/ogg,audio/aac,.mp4,.webm,.mov,.mp3,.wav,.m4a,.ogg,.aac,.srt,.vtt"
                }
                multiple
                onChange={(event) => {
                  const preferred =
                    mode === "audio"
                      ? studio.selectedAudioTrack === "sfx" || studio.selectedAudioTrack === "dialogue" || studio.selectedAudioTrack === "voice"
                        ? (studio.selectedAudioTrack as TrackId)
                        : "music"
                      : "video";
                  void importFiles(event.target.files, preferred);
                  event.target.value = "";
                }}
              />
            </label>
            {mode === "audio" && studio.assetCategory !== "assets" ? (
              <button type="button" className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent" data-testid="record-narration" onClick={() => (recording ? stopNarration() : void startNarration())}>
                {recording ? "Stop narration" : "Record narration"}
              </button>
            ) : null}
          </div>
          <ul className="mt-3 flex max-h-72 list-none flex-col gap-2 overflow-auto p-0">
            {studio.assetCategory !== "assets"
              ? studio.takes.map((take) => (
                  <li key={take.id}>
                    <button type="button" className="w-full rounded-[9px] bg-inset px-3 py-2 text-left text-sm" data-testid={`place-take-${take.id}`} onClick={() => setMessage(studio.placeTake(take.id) || `${take.name} was added to the timeline.`)}>
                      {take.name}
                      <span className="mt-1 block text-xs text-muted">
                        {formatTimecode(take.durationMs)} · {studio.characters.find((character) => character.id === take.characterId)?.name || "Character"}
                      </span>
                    </button>
                  </li>
                ))
              : null}
            {studio.assets.map((asset) => {
              const onTimeline = studio.clips.some((clip) => clip.mediaId === asset.id);
              return (
                <li key={asset.id} className="rounded-[9px] bg-inset px-3 py-2 text-sm" data-testid={`asset-${asset.id}`}>
                  <p className="m-0 font-bold">{asset.name}</p>
                  <span className="mt-1 block text-xs text-muted">
                    {asset.kind === "narration" ? "Narration" : "Import"} · {asset.hasVideo ? "Video" : "Audio"} ·{" "}
                    {asset.durationMs < 1000 ? `${(asset.durationMs / 1000).toFixed(1)}s` : formatTimecode(asset.durationMs)}
                    {onTimeline ? " · On timeline" : ""}
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="h-8 rounded-md bg-accent px-2 text-xs font-bold text-on-accent" data-testid={`place-asset-${asset.id}`} onClick={() => placeAssetOnTimeline(asset.id)}>
                      Place on timeline
                    </button>
                    <button
                      type="button"
                      className="h-8 rounded-md bg-card px-2 text-xs text-muted"
                      data-testid={`delete-asset-${asset.id}`}
                      onClick={() => {
                        void studio.deleteAsset(asset.id).then((error) => setMessage(error || `${asset.name} was deleted from this device.`));
                      }}
                    >
                      Delete file
                    </button>
                  </div>
                </li>
              );
            })}
            {(studio.assetCategory === "assets" ? studio.assets.length === 0 : studio.takes.length === 0 && studio.assets.length === 0) ? (
              <li className="text-sm text-muted">
                {studio.assetCategory === "assets" ? (
                  "No imported files in My Assets yet. Use Import to My Assets above."
                ) : (
                  <>
                    No recordings yet.{" "}
                    <Link href="/capture" className="text-accent" onClick={() => studio.setAssetCategory("characters")}>
                      Open Capture
                    </Link>{" "}
                    to record, or import a file above.
                  </>
                )}
              </li>
            ) : null}
          </ul>
          {studio.assetCategory !== "assets" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" onClick={() => setMessage(studio.placeScene(studio.selectedSceneId) || "Scene recordings were added.")}>
                Add scene
              </button>
              <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" onClick={() => setMessage(studio.placeShot(studio.selectedShotId) || "Shot recordings were added.")}>
                Add shot
              </button>
              {studio.clips.length > 0 ? (
                <Link href="/export" className="inline-flex h-9 items-center rounded-[7px] bg-accent px-3 text-sm font-bold text-on-accent">
                  Continue to Export
                </Link>
              ) : null}
            </div>
          ) : studio.clips.length > 0 ? (
            <div className="mt-3">
              <Link href="/export" className="inline-flex h-9 items-center rounded-[7px] bg-accent px-3 text-sm font-bold text-on-accent">
                Continue to Export
              </Link>
            </div>
          ) : null}
        </article>
        <article className="rounded-[10px] bg-card px-4 py-4">
          <h2 className="m-0 text-base font-bold">Program Monitor</h2>
          <div className="mt-3">
            <SequencePlayer clips={studio.clips} mix={studio.mix} playheadMs={playhead} playing={playing} seekRevision={seekRevision} onPlayhead={setPlayhead} onPlaying={setPlaying} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent" data-testid="play-sequence" onClick={togglePlay}>
              {playing ? "Pause" : "Play"}
            </button>
            <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" onClick={() => seek(0)}>
              Start
            </button>
            <p className="m-0 text-sm" data-testid="playhead" data-playhead-ms={Math.round(playhead)}>
              {formatTimecode(playhead)} / {formatTimecode(timelineDuration(studio.clips))}
            </p>
          </div>
          <p className="mt-2 text-[13px] text-muted">Playback follows the shared timeline. Drag the playhead or clip edges to adjust.</p>
        </article>
      </div>

      <article className="mt-4 rounded-[10px] bg-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-base font-bold">Timeline</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted">
              <input data-testid="timeline-snap" type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} />
              Snap
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">
              Zoom
              <input
                data-testid="timeline-zoom"
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                value={studio.pixelsPerSecond}
                onChange={(event) => studio.setTimelineZoom(Number(event.target.value))}
              />
              <span className="tabular-nums">{studio.pixelsPerSecond}px/s</span>
            </label>
            {studio.timelineGaps.length > 0 ? (
              <button
                type="button"
                className="h-8 rounded-md bg-accent px-3 text-xs font-bold text-on-accent"
                data-testid="close-timeline-gaps"
                onClick={() => {
                  const closed = studio.closeTimelineGaps("video");
                  setMessage(
                    closed === 0
                      ? "No picture gaps to close."
                      : closed === 1
                        ? "Closed 1 picture gap. Linked dialogue moved with it."
                        : `Closed ${closed} picture gaps. Linked dialogue moved with them.`,
                  );
                }}
              >
                Close {studio.timelineGaps.length} gap{studio.timelineGaps.length === 1 ? "" : "s"}
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          Drag clips to move · drag edge handles to trim · drag the playhead to scrub · ←/→ nudge · [ / ] trim to playhead · S split
          {studio.timelineGaps.length > 0
            ? ` · ${studio.timelineGaps.length} picture gap${studio.timelineGaps.length === 1 ? "" : "s"} (${formatSeconds(studio.timelineGaps.reduce((sum, gap) => sum + gapSpan(gap), 0))}s)`
            : ""}
        </p>
        {studio.warnings.some((warning) => warning.kind === "timeline-gap" || warning.kind === "audio-overrun" || warning.kind === "clip-media") ? (
          <ul className="mt-2 list-none space-y-1 p-0 text-[12px] text-muted" data-testid="timeline-gap-warnings">
            {studio.warnings
              .filter((warning) => warning.kind === "timeline-gap" || warning.kind === "audio-overrun" || warning.kind === "clip-media" || warning.kind === "export-unsupported")
              .slice(0, 4)
              .map((warning) => (
                <li key={warning.id}>
                  {warning.message}
                  {warning.kind === "timeline-gap" ? (
                    <button type="button" className="ml-2 text-accent" onClick={() => studio.closeTimelineGaps("video")}>
                      Close gaps
                    </button>
                  ) : null}
                  {warning.kind === "audio-overrun" && warning.clipId ? (
                    <button type="button" className="ml-2 text-accent" onClick={() => studio.fitClipToPicture(warning.clipId)}>
                      Trim to picture
                    </button>
                  ) : null}
                </li>
              ))}
          </ul>
        ) : null}

        <div className="mt-3" data-testid="timeline-desktop">
          <div className="overflow-x-auto" ref={scroller} data-testid="timeline-scroll">
            <div style={{ width }} className="relative min-w-full select-none">
              <button
                type="button"
                className="relative h-7 w-full bg-inset text-left"
                data-testid="time-ruler"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const scrollLeft = scroller.current?.scrollLeft ?? 0;
                  seek(((event.clientX - rect.left + scrollLeft) / studio.pixelsPerSecond) * 1000);
                }}
              >
                {Array.from({ length: Math.ceil(width / studio.pixelsPerSecond) + 1 }, (_, second) => (
                  <span key={second} className="absolute top-1.5 text-[10px] text-muted" style={{ left: second * studio.pixelsPerSecond }}>
                    {second}s
                  </span>
                ))}
              </button>

              <button
                type="button"
                aria-label="Playhead"
                data-testid="playhead-mark"
                className="absolute bottom-0 top-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize border-0 bg-transparent p-0"
                style={{ left: (playhead / 1000) * studio.pixelsPerSecond }}
                onPointerDown={onPlayheadPointerDown}
              >
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-accent" />
                <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-sm bg-accent" />
              </button>

              {shown.map((track) => {
                const mix = studio.mix.find((item) => item.id === track.id);
                return (
                  <div key={track.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2 py-1.5">
                    <div className="text-xs text-muted">
                      <div>{track.label}</div>
                      {track.kind === "audio" && mix ? (
                        <div className="mt-1 flex gap-1">
                          <button type="button" className={`rounded px-1 ${mix.muted ? "bg-active" : "bg-inset"}`} data-testid={`mute-${track.id}`} onClick={() => studio.setTrackMix(track.id, { muted: !mix.muted })}>
                            M
                          </button>
                          <button type="button" className={`rounded px-1 ${mix.solo ? "bg-active" : "bg-inset"}`} data-testid={`solo-${track.id}`} onClick={() => studio.setTrackMix(track.id, { solo: !mix.solo })}>
                            S
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div
                      className="relative h-11 rounded-md bg-inset"
                      data-track={track.id}
                      onDoubleClick={(event) => {
                        const lane = event.currentTarget;
                        seek(msFromClientX(event.clientX, lane));
                      }}
                    >
                      {track.kind === "note" ? <span className="px-2 text-[11px] leading-[2.75rem] text-muted">Retargeting is not available.</span> : null}
                      {studio.clips.length === 0 && track.kind !== "note" ? (
                        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[11px] text-muted">Drop or place media</span>
                      ) : null}
                      {track.id === "video"
                        ? studio.timelineGaps.map((gap) => (
                            <button
                              key={`gap-${gap.startMs}-${gap.beforeClipId}`}
                              type="button"
                              data-testid={`timeline-gap-${gap.beforeClipId}`}
                              title={`Gap ${formatSeconds(gapSpan(gap))}s — click to close all picture gaps`}
                              className="absolute top-1.5 h-8 rounded-sm border border-dashed border-[#f1f6ff]/45 bg-[#f1f6ff]/10 text-[10px] text-[#f1f6ff]/90"
                              style={{
                                left: (gap.startMs / 1000) * studio.pixelsPerSecond,
                                width: Math.max(12, (gapSpan(gap) / 1000) * studio.pixelsPerSecond),
                              }}
                              onClick={() => {
                                const closed = studio.closeTimelineGaps("video");
                                setMessage(closed ? `Closed ${closed} picture gap${closed === 1 ? "" : "s"}.` : "No picture gaps to close.");
                              }}
                            >
                              <span className="px-1">gap</span>
                            </button>
                          ))
                        : null}
                      {studio.clips
                        .filter((clip) => clip.track === track.id)
                        .map((raw) => {
                          const clip = clipView(raw);
                          const left = (clip.startMs / 1000) * studio.pixelsPerSecond;
                          const clipWidth = Math.max(36, (clipSpan(clip) / 1000) * studio.pixelsPerSecond);
                          const fadeInPx = Math.min(clipWidth / 2, (clip.fadeInMs / 1000) * studio.pixelsPerSecond);
                          const fadeOutPx = Math.min(clipWidth / 2, (clip.fadeOutMs / 1000) * studio.pixelsPerSecond);
                          return (
                            <div
                              key={clip.id}
                              data-testid={`clip-${clip.id}`}
                              data-out={clip.outMs}
                              data-group={clip.groupId}
                              data-track-id={clip.track}
                              className={`absolute top-1.5 flex h-8 items-center overflow-hidden rounded-sm text-left text-[11px] text-[#f1f6ff] ${
                                clip.id === studio.selectedClipId ? "z-10 outline outline-2 outline-[#f1f6ff]" : ""
                              }`}
                              style={{ left, width: clipWidth, background: track.color }}
                              onPointerDown={(event) => onClipPointerDown(event, clip.id)}
                            >
                              {fadeInPx > 2 ? (
                                <span className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-black/45 to-transparent" style={{ width: fadeInPx }} />
                              ) : null}
                              {fadeOutPx > 2 ? (
                                <span className="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-black/45 to-transparent" style={{ width: fadeOutPx }} />
                              ) : null}
                              {track.kind === "audio" ? (
                                <span className="pointer-events-none absolute inset-0 opacity-70">
                                  <Waveform mediaId={clip.mediaId} compact />
                                </span>
                              ) : null}
                              <button
                                type="button"
                                aria-label="Trim in"
                                data-testid={`trim-in-handle-${clip.id}`}
                                className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize border-0 bg-[#f1f6ff]/80 p-0"
                                onPointerDown={(event) => onTrimPointerDown(event, clip.id, "in")}
                              />
                              <span className="relative min-w-0 flex-1 truncate px-3">
                                {clip.text || clip.name}
                                <span className="ml-1 opacity-80">{formatSeconds(clipSpan(clip))}s</span>
                              </span>
                              <button
                                type="button"
                                aria-label="Trim out"
                                data-testid={`trim-out-handle-${clip.id}`}
                                className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize border-0 bg-[#f1f6ff]/80 p-0"
                                onPointerDown={(event) => onTrimPointerDown(event, clip.id, "out")}
                              />
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <ul className="mt-3 flex list-none flex-col gap-2 p-0 md:hidden" data-testid="mobile-clips">
          {studio.clips.map((clip) => (
            <li key={clip.id} className="rounded-[9px] bg-inset px-3 py-3 text-sm">
              <button type="button" className="font-bold" onClick={() => studio.selectClip(clip.id)}>
                {clip.text || clip.name}
              </button>
              <p className="mt-1 text-xs text-muted">
                {trackMeta(clip.track).label} · {formatTimecode(clipSpan(clip))} · start {formatSeconds(clip.startMs)}s
              </p>
              <label className="mt-2 block text-xs text-muted">
                Start (s)
                <input
                  className="mt-1 w-full rounded-md bg-card px-2 py-2 text-sm"
                  type="number"
                  step={0.04}
                  min={0}
                  value={formatSeconds(clip.startMs)}
                  onChange={(event) => {
                    const error = studio.moveTimelineClip(clip.id, secondsToMs(event.target.value), clip.track);
                    if (error) setMessage(error);
                  }}
                />
              </label>
              <label className="mt-2 block text-xs text-muted">
                In (s)
                <input
                  className="mt-1 w-full rounded-md bg-card px-2 py-2 text-sm"
                  type="number"
                  step={0.04}
                  min={0}
                  value={formatSeconds(clip.inMs)}
                  onChange={(event) => studio.trimTimelineClip(clip.id, "in", secondsToMs(event.target.value))}
                />
              </label>
              <label className="mt-2 block text-xs text-muted">
                Out (s)
                <input
                  className="mt-1 w-full rounded-md bg-card px-2 py-2 text-sm"
                  type="number"
                  step={0.04}
                  min={0}
                  value={formatSeconds(clip.outMs)}
                  onChange={(event) => studio.trimTimelineClip(clip.id, "out", secondsToMs(event.target.value))}
                />
              </label>
            </li>
          ))}
          {studio.clips.length === 0 ? <li className="text-sm text-muted">No clips on the timeline.</li> : null}
        </ul>

        <p className="mt-3 text-sm" data-testid="timeline-order">
          {studio.clips
            .filter((clip) => clip.track === "video")
            .sort((a, b) => a.startMs - b.startMs)
            .map((clip) => clip.name)
            .join(" | ") || "No video clips"}
        </p>
        {message ? (
          <p className="mt-2 text-sm text-muted" data-testid="timeline-message">
            {message}
          </p>
        ) : null}

        {selected ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="clip-editor">
            <p className="m-0 text-sm md:col-span-2 lg:col-span-3">
              {selected.name} · {trackMeta(selected.track).label} · {formatTimecode(clipSpan(selected))} · character {selected.characterId || "none"}
            </p>
            {trackMeta(selected.track).kind === "audio" ? <Waveform mediaId={selected.mediaId} /> : null}
            <label className="text-xs text-muted">
              Track
              <select
                className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm text-ink"
                value={selected.track}
                onChange={(event) => setMessage(studio.moveTimelineClip(selected.id, selected.startMs, event.target.value as TrackId) || "Clip moved.")}
              >
                {TRACK_META.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Start (s)
              <input
                data-testid="clip-start"
                className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm"
                type="number"
                step={0.04}
                min={0}
                value={formatSeconds(selected.startMs)}
                onChange={(event) => {
                  const next = secondsToMs(event.target.value);
                  const error = studio.moveTimelineClip(selected.id, snap ? snapMs(next) : next, selected.track);
                  if (error) setMessage(error);
                }}
              />
            </label>
            <label className="text-xs text-muted">
              Volume
              <input data-testid="clip-volume" className="mt-1 w-full" type="range" min={0} max={1} step={0.05} value={selected.volume} onChange={(event) => studio.updateClip(selected.id, { volume: Number(event.target.value) })} />
            </label>
            <label className="text-xs text-muted">
              In (s)
              <input
                data-testid="trim-in"
                className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm"
                type="number"
                step={0.04}
                min={0}
                value={formatSeconds(selected.inMs)}
                onChange={(event) => studio.trimTimelineClip(selected.id, "in", secondsToMs(event.target.value))}
              />
            </label>
            <label className="text-xs text-muted">
              Out (s)
              <input
                data-testid="trim-out"
                className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm"
                type="number"
                step={0.04}
                min={0}
                value={formatSeconds(selected.outMs)}
                onChange={(event) => studio.trimTimelineClip(selected.id, "out", secondsToMs(event.target.value))}
              />
            </label>
            <label className="text-xs text-muted">
              Duration (s)
              <input className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm" type="text" readOnly value={formatSeconds(clipSpan(selected))} />
            </label>
            <label className="text-xs text-muted">
              Fade in (ms)
              <input className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm" type="number" min={0} value={selected.fadeInMs} onChange={(event) => studio.updateClip(selected.id, { fadeInMs: Number(event.target.value) })} />
            </label>
            <label className="text-xs text-muted">
              Fade out (ms)
              <input className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm" type="number" min={0} value={selected.fadeOutMs} onChange={(event) => studio.updateClip(selected.id, { fadeOutMs: Number(event.target.value) })} />
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-3">
              <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" data-testid="nudge-earlier" onClick={() => studio.nudgeTimelineClip(selected.id, -1)}>
                Swap earlier
              </button>
              <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" data-testid="nudge-later" onClick={() => studio.nudgeTimelineClip(selected.id, 1)}>
                Swap later
              </button>
              <button
                type="button"
                className="h-9 rounded-[7px] bg-inset px-3 text-sm"
                data-testid="nudge-frame-earlier"
                onClick={() => {
                  const error = studio.moveTimelineClip(selected.id, Math.max(0, selected.startMs - FRAME_MS), selected.track);
                  if (error) setMessage(error);
                }}
              >
                −1 frame
              </button>
              <button
                type="button"
                className="h-9 rounded-[7px] bg-inset px-3 text-sm"
                data-testid="nudge-frame-later"
                onClick={() => {
                  const error = studio.moveTimelineClip(selected.id, selected.startMs + FRAME_MS, selected.track);
                  if (error) setMessage(error);
                }}
              >
                +1 frame
              </button>
              <button
                type="button"
                className="h-9 rounded-[7px] bg-inset px-3 text-sm"
                data-testid="split-clip"
                onClick={() =>
                  setMessage(studio.splitTimelineClip(selected.id, playhead) || "Clip split at the playhead. Linked picture and dialogue stay together. The source file was not cut.")
                }
              >
                Split at playhead
              </button>
              <button
                type="button"
                className="h-9 rounded-[7px] bg-inset px-3 text-sm"
                data-testid="trim-to-playhead-in"
                onClick={() => {
                  const local = playhead - selected.startMs;
                  if (local <= 0 || local >= clipSpan(selected)) {
                    setMessage("Move the playhead inside this clip to trim.");
                    return;
                  }
                  studio.trimTimelineClip(selected.id, "in", selected.inMs + local);
                  setMessage("In point set to playhead.");
                }}
              >
                Trim in to playhead
              </button>
              <button
                type="button"
                className="h-9 rounded-[7px] bg-inset px-3 text-sm"
                data-testid="trim-to-playhead-out"
                onClick={() => {
                  const local = playhead - selected.startMs;
                  if (local <= 0 || local >= clipSpan(selected)) {
                    setMessage("Move the playhead inside this clip to trim.");
                    return;
                  }
                  studio.trimTimelineClip(selected.id, "out", selected.inMs + local);
                  setMessage("Out point set to playhead.");
                }}
              >
                Trim out to playhead
              </button>
              {selected.groupId ? (
                <button
                  type="button"
                  className="h-9 rounded-[7px] bg-inset px-3 text-sm"
                  onClick={() => {
                    studio.unlinkClip(selected.id);
                    setMessage("This clip is no longer linked. The other clip stays where it is.");
                  }}
                >
                  Unlink
                </button>
              ) : null}
              {pendingDelete === selected.id ? (
                <>
                  <button
                    type="button"
                    className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent"
                    data-testid="confirm-remove-clip"
                    onClick={() => {
                      studio.deleteClip(selected.id);
                      setPendingDelete("");
                      setMessage("Clip removed from the timeline. The source file was kept.");
                    }}
                  >
                    Remove clip
                  </button>
                  <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" onClick={() => setPendingDelete("")}>
                    Keep clip
                  </button>
                </>
              ) : (
                <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" data-testid="remove-clip" onClick={() => setPendingDelete(selected.id)}>
                  Remove clip
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Select a clip to trim, split, or move it. Removing a clip does not delete the recording.</p>
        )}

        {mode === "audio" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {studio.mix
              .filter((track) => trackMeta(track.id).kind === "audio")
              .map((track) => (
                <label key={track.id} className="text-xs text-muted">
                  {trackMeta(track.id).label} volume
                  <input data-testid={`track-volume-${track.id}`} className="mt-1 w-full" type="range" min={0} max={1} step={0.05} value={track.volume} onChange={(event) => studio.setTrackMix(track.id, { volume: Number(event.target.value) })} />
                </label>
              ))}
          </div>
        ) : null}
      </article>
    </div>
  );
}
