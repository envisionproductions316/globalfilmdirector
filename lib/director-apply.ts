export type PlanItem = {
  id: string;
  label: string;
  detail: string;
};

export type CharacterKind = "human" | "animal" | "creature" | "other";

export type CharacterSeed = {
  name: string;
  kind: CharacterKind;
  species: string;
  appearance?: string;
};

export type DirectorApplyResult = {
  reply: string;
  source: "local" | "llm";
  planUpdates: Array<{ id: string; detail: string }>;
  characterSeeds: CharacterSeed[];
};

const KIND_WORDS: Array<{ kind: CharacterKind; words: string[] }> = [
  { kind: "animal", words: ["wolf", "dog", "cat", "bird", "horse", "dragon", "fox", "bear", "lion", "tiger", "eagle", "raven", "owl", "snake", "fish", "whale", "deer", "rabbit", "crow"] },
  { kind: "creature", words: ["creature", "monster", "alien", "robot", "golem", "spirit", "demon", "angel", "fairy", "orc", "elf", "dwarf", "vampire", "zombie", "android", "mecha"] },
  { kind: "human", words: ["human", "man", "woman", "boy", "girl", "detective", "hero", "villain", "soldier", "pilot", "singer", "actor", "person", "child"] },
];

function detectKind(text: string): { kind: CharacterKind; species: string } {
  const lower = text.toLowerCase();
  for (const entry of KIND_WORDS) {
    for (const word of entry.words) {
      if (new RegExp(`\\b${word}\\b`, "i").test(lower)) {
        if (entry.kind === "human" && ["detective", "hero", "villain", "soldier", "pilot", "singer", "actor"].includes(word)) {
          return { kind: "human", species: word };
        }
        if (entry.kind === "animal" || entry.kind === "creature") {
          return { kind: entry.kind, species: word };
        }
        return { kind: entry.kind, species: "" };
      }
    }
  }
  if (/\banimal\b/i.test(lower)) return { kind: "animal", species: "" };
  if (/\bcreature\b|\bbeing\b/i.test(lower)) return { kind: "creature", species: "" };
  return { kind: "other", species: "" };
}

/** Extract character seeds from free-form director text. */
export function extractCharacterSeeds(text: string): CharacterSeed[] {
  const seeds: CharacterSeed[] = [];
  const seen = new Set<string>();

  const patterns = [
    /(?:a|an|the)\s+([a-z][\w-]*)\s+named\s+([A-Z][\w'-]+)/gi,
    /(?:named|called)\s+([A-Z][\w'-]+)(?:\s*,?\s*(?:a|an|the)\s+([a-z][\w-]*))?/gi,
    /(?:cast|character|creature|animal|being)\s*[:\-]\s*([A-Z][\w'-]+)/gi,
    /([A-Z][\w'-]+)\s+the\s+([a-z][\w-]*)/g,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      let name = "";
      let hint = "";
      if (pattern.source.includes("named\\s+([A-Z]") && match[2]) {
        hint = match[1];
        name = match[2];
      } else if (pattern.source.startsWith("(?:named|called)")) {
        name = match[1];
        hint = match[2] || "";
      } else if (pattern.source.includes("the\\s+")) {
        name = match[1];
        hint = match[2] || "";
      } else {
        name = match[1];
      }
      if (!name || name.length < 2) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const detected = detectKind(`${hint} ${name} ${text.slice(Math.max(0, match.index - 40), match.index + 80)}`);
      seeds.push({
        name,
        kind: detected.kind === "other" && hint ? detectKind(hint).kind : detected.kind,
        species: detected.species || (hint && !/^(a|an|the)$/i.test(hint) ? hint : ""),
        appearance: hint ? `${hint} form` : undefined,
      });
    }
  }

  return seeds.slice(0, 8);
}

function snippetAround(text: string, keywords: string[], max = 160): string {
  const lower = text.toLowerCase();
  for (const word of keywords) {
    const at = lower.indexOf(word);
    if (at < 0) continue;
    const start = Math.max(0, at - 20);
    const end = Math.min(text.length, at + max);
    return text.slice(start, end).replace(/\s+/g, " ").trim();
  }
  return "";
}

/** Fill empty plan details from prompt heuristics; never wipe user-edited details. */
export function applyPlanHeuristics(plan: PlanItem[], text: string): Array<{ id: string; detail: string }> {
  const updates: Array<{ id: string; detail: string }> = [];
  const byId = (id: string, keywords: string[], fallback: string) => {
    const item = plan.find((entry) => entry.id === id);
    if (!item || item.detail.trim()) return;
    const found = snippetAround(text, keywords) || fallback;
    if (found) updates.push({ id, detail: found });
  };

  byId("cast", ["cast", "character", "creature", "animal", "named", "called", "hero", "villain"], text.slice(0, 140));
  byId("storyboard", ["storyboard", "scene", "sequence", "act", "beat", "plot"], snippetAround(text, ["scene", "story", "plot"]) || "Derive scenes from the brief on Storyboard.");
  byId("camera-plan", ["camera", "lens", "shot", "cinematic", "tracking", "close-up", "wide"], snippetAround(text, ["camera", "shot", "cinematic", "lens"]) || "Prefer cinematic framing from the brief.");
  byId("music", ["music", "score", "song", "soundtrack", "audio", "sound"], snippetAround(text, ["music", "score", "song", "sound"]) || "Temp score TBD on Audio.");
  byId("editable-scene-timeline", ["timeline", "edit", "cut", "pace", "pacing", "rhythm"], snippetAround(text, ["pace", "edit", "timeline", "cut"]) || "Assemble takes on Edit after Capture.");

  return updates;
}

export function applyDirectionLocal(text: string, plan: PlanItem[]): DirectorApplyResult {
  const trimmed = text.trim();
  const planUpdates = applyPlanHeuristics(plan, trimmed);
  const characterSeeds = extractCharacterSeeds(trimmed);
  const parts: string[] = [];
  if (planUpdates.length) parts.push(`Updated ${planUpdates.length} plan field${planUpdates.length === 1 ? "" : "s"}`);
  if (characterSeeds.length) {
    parts.push(
      `Proposed ${characterSeeds.length} being${characterSeeds.length === 1 ? "" : "s"}: ${characterSeeds
        .map((seed) => `${seed.name} (${seed.kind}${seed.species ? ` · ${seed.species}` : ""})`)
        .join(", ")}`,
    );
  }
  if (!parts.length) parts.push("Saved your direction on this device. Add cast on Characters or refine the plan in the inspector.");
  return {
    reply: `Studio Director (local): ${parts.join(". ")}.`,
    source: "local",
    planUpdates,
    characterSeeds,
  };
}

export function mergePlanUpdates(plan: PlanItem[], updates: Array<{ id: string; detail: string }>): PlanItem[] {
  if (!updates.length) return plan;
  return plan.map((item) => {
    const hit = updates.find((update) => update.id === item.id);
    if (!hit || !hit.detail.trim()) return item;
    if (item.detail.trim()) return item;
    return { ...item, detail: hit.detail.trim() };
  });
}

export function isCharacterKind(value: unknown): value is CharacterKind {
  return value === "human" || value === "animal" || value === "creature" || value === "other";
}

export const CHARACTER_KINDS: CharacterKind[] = ["human", "animal", "creature", "other"];
