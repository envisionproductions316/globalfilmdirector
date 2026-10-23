import assert from "node:assert/strict";
import test from "node:test";
import { continuityWarnings } from "./continuity.ts";
import { buildExportPlan } from "./export-plan.ts";
import { parseCaptions } from "./captions.ts";
import { audible, clampZoom, closeTrackGaps, completeClip, findTrackGaps, formatSeconds, gainAt, gapSpan, nudgeClip, nudgeGroup, secondsToMs, snapMs, splitClip, timelineDuration, trimClip, trimGroup, type TimelineClip, type TrackMix } from "./timeline.ts";

function clip(patch: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: "clip-a",
    projectId: "p1",
    track: "video",
    mediaId: "media-a",
    takeId: "take-a",
    sceneId: "scene-1",
    shotId: "shot-1",
    characterId: "max",
    name: "Opening",
    startMs: 0,
    inMs: 0,
    outMs: 2000,
    volume: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
    groupId: "",
    text: "",
    ...patch,
  };
}

const openMix: TrackMix[] = [
  { id: "video", muted: false, solo: false, volume: 1 },
  { id: "motion", muted: false, solo: false, volume: 1 },
  { id: "dialogue", muted: false, solo: false, volume: 1 },
  { id: "voice", muted: false, solo: false, volume: 1 },
  { id: "music", muted: false, solo: false, volume: 1 },
  { id: "sfx", muted: false, solo: false, volume: 1 },
  { id: "captions", muted: false, solo: false, volume: 1 },
];

test("split, trim, and reorder keep the source span non-destructive", () => {
  const [left, right] = splitClip(clip(), 1000, "clip-b") ?? [];
  assert.equal(left?.outMs, 1000);
  assert.equal(right?.inMs, 1000);
  assert.equal(right?.startMs, 1000);
  assert.equal(timelineDuration([left, right].filter(Boolean) as TimelineClip[]), 2000);

  const trimmed = trimClip(clip(), "out", 1500, 2000);
  assert.equal(trimmed.outMs, 1500);
  assert.equal(trimmed.mediaId, "media-a");

  const second = clip({ id: "clip-b", name: "Second", startMs: 2000 });
  const nudged = nudgeClip([clip(), second], "clip-a", 1);
  assert.equal(nudged.find((item) => item.id === "clip-a")?.startMs, 2000);
  assert.equal(nudged.find((item) => item.id === "clip-b")?.startMs, 0);
});

test("mute, solo, and fades change mix gain without rewriting the clip", () => {
  const dialogue = clip({ id: "voice-a", track: "dialogue", name: "Line" });
  assert.equal(audible(dialogue, openMix), true);
  const muted = openMix.map((track) => (track.id === "dialogue" ? { ...track, muted: true } : track));
  assert.equal(audible(dialogue, muted), false);
  const soloMusic = openMix.map((track) => (track.id === "music" ? { ...track, solo: true } : track));
  assert.equal(audible(dialogue, soloMusic), false);
  const faded = clip({ track: "music", fadeInMs: 1000, outMs: 2000 });
  assert.ok(gainAt(faded, 0, openMix) < 0.05);
  assert.ok(gainAt(faded, 1000, openMix) > 0.95);
});

test("migration drops empty caption and motion clips and keeps caption text", () => {
  assert.equal(completeClip({ id: "x", mediaId: "m", track: "captions" }, "p1"), null);
  assert.equal(completeClip({ id: "motion", mediaId: "m", track: "motion" }, "p1"), null);
  const caption = completeClip({ id: "cap", track: "captions", text: "Hello", startMs: 500, outMs: 1000 }, "p1");
  assert.equal(caption?.text, "Hello");
  assert.equal(caption?.mediaId, "caption:cap");
  const kept = completeClip({ id: "x", mediaId: "m", track: "dialogue", name: "Kept", outMs: 800 }, "p1");
  assert.equal(kept?.name, "Kept");
  assert.equal(kept?.outMs, 800);
});

test("continuity reports timeline gaps without changing approvals", () => {
  const warnings = continuityWarnings({
    projectId: "p1",
    projectTitle: "Untitled production",
    characters: [{ id: "max", name: "Max" }],
    scenes: [
      {
        id: "scene-1",
        projectId: "p1",
        title: "Opening",
        status: "Needs review",
        characterIds: ["max"],
        description: "",
        location: "City",
        timeOfDay: "Day",
        dialogue: "",
        action: "",
        camera: "Wide",
        movement: "",
        music: "",
        duration: "",
        approvedFingerprint: "",
      },
    ],
    shots: [],
    takes: [],
    mediaIds: new Set(["media-a"]),
    mediaReady: true,
    clips: [
      clip({ sceneId: "scene-1" }),
      clip({
        id: "music-late",
        track: "music",
        name: "Cue",
        takeId: "missing-take",
        mediaId: "missing-media",
        startMs: 0,
        outMs: 4000,
      }),
    ],
  });
  const kinds = warnings.map((warning) => warning.kind).sort();
  assert.ok(kinds.includes("unapproved-scene"));
  assert.ok(kinds.includes("clip-take"));
  assert.ok(kinds.includes("clip-media"));
  assert.ok(kinds.includes("audio-overrun"));
});

test("export plan trims, honors mute, and refuses a timeline with no picture", () => {
  const video = clip();
  const music = clip({
    id: "music",
    track: "music",
    mediaId: "song",
    name: "Theme",
    volume: 0.5,
    fadeInMs: 200,
    fadeOutMs: 200,
  });
  const muted = openMix.map((track) => (track.id === "music" ? { ...track, muted: true } : track));
  const plan = buildExportPlan(
    [video, music],
    muted,
    [
      { mediaId: "media-a", path: "a.mp4", hasVideo: true, hasAudio: true },
      { mediaId: "song", path: "song.m4a", hasVideo: false, hasAudio: true },
    ],
    "out.mp4",
  );
  assert.equal(plan.error, "");
  const filter = plan.args[plan.args.indexOf("-filter_complex") + 1];
  assert.match(filter, /trim=start=0.000:end=2.000/);
  assert.equal(filter.includes("song"), false);
  assert.ok(plan.args.includes("libx264"));
  assert.ok(plan.args.includes("aac"));
  const refused = buildExportPlan([music], openMix, [{ mediaId: "song", path: "song.m4a", hasVideo: false, hasAudio: true }], "out.mp4");
  assert.match(refused.error, /no video clips/i);
  assert.ok(plan.args.includes("-muxdelay"));
});

test("linked picture and dialogue trim and reorder together", () => {
  const picture = clip({ groupId: "pair" });
  const dialogue = clip({ id: "dialogue-a", track: "dialogue", groupId: "pair", name: "Line" });
  const trimmed = trimGroup([picture, dialogue], "clip-a", "out", 1000, 2000);
  assert.equal(trimmed.find((item) => item.id === "clip-a")?.outMs, 1000);
  assert.equal(trimmed.find((item) => item.id === "dialogue-a")?.outMs, 1000);
  const later = clip({ id: "clip-b", name: "Second", startMs: 2000, groupId: "second" });
  const laterLine = clip({ id: "dialogue-b", track: "dialogue", name: "Second line", startMs: 2000, groupId: "second" });
  const nudged = nudgeGroup([picture, dialogue, later, laterLine], "clip-a", 1);
  assert.equal(nudged.find((item) => item.id === "clip-a")?.startMs, 2000);
  assert.equal(nudged.find((item) => item.id === "dialogue-a")?.startMs, 2000);
  assert.equal(nudged.find((item) => item.id === "clip-b")?.startMs, 0);
  assert.equal(nudged.find((item) => item.id === "dialogue-b")?.startMs, 0);
});

test("caption import and export burn-in use the cue text", () => {
  const cues = parseCaptions("1\n00:00:01,000 --> 00:00:02,500\nHello there\n");
  assert.equal(cues.length, 1);
  assert.equal(cues[0]?.startMs, 1000);
  assert.equal(cues[0]?.text, "Hello there");
  const plan = buildExportPlan(
    [clip(), clip({ id: "cap", track: "captions", mediaId: "caption:cap", text: "Hello there", startMs: 1000, inMs: 0, outMs: 1500 })],
    openMix,
    [{ mediaId: "media-a", path: "a.mp4", hasVideo: true, hasAudio: false }],
    "out.mp4",
    "C:\\temp\\captions.srt",
  );
  const filter = plan.args[plan.args.indexOf("-filter_complex") + 1];
  assert.match(filter, /subtitles=filename=/);
  assert.match(plan.notes.join(" "), /burned into the picture/);
});

test("snap, seconds fields, and zoom clamp support adjustable timeline UI", () => {
  assert.equal(snapMs(148, 100), 100);
  assert.equal(snapMs(151, 100), 200);
  assert.equal(formatSeconds(1500), "1.50");
  assert.equal(secondsToMs("2.04"), 2040);
  assert.equal(clampZoom(10), 16);
  assert.equal(clampZoom(400), 240);
  assert.equal(clampZoom(48), 48);
});

test("picture gaps are detected and close packs left with linked dialogue", () => {
  const first = clip({ id: "v1", startMs: 0, outMs: 1000, groupId: "g1" });
  const dialogue = clip({ id: "d1", track: "dialogue", startMs: 0, outMs: 1000, groupId: "g1", mediaId: "media-a" });
  const second = clip({ id: "v2", name: "Second", startMs: 2500, outMs: 1000, groupId: "g2" });
  const dialogue2 = clip({ id: "d2", track: "dialogue", name: "Line 2", startMs: 2500, outMs: 1000, groupId: "g2", mediaId: "media-b" });
  const gaps = findTrackGaps([first, dialogue, second, dialogue2], "video");
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]?.startMs, 1000);
  assert.equal(gaps[0]?.endMs, 2500);
  assert.equal(gapSpan(gaps[0]!), 1500);

  const packed = closeTrackGaps([first, dialogue, second, dialogue2], "video");
  assert.equal(findTrackGaps(packed, "video").length, 0);
  assert.equal(packed.find((item) => item.id === "v2")?.startMs, 1000);
  assert.equal(packed.find((item) => item.id === "d2")?.startMs, 1000);
  assert.equal(packed.find((item) => item.id === "v1")?.startMs, 0);
});

test("continuity warns on picture gaps without rewriting clips", () => {
  const warnings = continuityWarnings({
    projectId: "p1",
    projectTitle: "Gap film",
    characters: [{ id: "max", name: "Max" }],
    scenes: [],
    shots: [],
    takes: [],
    mediaIds: new Set(["media-a"]),
    mediaReady: true,
    clips: [
      clip({ id: "v1", startMs: 0, outMs: 1000 }),
      clip({ id: "v2", name: "Later", startMs: 3000, outMs: 1000 }),
    ],
  });
  const gap = warnings.find((warning) => warning.kind === "timeline-gap");
  assert.ok(gap);
  assert.match(gap!.message, /1 gap/);
  assert.match(gap!.message, /2/);
});
