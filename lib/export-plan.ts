import { audible, clipEnd, clipSpan, timelineDuration, type TimelineClip, type TrackMix } from "./timeline.ts";

export type ExportSource = {
  mediaId: string;
  path: string;
  hasVideo: boolean;
  hasAudio: boolean;
};

export type ExportPlan = {
  args: string[];
  durationMs: number;
  error: string;
  notes: string[];
};

function seconds(ms: number) {
  return (Math.max(0, ms) / 1000).toFixed(3);
}

/**
 * Local export decision: build an ffmpeg argument list for the user's existing ffmpeg.
 * This module does not download, install, or shell out. The API route runs the list only
 * after `ffmpeg` is found on PATH. Output is MP4 (H.264 + AAC) at 1280×720 when picture exists.
 */
export function buildExportPlan(clips: TimelineClip[], mix: TrackMix[], media: ExportSource[], outputPath: string, subtitlePath = ""): ExportPlan {
  const sources = new Map(media.map((item) => [item.mediaId, item]));
  const notes: string[] = [];
  const durationMs = timelineDuration(clips);
  if (durationMs < 40) return { args: [], durationMs, error: "The timeline is too short to export.", notes };
  const videoClips = clips.filter((clip) => clip.track === "video").sort((a, b) => a.startMs - b.startMs);
  if (videoClips.length === 0) {
    return { args: [], durationMs, error: "The timeline has no video clips. No file was exported.", notes };
  }

  const used: { clip: TimelineClip; source: ExportSource; role: "video" | "audio" }[] = [];
  for (const clip of videoClips) {
    const source = sources.get(clip.mediaId);
    if (!source) {
      notes.push(`${clip.name} is missing its media file and was left out.`);
      continue;
    }
    if (!source.hasVideo) {
      notes.push(`${clip.name} has no video stream and was left out of the picture.`);
      continue;
    }
    used.push({ clip, source, role: "video" });
  }
  if (!used.some((item) => item.role === "video")) {
    return { args: [], durationMs, error: "None of the video clips have a readable picture stream.", notes };
  }

  for (const clip of clips) {
    if (!audible(clip, mix)) continue;
    const source = sources.get(clip.mediaId);
    if (!source) {
      notes.push(`${clip.name} is missing its media file and was left out of the mix.`);
      continue;
    }
    if (!source.hasAudio) {
      notes.push(`${clip.name} has no audio stream and was left out of the mix.`);
      continue;
    }
    used.push({ clip, source, role: "audio" });
  }

  const duration = seconds(durationMs);
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  args.push("-f", "lavfi", "-i", `color=c=black:s=1280x720:r=30:d=${duration}`);
  args.push("-f", "lavfi", "-i", `anullsrc=channel_layout=stereo:sample_rate=48000:d=${duration}`);
  for (const item of used) args.push("-i", item.source.path);

  const filters: string[] = ["[0:v]format=yuv420p,setsar=1[base0]"];
  let base = "base0";
  let videoIndex = 0;
  used.forEach((item, index) => {
    const input = index + 2;
    if (item.role !== "video") return;
    videoIndex += 1;
    const start = seconds(item.clip.startMs);
    const end = seconds(clipEnd(item.clip));
    const label = `vc${videoIndex}`;
    const next = `ov${videoIndex}`;
    filters.push(
      `[${input}:v]trim=start=${seconds(item.clip.inMs)}:end=${seconds(item.clip.outMs)},setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,fps=30,setsar=1[${label}]`,
    );
    filters.push(`[${base}][${label}]overlay=eof_action=pass:x=0:y=0:enable='between(t,${start},${end})'[${next}]`);
    base = next;
  });
  if (subtitlePath) {
    const escaped = subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    filters.push(`[${base}]subtitles=filename='${escaped}'[capped]`);
    base = "capped";
    notes.push("Imported captions are burned into the picture. No caption service wrote them.");
  }
  filters.push(`[${base}]format=yuv420p[vout]`);

  const audioLabels: string[] = [];
  used.forEach((item, index) => {
    if (item.role !== "audio") return;
    const input = index + 2;
    const span = clipSpan(item.clip);
    const fadeIn = Math.min(item.clip.fadeInMs, span) / 1000;
    const fadeOut = Math.min(item.clip.fadeOutMs, span) / 1000;
    const fadeOutStart = Math.max(0, span / 1000 - fadeOut);
    const label = `ac${audioLabels.length}`;
    const volume = Math.max(0, Math.min(1, item.clip.volume * (mix.find((track) => track.id === item.clip.track)?.volume ?? 1)));
    const delay = Math.max(0, Math.round(item.clip.startMs));
    filters.push(
      `[${input}:a]atrim=start=${seconds(item.clip.inMs)}:end=${seconds(item.clip.outMs)},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${volume.toFixed(3)},afade=t=in:st=0:d=${fadeIn.toFixed(3)},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut.toFixed(3)},adelay=${delay}|${delay}[${label}]`,
    );
    audioLabels.push(label);
  });

  if (audioLabels.length === 0) {
    filters.push(`[1:a]atrim=0:${duration},asetpts=PTS-STARTPTS[aout]`);
  } else {
    const mixInputs = ["[1:a]", ...audioLabels.map((label) => `[${label}]`)].join("");
    filters.push(`${mixInputs}amix=inputs=${audioLabels.length + 1}:duration=first:dropout_transition=0:normalize=0[amixed]`);
    filters.push(`[amixed]atrim=0:${duration},asetpts=PTS-STARTPTS[aout]`);
  }

  args.push("-filter_complex", filters.join(";"));
  args.push("-map", "[vout]", "-map", "[aout]");
  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "23");
  args.push("-c:a", "aac", "-b:a", "128k");
  args.push("-muxdelay", "0", "-muxpreload", "0", "-movflags", "+faststart", "-t", duration, outputPath);
  return { args, durationMs, error: "", notes };
}
