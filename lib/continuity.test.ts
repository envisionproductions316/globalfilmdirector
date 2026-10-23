import assert from "node:assert/strict";
import test from "node:test";
import { continuityWarnings, sceneFingerprint, type ContinuityScene } from "./continuity.ts";

function scene(patch: Partial<ContinuityScene> = {}): ContinuityScene {
  const base: ContinuityScene = {
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
    music: "Pending",
    duration: "",
    approvedFingerprint: "",
  };
  return { ...base, ...patch };
}

test("approved scenes stay clean until a field changes", () => {
  const current = scene({ status: "Approved" });
  current.approvedFingerprint = sceneFingerprint(current);
  const warnings = continuityWarnings({
    projectId: "p1",
    characters: [{ id: "max", name: "Max" }],
    scenes: [current],
    shots: [{ id: "shot-1", projectId: "p1", label: "Shot 1", sceneId: "scene-1" }],
    takes: [],
    mediaIds: new Set(),
    mediaReady: true,
  });
  assert.equal(warnings.length, 0);

  const edited = { ...current, title: "Opening revised" };
  const after = continuityWarnings({
    projectId: "p1",
    characters: [{ id: "max", name: "Max" }],
    scenes: [edited],
    shots: [{ id: "shot-1", projectId: "p1", label: "Shot 1", sceneId: "scene-1" }],
    takes: [],
    mediaIds: new Set(),
    mediaReady: true,
  });
  assert.equal(after.some((warning) => warning.kind === "approved-modified"), true);
});

test("missing character, shot, cast, and media are reported separately", () => {
  const warnings = continuityWarnings({
    projectId: "p1",
    characters: [{ id: "max", name: "Max" }, { id: "sam", name: "Sam" }],
    scenes: [scene()],
    shots: [{ id: "shot-2", projectId: "p1", label: "Shot 2", sceneId: "" }],
    takes: [
      { id: "take-a", projectId: "p1", name: "Sam take", characterId: "sam", sceneId: "scene-1", mediaId: "media-a" },
      { id: "take-b", projectId: "p1", name: "Missing character take", characterId: "bella", sceneId: "missing-scene", mediaId: "media-b" },
    ],
    mediaIds: new Set(["media-b"]),
    mediaReady: true,
  });
  const kinds = warnings.map((warning) => warning.kind).sort();
  assert.deepEqual(kinds, ["missing-media", "shot-scene", "take-cast", "take-character", "take-scene"]);
});
