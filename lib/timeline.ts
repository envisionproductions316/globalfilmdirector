export const TRACK_IDS = ["video", "motion", "dialogue", "voice", "music", "sfx", "captions"] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export const TRACK_META: { id: TrackId; label: string; color: string; kind: "video" | "audio" | "caption" | "note" }[] = [
  { id: "video", label: "Video", color: "#3478f6", kind: "video" },
  { id: "motion", label: "Character motion", color: "#23b7a5", kind: "note" },
  { id: "dialogue", label: "Dialogue", color: "#7258b0", kind: "audio" },
  { id: "voice", label: "Lead vocal", color: "#9b7741", kind: "audio" },
  { id: "music", label: "Music", color: "#4386b1", kind: "audio" },
  { id: "sfx", label: "SFX", color: "#3478f6", kind: "audio" },
  { id: "captions", label: "Captions", color: "#23b7a5", kind: "caption" },
];

export type TimelineClip = {
  id: string;
  projectId: string;
  track: TrackId;
  mediaId: string;
  takeId: string;
  sceneId: string;
  shotId: string;
  characterId: string;
  name: string;
  startMs: number;
  inMs: number;
  outMs: number;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
  groupId: string;
  text: string;
};

export type TrackMix = {
  id: TrackId;
  muted: boolean;
  solo: boolean;
  volume: number;
};

export type AssetRecord = {
  id: string;
  projectId: string;
  name: string;
  mime: string;
  bytes: number;
  durationMs: number;
  hasVideo: boolean;
  hasAudio: boolean;
  kind: "import" | "narration";
  createdAt: string;
};

export type MediaShape = { hasVideo: boolean; hasAudio: boolean };

const LEGACY_TRACKS: Record<string, TrackId> = {
  Dialogue: "dialogue",
  "Lead vocal": "voice",
  Harmony: "voice",
  Instrumental: "music",
  "Sound FX": "sfx",
  Ambience: "sfx",
  Captions: "captions",
  Video: "video",
};

export function defaultMix(): TrackMix[] {
  return TRACK_META.map((track) => ({ id: track.id, muted: false, solo: false, volume: 1 }));
}

export function clipSpan(clip: Pick<TimelineClip, "inMs" | "outMs">) {
  return Math.max(0, clip.outMs - clip.inMs);
}

export function clipEnd(clip: Pick<TimelineClip, "startMs" | "inMs" | "outMs">) {
  return clip.startMs + clipSpan(clip);
}

export function timelineDuration(clips: TimelineClip[]) {
  return clips.reduce((max, clip) => Math.max(max, clipEnd(clip)), 0);
}

export function pictureDuration(clips: TimelineClip[]) {
  return timelineDuration(clips.filter((clip) => clip.track === "video"));
}

export function trackMeta(track: TrackId) {
  return TRACK_META.find((item) => item.id === track) ?? TRACK_META[0];
}

export function trackAccepts(track: TrackId, media: MediaShape) {
  const meta = trackMeta(track);
  if (meta.kind === "note" || meta.kind === "caption") return false;
  if (meta.kind === "video") return media.hasVideo;
  return media.hasAudio || media.hasVideo;
}

export function endOfTrack(clips: TimelineClip[], track: TrackId) {
  return timelineDuration(clips.filter((clip) => clip.track === track));
}

/** Timeline edit quantum (~24 fps). Used for keyboard frame nudges. */
export const FRAME_MS = 40;

export const ZOOM_MIN = 16;
export const ZOOM_MAX = 240;

export function formatTimecode(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

/** Seconds with hundredths for trim/position fields. */
export function formatSeconds(ms: number) {
  return (Math.max(0, ms) / 1000).toFixed(2);
}

export function secondsToMs(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 1000)) : 0;
}

export function snapMs(ms: number, gridMs = 100) {
  if (gridMs <= 0) return Math.round(ms);
  return Math.round(ms / gridMs) * gridMs;
}

export function clampZoom(pixels: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(pixels)));
}

function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function splitClip(clip: TimelineClip, playheadMs: number, nextId: string): [TimelineClip, TimelineClip] | null {
  const local = playheadMs - clip.startMs;
  const span = clipSpan(clip);
  if (local < 40 || local > span - 40) return null;
  const cut = clip.inMs + local;
  return [
    { ...clip, outMs: cut, fadeOutMs: 0 },
    { ...clip, id: nextId, name: `${clip.name} split`, startMs: playheadMs, inMs: cut, fadeInMs: 0 },
  ];
}

export function moveClip(clip: TimelineClip, startMs: number, track: TrackId, media: MediaShape): TimelineClip | null {
  if (!trackAccepts(track, media)) return null;
  return { ...clip, startMs: Math.max(0, Math.round(startMs)), track };
}

export function trimClip(clip: TimelineClip, edge: "in" | "out", sourceMs: number, mediaDurationMs: number): TimelineClip {
  const limit = Math.max(clip.outMs, mediaDurationMs);
  if (edge === "in") {
    const inMs = clamp(Math.round(sourceMs), 0, clip.outMs - 40);
    return { ...clip, inMs, startMs: Math.max(0, clip.startMs + (inMs - clip.inMs)) };
  }
  return { ...clip, outMs: clamp(Math.round(sourceMs), clip.inMs + 40, limit) };
}

export function nudgeClip(clips: TimelineClip[], id: string, direction: -1 | 1): TimelineClip[] {
  const clip = clips.find((item) => item.id === id);
  if (!clip) return clips;
  const ordered = clips.filter((item) => item.track === clip.track).sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
  const index = ordered.findIndex((item) => item.id === id);
  const neighbor = ordered[index + direction];
  if (!neighbor) return clips;
  return clips.map((item) => {
    if (item.id === clip.id) return { ...item, startMs: neighbor.startMs };
    if (item.id === neighbor.id) return { ...item, startMs: clip.startMs };
    return item;
  });
}

export function audible(clip: TimelineClip, mix: TrackMix[]) {
  const track = mix.find((item) => item.id === clip.track);
  const meta = trackMeta(clip.track);
  if (!track || meta.kind !== "audio") return false;
  const soloed = mix.some((item) => item.solo && trackMeta(item.id).kind === "audio");
  if (soloed && !track.solo) return false;
  if (track.muted || track.volume <= 0 || clip.volume <= 0) return false;
  return true;
}

export function gainAt(clip: TimelineClip, timelineMs: number, mix: TrackMix[]) {
  if (!audible(clip, mix)) return 0;
  const track = mix.find((item) => item.id === clip.track);
  if (!track) return 0;
  const local = timelineMs - clip.startMs;
  const span = clipSpan(clip);
  if (local < 0 || local > span) return 0;
  let envelope = 1;
  if (clip.fadeInMs > 0 && local < clip.fadeInMs) envelope = local / clip.fadeInMs;
  const fadeStart = span - clip.fadeOutMs;
  if (clip.fadeOutMs > 0 && local > fadeStart) envelope = Math.max(0, (span - local) / clip.fadeOutMs);
  return clamp(clip.volume * track.volume * envelope, 0, 1);
}

export function resolveTrack(value: string | undefined): TrackId {
  if (!value) return "dialogue";
  if (TRACK_IDS.includes(value as TrackId)) return value as TrackId;
  return LEGACY_TRACKS[value] ?? "dialogue";
}

export function completeClip(clip: Partial<TimelineClip>, projectId: string): TimelineClip | null {
  if (!clip.id) return null;
  const track = clip.track && (TRACK_IDS.includes(clip.track) || LEGACY_TRACKS[clip.track]) ? resolveTrack(clip.track) : null;
  if (!track || track === "motion") return null;
  const text = clip.text || "";
  if (track === "captions" && !text.trim()) return null;
  if (track !== "captions" && !clip.mediaId) return null;
  const inMs = Math.max(0, finite(clip.inMs, 0));
  const outMs = Math.max(inMs + 40, finite(clip.outMs, inMs + 1000));
  return {
    id: clip.id,
    projectId: clip.projectId || projectId,
    track,
    mediaId: clip.mediaId || `caption:${clip.id}`,
    takeId: clip.takeId || "",
    sceneId: clip.sceneId || "",
    shotId: clip.shotId || "",
    characterId: clip.characterId || "",
    name: clip.name || (text ? "Caption" : "Clip"),
    startMs: Math.max(0, finite(clip.startMs, 0)),
    inMs,
    outMs,
    volume: clamp(finite(clip.volume, 1), 0, 1),
    fadeInMs: Math.max(0, finite(clip.fadeInMs, 0)),
    fadeOutMs: Math.max(0, finite(clip.fadeOutMs, 0)),
    groupId: clip.groupId || "",
    text,
  };
}

export function completeMix(mix: Partial<TrackMix>[] | undefined): TrackMix[] {
  const incoming = Array.isArray(mix) ? mix : [];
  return defaultMix().map((track) => {
    const found = incoming.find((item) => item.id === track.id);
    if (!found) return track;
    return {
      id: track.id,
      muted: Boolean(found.muted),
      solo: Boolean(found.solo),
      volume: clamp(finite(found.volume, 1), 0, 1),
    };
  });
}

export function completeAsset(asset: Partial<AssetRecord>, projectId: string): AssetRecord | null {
  if (!asset.id) return null;
  return {
    id: asset.id,
    projectId: asset.projectId || projectId,
    name: asset.name || "Imported media",
    mime: asset.mime || "application/octet-stream",
    bytes: Math.max(0, finite(asset.bytes, 0)),
    durationMs: Math.max(0, finite(asset.durationMs, 0)),
    hasVideo: Boolean(asset.hasVideo),
    hasAudio: Boolean(asset.hasAudio),
    kind: asset.kind === "narration" ? "narration" : "import",
    createdAt: asset.createdAt || "",
  };
}

const IMPORT_TYPES = ["video/mp4", "video/webm", "video/quicktime", "audio/mpeg", "audio/wav", "audio/wave", "audio/x-wav", "audio/mp4", "audio/webm", "audio/ogg", "audio/aac", "audio/flac", "audio/x-m4a"];

export function clipsForSource(
  existing: TimelineClip[],
  source: {
    projectId: string;
    mediaId: string;
    takeId: string;
    sceneId: string;
    shotId: string;
    characterId: string;
    name: string;
    durationMs: number;
    hasVideo: boolean;
    hasAudio: boolean;
    track?: TrackId;
    newId: () => string;
  },
): { clips: TimelineClip[]; error: string } {
  const duration = Math.max(40, source.durationMs || 0);
  const track = source.track ?? (source.hasVideo ? "video" : source.hasAudio ? "music" : "video");
  if (!trackAccepts(track, { hasVideo: source.hasVideo, hasAudio: source.hasAudio })) {
    return { clips: [], error: "That track cannot hold this file. Character motion and captions stay empty." };
  }
  if (source.takeId && existing.some((clip) => clip.takeId === source.takeId && clip.track === track)) {
    return { clips: [], error: "This take is already on that track." };
  }
  const startMs = endOfTrack(existing, track);
  const linked = track === "video" && source.hasAudio && !(source.takeId && existing.some((clip) => clip.takeId === source.takeId && clip.track === "dialogue"));
  const groupId = linked ? source.newId() : "";
  const first: TimelineClip = {
    id: source.newId(),
    projectId: source.projectId,
    track,
    mediaId: source.mediaId,
    takeId: source.takeId,
    sceneId: source.sceneId,
    shotId: source.shotId,
    characterId: source.characterId,
    name: source.name,
    startMs,
    inMs: 0,
    outMs: Math.max(40, duration),
    volume: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
    groupId,
    text: "",
  };
  const created = [first];
  if (linked) created.push({ ...first, id: source.newId(), track: "dialogue" });
  return { clips: created, error: "" };
}

export function groupMembers(clips: TimelineClip[], clip: TimelineClip) {
  if (!clip.groupId) return [clip];
  const members = clips.filter((item) => item.groupId === clip.groupId);
  return members.length > 0 ? members : [clip];
}

export function moveGroup(clips: TimelineClip[], id: string, startMs: number, track: TrackId, media: MediaShape) {
  const clip = clips.find((item) => item.id === id);
  if (!clip) return { clips, error: "That clip is not on this timeline." };
  const nextStart = Math.max(0, Math.round(startMs));
  const moved = clip.track === "captions"
    ? track === "captions" ? { ...clip, startMs: nextStart } : null
    : moveClip(clip, nextStart, track, media);
  if (!moved) {
    return {
      clips,
      error: clip.track === "captions"
        ? "Captions stay on the captions track."
        : "That track cannot hold this clip. Character motion has no retargeted media.",
    };
  }
  const delta = moved.startMs - clip.startMs;
  const members = new Set(groupMembers(clips, clip).map((item) => item.id));
  return {
    error: "",
    clips: clips.map((item) => {
      if (item.id === id) return moved;
      if (members.has(item.id)) return { ...item, startMs: Math.max(0, item.startMs + delta) };
      return item;
    }),
  };
}

export function trimGroup(clips: TimelineClip[], id: string, edge: "in" | "out", sourceMs: number, mediaDurationMs: number) {
  const clip = clips.find((item) => item.id === id);
  if (!clip || !Number.isFinite(sourceMs)) return clips;
  const next = trimClip(clip, edge, sourceMs, mediaDurationMs);
  const members = new Set(groupMembers(clips, clip).map((item) => item.id));
  const inDelta = next.inMs - clip.inMs;
  const outDelta = next.outMs - clip.outMs;
  const startDelta = next.startMs - clip.startMs;
  return clips.map((item) => {
    if (item.id === id) return next;
    if (!members.has(item.id)) return item;
    const inMs = Math.max(0, item.inMs + inDelta);
    return { ...item, inMs, outMs: Math.max(inMs + 40, item.outMs + outDelta), startMs: Math.max(0, item.startMs + startDelta) };
  });
}

export function splitGroup(clips: TimelineClip[], id: string, playheadMs: number, nextIds: string[]) {
  const clip = clips.find((item) => item.id === id);
  if (!clip) return null;
  const members = groupMembers(clips, clip);
  const rightGroup = clip.groupId ? nextIds[0] || `${clip.groupId}-b` : "";
  let cursor = 1;
  const replacements = new Map<string, TimelineClip[]>();
  for (const member of members) {
    const parts = splitClip(member, playheadMs, nextIds[cursor] || `${member.id}-b`);
    cursor += 1;
    if (!parts) continue;
    replacements.set(member.id, [
      { ...parts[0], groupId: member.groupId, text: member.text },
      { ...parts[1], groupId: rightGroup, text: member.text },
    ]);
  }
  if (!replacements.has(id)) return null;
  return clips.flatMap((item) => replacements.get(item.id) ?? [item]);
}

export function nudgeGroup(clips: TimelineClip[], id: string, direction: -1 | 1) {
  const clip = clips.find((item) => item.id === id);
  if (!clip) return clips;
  const ordered = clips.filter((item) => item.track === clip.track).sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
  const index = ordered.findIndex((item) => item.id === id);
  const neighbor = ordered[index + direction];
  if (!neighbor) return clips;
  const delta = neighbor.startMs - clip.startMs;
  const from = new Set(groupMembers(clips, clip).map((item) => item.id));
  const to = new Set(groupMembers(clips, neighbor).map((item) => item.id));
  return clips.map((item) => {
    if (from.has(item.id)) return { ...item, startMs: Math.max(0, item.startMs + delta) };
    if (to.has(item.id)) return { ...item, startMs: Math.max(0, item.startMs - delta) };
    return item;
  });
}

export function fitGroupToPicture(clips: TimelineClip[], id: string) {
  const picture = pictureDuration(clips);
  const clip = clips.find((item) => item.id === id);
  if (!clip || picture <= 0) return clips;
  const members = new Set(groupMembers(clips, clip).map((item) => item.id));
  return clips.map((item) => {
    if (!members.has(item.id)) return item;
    const overflow = clipEnd(item) - picture;
    if (overflow <= 250) return item;
    return { ...item, outMs: Math.max(item.inMs + 40, item.outMs - overflow) };
  });
}

/** Holes shorter than this are ignored (trim jitter / frame quantum). */
export const GAP_MIN_MS = 100;

export type TimelineGap = {
  track: TrackId;
  startMs: number;
  endMs: number;
  /** Clip ending just before the hole, or empty for a leading gap. */
  afterClipId: string;
  /** Clip that begins after the hole. */
  beforeClipId: string;
};

export function findTrackGaps(clips: TimelineClip[], track: TrackId, minGapMs = GAP_MIN_MS): TimelineGap[] {
  const ordered = clips
    .filter((clip) => clip.track === track)
    .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
  const gaps: TimelineGap[] = [];
  let cursor = 0;
  let prevId = "";
  for (const clip of ordered) {
    if (clip.startMs > cursor + minGapMs) {
      gaps.push({
        track,
        startMs: cursor,
        endMs: clip.startMs,
        afterClipId: prevId,
        beforeClipId: clip.id,
      });
    }
    cursor = Math.max(cursor, clipEnd(clip));
    prevId = clip.id;
  }
  return gaps;
}

export function gapSpan(gap: Pick<TimelineGap, "startMs" | "endMs">) {
  return Math.max(0, gap.endMs - gap.startMs);
}

/**
 * Pack clips on a track left to remove holes. Linked group members (e.g. dialogue
 * tied to video) shift by the same delta so A/V stay together. Sources are not rewritten.
 */
export function closeTrackGaps(clips: TimelineClip[], track: TrackId, minGapMs = GAP_MIN_MS): TimelineClip[] {
  const ordered = clips
    .filter((clip) => clip.track === track)
    .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
  if (ordered.length === 0) return clips;

  const deltaById = new Map<string, number>();
  let cursor = 0;
  let changed = false;
  for (const clip of ordered) {
    const hasGap = clip.startMs > cursor + minGapMs;
    const nextStart = hasGap ? cursor : clip.startMs;
    const delta = nextStart - clip.startMs;
    if (delta !== 0) {
      changed = true;
      for (const member of groupMembers(clips, clip)) {
        deltaById.set(member.id, (deltaById.get(member.id) ?? 0) + delta);
      }
    }
    cursor = nextStart + clipSpan(clip);
  }
  if (!changed) return clips;
  return clips.map((clip) => {
    const delta = deltaById.get(clip.id);
    if (!delta) return clip;
    return { ...clip, startMs: Math.max(0, clip.startMs + delta) };
  });
}

export function importAllowed(mime: string, name: string) {
  const type = mime.toLowerCase();
  if (IMPORT_TYPES.some((prefix) => type.startsWith(prefix))) return true;
  return /\.(mp4|webm|mov|mp3|wav|m4a|ogg|aac|flac)$/i.test(name);
}
