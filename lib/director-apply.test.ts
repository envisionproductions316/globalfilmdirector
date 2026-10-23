import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDirectionLocal, extractCharacterSeeds } from "./director-apply.ts";

test("extractCharacterSeeds finds named animals and humans", () => {
  const seeds = extractCharacterSeeds("A wolf named Ash and a human detective called Mira chase a dragon.");
  const names = seeds.map((seed) => seed.name.toLowerCase());
  assert.ok(names.includes("ash") || seeds.some((seed) => seed.species === "wolf"));
  assert.ok(seeds.some((seed) => seed.kind === "animal" || seed.kind === "creature" || seed.kind === "human"));
});

test("applyDirectionLocal fills empty plan fields", () => {
  const plan = [
    { id: "cast", label: "Cast", detail: "" },
    { id: "storyboard", label: "Storyboard", detail: "" },
    { id: "camera-plan", label: "Camera plan", detail: "" },
    { id: "music", label: "Music", detail: "" },
    { id: "editable-scene-timeline", label: "Editable scene timeline", detail: "" },
  ];
  const result = applyDirectionLocal("Cast a wolf named Ash. Cinematic night camera. Tense music score.", plan);
  assert.equal(result.source, "local");
  assert.ok(result.planUpdates.length >= 1);
  assert.ok(result.reply.includes("Studio Director (local)"));
});
