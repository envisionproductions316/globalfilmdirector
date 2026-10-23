"use client";

import { useEffect, useRef, useState } from "react";
import { getMedia } from "@/lib/media-db";
import { clipEnd, gainAt, timelineDuration, trackMeta, type TimelineClip, type TrackMix } from "@/lib/timeline";

export function SequencePlayer({
  clips,
  mix,
  playheadMs,
  playing,
  seekRevision,
  onPlayhead,
  onPlaying,
}: {
  clips: TimelineClip[];
  mix: TrackMix[];
  playheadMs: number;
  playing: boolean;
  seekRevision: number;
  onPlayhead: (ms: number) => void;
  onPlaying: (playing: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioMap = useRef(new Map<string, HTMLAudioElement>());
  const urls = useRef<Record<string, string>>({});
  const [readyUrls, setReadyUrls] = useState<Record<string, string>>({});
  const clipsRef = useRef(clips);
  const mixRef = useRef(mix);
  const playingRef = useRef(playing);
  const cursorRef = useRef(playheadMs);
  const onPlayheadRef = useRef(onPlayhead);
  const onPlayingRef = useRef(onPlaying);
  const videoArmed = useRef("");
  clipsRef.current = clips;
  mixRef.current = mix;
  playingRef.current = playing;
  onPlayheadRef.current = onPlayhead;
  onPlayingRef.current = onPlaying;

  const mediaKey = [...new Set(clips.map((clip) => clip.mediaId))].sort().join("|");

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    void Promise.all(
      mediaKey.split("|").filter(Boolean).map(async (id) => {
        const record = await getMedia(id).catch(() => undefined);
        if (!record || cancelled) return;
        const url = URL.createObjectURL(record.blob);
        created.push(url);
        urls.current[id] = url;
      }),
    ).then(() => {
      if (!cancelled) setReadyUrls({ ...urls.current });
    });
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
      for (const id of Object.keys(urls.current)) delete urls.current[id];
    };
  }, [mediaKey]);

  useEffect(() => {
    cursorRef.current = playheadMs;
    videoArmed.current = "";
    audioMap.current.forEach((audio) => audio.pause());
    // Seek only. Playback updates playhead every frame and must not restart the media.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekRevision]);

  useEffect(() => {
    if (!playing) {
      videoRef.current?.pause();
      audioMap.current.forEach((audio) => audio.pause());
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (!playingRef.current) return;
      const delta = Math.min(80, now - last);
      last = now;
      const currentClips = clipsRef.current;
      const end = Math.max(timelineDuration(currentClips), 0);
      const cursor = cursorRef.current + delta;
      if (end <= 0 || cursor >= end) {
        cursorRef.current = end;
        onPlayheadRef.current(end);
        onPlayingRef.current(false);
        videoRef.current?.pause();
        audioMap.current.forEach((audio) => audio.pause());
        return;
      }
      cursorRef.current = cursor;
      onPlayheadRef.current(cursor);
      sync(cursor);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    if (playing) return;
    sync(playheadMs, false);
  }, [playing, playheadMs, readyUrls]);

  function sync(cursor: number, shouldPlay = true) {
    const currentClips = clipsRef.current;
    const currentMix = mixRef.current;
    const videoClips = currentClips.filter((clip) => clip.track === "video").sort((a, b) => a.startMs - b.startMs);
    const active = [...videoClips].reverse().find((clip) => cursor >= clip.startMs && cursor < clipEnd(clip));
    const video = videoRef.current;
    if (video) {
      if (!active || !urls.current[active.mediaId]) {
        video.pause();
        videoArmed.current = "";
      } else {
        const token = `${active.id}:${urls.current[active.mediaId]}`;
        const target = (active.inMs + (cursor - active.startMs)) / 1000;
        if (videoArmed.current !== token) {
          videoArmed.current = token;
          video.src = urls.current[active.mediaId];
          const arm = () => {
            if (videoArmed.current !== token) return;
            video.currentTime = Math.min(target, Number.isFinite(video.duration) ? video.duration : target);
            if (shouldPlay && playingRef.current) void video.play().catch(() => undefined);
          };
          if (video.readyState >= 1 && video.src.endsWith(urls.current[active.mediaId].slice(-8))) arm();
          video.onloadeddata = arm;
        } else if (Math.abs(video.currentTime - target) > 0.35) {
          video.currentTime = target;
        }
        if (shouldPlay && playingRef.current && video.paused) void video.play().catch(() => undefined);
        if (!shouldPlay) video.pause();
      }
    }

    const heard = new Set<string>();
    for (const clip of currentClips) {
      if (trackMeta(clip.track).kind !== "audio") continue;
      const url = urls.current[clip.mediaId];
      if (!url) continue;
      let audio = audioMap.current.get(clip.id);
      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        audioMap.current.set(clip.id, audio);
      }
      if (audio.dataset.mediaUrl !== url) {
        audio.dataset.mediaUrl = url;
        audio.src = url;
      }
      const inside = cursor >= clip.startMs && cursor < clipEnd(clip);
      const gain = inside ? gainAt(clip, cursor, currentMix) : 0;
      if (!inside || gain <= 0.001) {
        audio.pause();
        continue;
      }
      heard.add(clip.id);
      audio.volume = Math.max(0, Math.min(1, gain));
      if (shouldPlay && playingRef.current && audio.paused) {
        audio.currentTime = (clip.inMs + (cursor - clip.startMs)) / 1000;
        void audio.play().catch(() => undefined);
      }
      if (!shouldPlay) {
        const target = (clip.inMs + (cursor - clip.startMs)) / 1000;
        if (Math.abs(audio.currentTime - target) > 0.35) audio.currentTime = target;
        audio.pause();
      }
    }
    for (const [id, audio] of audioMap.current) {
      if (!heard.has(id)) audio.pause();
    }
  }

  const activeVideo = [...clips].reverse().find((clip) => clip.track === "video" && playheadMs >= clip.startMs && playheadMs < clipEnd(clip));
  const span = activeVideo ? clipEnd(activeVideo) - activeVideo.startMs : 0;

  return (
    <div className="grid min-h-[220px] place-items-center overflow-hidden rounded-[9px] bg-[#34436d] text-center text-[#f1f6ff]">
      <video ref={videoRef} className={`max-h-[250px] w-full ${activeVideo ? "" : "hidden"}`} playsInline muted data-testid="sequence-video" />
      {activeVideo ? null : (
        <p className="m-0 px-4 text-sm" data-testid="monitor-empty">
          {clips.some((clip) => clip.track === "video") ? "No picture at the playhead." : "No video clip is on the timeline. This monitor is not playing a rendered film."}
          {span ? "" : ""}
        </p>
      )}
    </div>
  );
}
