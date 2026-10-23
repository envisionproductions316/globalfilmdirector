"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { SequencePlayer } from "@/components/timeline/SequencePlayer";
import { Waveform } from "@/components/timeline/Waveform";
import { useStudio } from "@/lib/studio";
import { importAllowed } from "@/lib/timeline";
import {
  clipSpan,
  formatTimecode,
  timelineDuration,
  TRACK_META,
  trackAccepts,
  trackMeta,
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

export function ProductionTimeline({ mode }: { mode: "edit" | "audio" }) {
  const studio = useStudio();
  const [playhead, setPlayhead] = useState(studio.playheadMs);
  const [playing, setPlaying] = useState(false);
  const [seekRevision, setSeekRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState("");
  const [drag, setDrag] = useState<{ id: string; startMs: number; track: TrackId } | null>(null);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordStream = useRef<MediaStream | null>(null);
  const recordChunks = useRef<Blob[]>([]);
  const dragRef = useRef<{ id: string; startMs: number; track: TrackId } | null>(null);
  const recordStarted = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const duration = Math.max(timelineDuration(studio.clips), 1000);
  const width = Math.max(duration / 1000 + 8, 12) * studio.pixelsPerSecond;
  const selected = studio.selectedClip;

  useEffect(() => {
    setPlayhead(studio.playheadMs);
    setSeekRevision((current) => current + 1);
    setPlaying(false);
  }, [studio.activeProjectId]);

  useEffect(() => () => {
    recordStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function seek(ms: number) {
    const next = Math.max(0, Math.min(ms, duration));
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
    for (const file of files) {
      if (!importAllowed(file.type, file.name)) {
        setMessage(`${file.name} is not a supported video or audio file.`);
        continue;
      }
      try {
        const meta = await readMediaFile(file);
        const hasVideo = meta.hasVideo;
        const hasAudio = !meta.hasVideo;
        const track = meta.hasVideo ? "video" : preferred === "video" ? "music" : preferred;
        const error = await studio.saveImportedMedia({
          name: file.name,
          mime: file.type || (meta.hasVideo ? "video/mp4" : "audio/mpeg"),
          blob: file,
          durationMs: meta.durationMs,
          hasVideo: meta.hasVideo,
          hasAudio: meta.hasVideo ? true : hasAudio,
          kind: "import",
          track,
        });
        setMessage(error || `${file.name} was added to the shared timeline.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : `${file.name} could not be imported.`);
      }
    }
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
        void studio.saveImportedMedia({
          name: "Narration",
          mime: blob.type || "audio/webm",
          blob,
          durationMs: Math.max(40, Date.now() - recordStarted.current),
          hasVideo: false,
          hasAudio: true,
          kind: "narration",
          track: "voice",
        }).then((error) => setMessage(error || "Narration was saved on the lead vocal track. It was not generated speech."));
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
      const next = { id, startMs: Math.max(0, Math.round(originStart + delta)), track };
      dragRef.current = next;
      setDrag(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (current && current.id === id) {
        const error = studio.moveTimelineClip(id, current.startMs, current.track);
        if (error) setMessage(error);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const shown = mode === "audio" ? TRACK_META.filter((track) => track.kind !== "note") : TRACK_META;

  return (
    <div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <article className="rounded-[10px] bg-card px-4 py-4">
          <h2 className="m-0 text-base font-bold">{mode === "audio" ? "Audio files" : "Media Library"}</h2>
          <div className="mt-3 flex flex-col gap-2">
            <label className="text-xs text-muted">
              Import media
              <input
                className="mt-1 block w-full text-sm"
                data-testid={mode === "audio" ? "import-audio" : "import-media"}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/mp4,audio/webm,audio/ogg,audio/aac,.mp4,.webm,.mov,.mp3,.wav,.m4a,.ogg,.aac"
                multiple
                onChange={(event) => {
                  void importFiles(event.target.files, mode === "audio" ? "music" : "video");
                  event.target.value = "";
                }}
              />
            </label>
            {mode === "audio" ? (
              <button type="button" className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent" data-testid="record-narration" onClick={() => (recording ? stopNarration() : void startNarration())}>
                {recording ? "Stop narration" : "Record narration"}
              </button>
            ) : null}
          </div>
          <ul className="mt-3 flex max-h-72 list-none flex-col gap-2 overflow-auto p-0">
            {studio.takes.map((take) => (
              <li key={take.id}>
                <button type="button" className="w-full rounded-[9px] bg-inset px-3 py-2 text-left text-sm" data-testid={`place-take-${take.id}`} onClick={() => setMessage(studio.placeTake(take.id) || `${take.name} was added to the timeline.`)}>
                  {take.name}
                  <span className="mt-1 block text-xs text-muted">{formatTimecode(take.durationMs)} · {take.characterId}</span>
                </button>
              </li>
            ))}
            {studio.assets.map((asset) => (
              <li key={asset.id} className="rounded-[9px] bg-inset px-3 py-2 text-sm">
                {asset.name}
                <span className="mt-1 block text-xs text-muted">{asset.kind} · {formatTimecode(asset.durationMs)}</span>
              </li>
            ))}
            {studio.takes.length === 0 && studio.assets.length === 0 ? <li className="text-sm text-muted">No recordings or imported files in this project.</li> : null}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" onClick={() => setMessage(studio.placeScene(studio.selectedSceneId) || "Scene recordings were added.")}>Add scene</button>
            <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" onClick={() => setMessage(studio.placeShot(studio.selectedShotId) || "Shot recordings were added.")}>Add shot</button>
          </div>
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
            <p className="m-0 text-sm" data-testid="playhead" data-playhead-ms={Math.round(playhead)}>{formatTimecode(playhead)} / {formatTimecode(timelineDuration(studio.clips))}</p>
          </div>
          <p className="mt-2 text-[13px] text-muted">Playback follows the shared timeline. Storyboard stills are not shown as a rendered film.</p>
        </article>
      </div>

      <article className="mt-4 rounded-[10px] bg-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-base font-bold">Timeline</h2>
          <label className="flex items-center gap-2 text-xs text-muted">
            Zoom
            <input data-testid="timeline-zoom" type="range" min={24} max={160} value={studio.pixelsPerSecond} onChange={(event) => studio.setTimelineZoom(Number(event.target.value))} />
          </label>
        </div>
        <div className="mt-3 hidden lg:block">
          <div className="overflow-x-auto" ref={scroller} data-testid="timeline-scroll">
            <div style={{ width }} className="relative min-w-full">
              <button
                type="button"
                className="relative h-6 w-full bg-inset text-left"
                data-testid="time-ruler"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  seek(((event.clientX - rect.left) / studio.pixelsPerSecond) * 1000);
                }}
              >
                {Array.from({ length: Math.ceil(width / studio.pixelsPerSecond) }, (_, second) => (
                  <span key={second} className="absolute top-1 text-[10px] text-muted" style={{ left: second * studio.pixelsPerSecond }}>{second}s</span>
                ))}
              </button>
              <div className="pointer-events-none absolute bottom-0 top-6 w-px bg-accent" style={{ left: (playhead / 1000) * studio.pixelsPerSecond }} data-testid="playhead-mark" />
              {shown.map((track) => {
                const mix = studio.mix.find((item) => item.id === track.id);
                return (
                  <div key={track.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2 py-1">
                    <div className="text-xs text-muted">
                      <div>{track.label}</div>
                      {track.kind === "audio" && mix ? (
                        <div className="mt-1 flex gap-1">
                          <button type="button" className={`rounded px-1 ${mix.muted ? "bg-active" : "bg-inset"}`} data-testid={`mute-${track.id}`} onClick={() => studio.setTrackMix(track.id, { muted: !mix.muted })}>M</button>
                          <button type="button" className={`rounded px-1 ${mix.solo ? "bg-active" : "bg-inset"}`} data-testid={`solo-${track.id}`} onClick={() => studio.setTrackMix(track.id, { solo: !mix.solo })}>S</button>
                        </div>
                      ) : null}
                    </div>
                    <div className="relative h-9 rounded bg-inset" data-track={track.id}>
                      {track.kind === "note" ? <span className="px-2 text-[11px] text-muted">{track.id === "motion" ? "Retargeting is not available." : "No caption file is stored."}</span> : null}
                      {studio.clips.filter((clip) => clip.track === track.id).map((clip) => {
                        const live = drag?.id === clip.id ? drag : clip;
                        const left = (live.startMs / 1000) * studio.pixelsPerSecond;
                        const clipWidth = Math.max(28, (clipSpan(clip) / 1000) * studio.pixelsPerSecond);
                        return (
                          <div
                            key={clip.id}
                            data-testid={`clip-${clip.id}`}
                            className={`absolute top-1 h-7 overflow-hidden rounded-sm px-2 text-left text-[11px] leading-7 text-[#f1f6ff] ${clip.id === studio.selectedClipId ? "outline outline-2 outline-[#f1f6ff]" : ""}`}
                            style={{ left, width: clipWidth, background: track.color }}
                            onPointerDown={(event) => onClipPointerDown(event, clip.id)}
                          >
                            {clip.name}
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
        <ul className="mt-3 flex list-none flex-col gap-2 p-0 lg:hidden" data-testid="mobile-clips">
          {studio.clips.map((clip) => (
            <li key={clip.id} className="rounded-[9px] bg-inset px-3 py-3 text-sm">
              <button type="button" className="font-bold" onClick={() => studio.selectClip(clip.id)}>{clip.name}</button>
              <p className="mt-1 text-xs text-muted">{trackMeta(clip.track).label} · {formatTimecode(clipSpan(clip))} · {clip.characterId || "No character"}</p>
            </li>
          ))}
          {studio.clips.length === 0 ? <li className="text-sm text-muted">No clips on the timeline.</li> : null}
        </ul>
        <p className="mt-3 text-sm" data-testid="timeline-order">{studio.clips.filter((clip) => clip.track === "video").sort((a, b) => a.startMs - b.startMs).map((clip) => clip.name).join(" | ") || "No video clips"}</p>
        {message ? <p className="mt-2 text-sm text-muted" data-testid="timeline-message">{message}</p> : null}
        {selected ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2" data-testid="clip-editor">
            <p className="m-0 text-sm md:col-span-2">{selected.name} · {trackMeta(selected.track).label} · source {selected.mediaId} · {selected.characterId || "No character"} · {formatTimecode(clipSpan(selected))}</p>
            {trackMeta(selected.track).kind === "audio" ? <Waveform mediaId={selected.mediaId} /> : null}
            <label className="text-xs text-muted">
              Track
              <select className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm text-ink" value={selected.track} onChange={(event) => setMessage(studio.moveTimelineClip(selected.id, selected.startMs, event.target.value as TrackId) || "Clip moved.")}>
                {TRACK_META.map((track) => <option key={track.id} value={track.id}>{track.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted">
              Volume
              <input data-testid="clip-volume" className="mt-1 w-full" type="range" min={0} max={1} step={0.05} value={selected.volume} onChange={(event) => studio.updateClip(selected.id, { volume: Number(event.target.value) })} />
            </label>
            <label className="text-xs text-muted">
              Trim in (ms)
              <input className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm" type="number" value={selected.inMs} onChange={(event) => studio.trimTimelineClip(selected.id, "in", Number(event.target.value))} />
            </label>
            <label className="text-xs text-muted">
              Trim out (ms)
              <input data-testid="trim-out" className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm" type="number" value={selected.outMs} onChange={(event) => studio.trimTimelineClip(selected.id, "out", Number(event.target.value))} />
            </label>
            <label className="text-xs text-muted">
              Fade in (ms)
              <input className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm" type="number" min={0} value={selected.fadeInMs} onChange={(event) => studio.updateClip(selected.id, { fadeInMs: Number(event.target.value) })} />
            </label>
            <label className="text-xs text-muted">
              Fade out (ms)
              <input className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm" type="number" min={0} value={selected.fadeOutMs} onChange={(event) => studio.updateClip(selected.id, { fadeOutMs: Number(event.target.value) })} />
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" data-testid="nudge-earlier" onClick={() => studio.nudgeTimelineClip(selected.id, -1)}>Earlier</button>
              <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" data-testid="nudge-later" onClick={() => studio.nudgeTimelineClip(selected.id, 1)}>Later</button>
              <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" data-testid="split-clip" onClick={() => setMessage(studio.splitTimelineClip(selected.id, playhead) || "Clip split at the playhead. The source file was not cut.")}>Split at playhead</button>
              {pendingDelete === selected.id ? (
                <>
                  <button type="button" className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent" data-testid="confirm-remove-clip" onClick={() => { studio.deleteClip(selected.id); setPendingDelete(""); setMessage("Clip removed from the timeline. The source file was kept."); }}>Remove clip</button>
                  <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" onClick={() => setPendingDelete("")}>Keep clip</button>
                </>
              ) : (
                <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" data-testid="remove-clip" onClick={() => setPendingDelete(selected.id)}>Remove clip</button>
              )}
            </div>
          </div>
        ) : <p className="mt-3 text-sm text-muted">Select a clip to trim, split, or move it. Removing a clip does not delete the recording.</p>}
        {mode === "audio" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {studio.mix.filter((track) => trackMeta(track.id).kind === "audio").map((track) => (
              <label key={track.id} className="text-xs text-muted">
                {trackMeta(track.id).label} volume
                <input data-testid={`track-volume-${track.id}`} className="mt-1 w-full" type="range" min={0} max={1} step={0.05} value={track.volume} onChange={(event) => studio.setTrackMix(track.id, { volume: Number(event.target.value) })} />
              </label>
            ))}
          </div>
        ) : null}
      </article>
      {shown.some((track) => !trackAccepts(track.id, { hasVideo: true, hasAudio: true }) && track.kind === "note") ? null : null}
    </div>
  );
}
