import { NextResponse } from "next/server";
import { applyDirectionLocal, isCharacterKind, type DirectorApplyResult, type PlanItem } from "@/lib/director-apply";

export const runtime = "nodejs";

function directorKey() {
  return process.env.DIRECTOR_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
}

function directorBase() {
  return (process.env.DIRECTOR_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
}

function directorModel() {
  return process.env.DIRECTOR_MODEL?.trim() || "gpt-4o-mini";
}

export async function GET() {
  const key = directorKey();
  return NextResponse.json({
    llmConfigured: Boolean(key),
    model: key ? directorModel() : null,
    baseUrl: key ? directorBase() : null,
  });
}

type Body = {
  prompt?: string;
  plan?: PlanItem[];
  existingNames?: string[];
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const plan = Array.isArray(body.plan) ? body.plan : [];
  const key = directorKey();

  if (!key) {
    const local = applyDirectionLocal(prompt, plan);
    return NextResponse.json({ ...local, llmConfigured: false });
  }

  try {
    const result = await callLlm(prompt, plan, Array.isArray(body.existingNames) ? body.existingNames : []);
    return NextResponse.json({ ...result, llmConfigured: true });
  } catch (error) {
    const local = applyDirectionLocal(prompt, plan);
    const reason = error instanceof Error ? error.message : "LLM failed";
    return NextResponse.json({
      ...local,
      reply: `${local.reply} (LLM unavailable: ${reason})`,
      llmConfigured: true,
      llmError: reason,
    });
  }
}

async function callLlm(prompt: string, plan: PlanItem[], existingNames: string[]): Promise<DirectorApplyResult> {
  const system = `You are Studio Director for Global Film Director, a local film studio app.
Return ONLY valid JSON with this shape:
{"reply":"short assistant message","planUpdates":[{"id":"cast|storyboard|camera-plan|music|editable-scene-timeline","detail":"string"}],"characterSeeds":[{"name":"string","kind":"human|animal|creature|other","species":"string","appearance":"optional"}]}
Rules:
- Only fill planUpdates for empty plan items the user should start with; use plan ids exactly.
- Propose 0-6 characterSeeds for humans, animals, or any creatures mentioned.
- Do not invent cloud services. Be concrete and production-useful.
- Existing cast names: ${existingNames.join(", ") || "(none)"}`;

  const apiKey = directorKey();
  if (!apiKey) throw new Error("Director API key missing");

  const response = await fetch(`${directorBase()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: directorModel(),
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify({
            prompt,
            plan: plan.map((item) => ({ id: item.id, label: item.label, detail: item.detail })),
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Director API ${response.status}: ${text.slice(0, 180)}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = payload.choices?.[0]?.message?.content || "{}";
  let parsed: {
    reply?: string;
    planUpdates?: Array<{ id?: string; detail?: string }>;
    characterSeeds?: Array<{ name?: string; kind?: string; species?: string; appearance?: string }>;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("LLM returned non-JSON");
  }

  const planUpdates = (parsed.planUpdates || [])
    .filter((item) => item && typeof item.id === "string" && typeof item.detail === "string")
    .map((item) => ({ id: item.id!, detail: item.detail!.trim() }))
    .filter((item) => item.detail);

  const characterSeeds = (parsed.characterSeeds || [])
    .filter((seed) => seed && typeof seed.name === "string" && seed.name.trim())
    .map((seed) => ({
      name: seed.name!.trim(),
      kind: isCharacterKind(seed.kind) ? seed.kind : ("other" as const),
      species: typeof seed.species === "string" ? seed.species.trim() : "",
      appearance: typeof seed.appearance === "string" ? seed.appearance.trim() : undefined,
    }));

  const local = applyDirectionLocal(prompt, plan);
  const mergedIds = new Set(planUpdates.map((item) => item.id));
  for (const update of local.planUpdates) {
    if (!mergedIds.has(update.id)) {
      planUpdates.push(update);
      mergedIds.add(update.id);
    }
  }

  return {
    reply: (parsed.reply || "Direction applied.").trim(),
    source: "llm",
    planUpdates,
    characterSeeds: characterSeeds.length ? characterSeeds : local.characterSeeds,
  };
}
