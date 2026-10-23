"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BackupControl } from "@/components/backup/BackupControl";
import { Pipeline } from "@/components/ui/Pipeline";
import { projectTitleFromPrompt, useStudio } from "@/lib/studio";

const KINDS = ["Feature", "Music video", "Documentary", "Animation", "Draft"] as const;

export function ProjectsWorkspace() {
  const studio = useStudio();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("Feature");
  const [message, setMessage] = useState("");

  const castCount = studio.characters.length;
  const takeCount = studio.takes.length;
  const clipCount = studio.clips.length;

  function createProduction() {
    const raw = prompt;
    const error = studio.createProject(raw, kind);
    if (error) {
      setMessage(error);
      return;
    }
    const title = projectTitleFromPrompt(raw) || "Untitled production";
    setPrompt("");
    setMessage(`“${title}” is ready. Shape it in Director next.`);
    studio.setAssetCategory("characters");
    router.push("/director");
  }

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">01 · Projects & Create</h1>
      <p className="mt-2 text-[15px] text-muted">Start a movie, music video, documentary, or animation on this device</p>

      <article className="mt-5 min-h-[430px] rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">New Production</h2>
        <p className="mt-4 mb-4 text-[25px] font-bold">What would you like to create?</p>

        <fieldset className="m-0 border-0 p-0">
          <legend className="sr-only">Production kind</legend>
          <div className="mb-4 flex flex-wrap gap-2">
            {KINDS.map((item) => (
              <button
                key={item}
                type="button"
                data-testid={`kind-${item.toLowerCase().replace(/\s+/g, "-")}`}
                className={`h-9 rounded-[7px] px-3 text-[13px] ${kind === item ? "bg-accent font-bold text-on-accent" : "bg-inset text-ink"}`}
                onClick={() => setKind(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block min-h-[116px] rounded-[9px] bg-inset px-4 py-7">
          <span className="sr-only">Production description</span>
          <textarea
            className="min-h-16 w-full resize-y bg-transparent text-base text-ink outline-none placeholder:text-muted"
            placeholder="Describe the film in a sentence or two…"
            value={prompt}
            data-testid="project-prompt"
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                createProduction();
              }
            }}
          />
        </label>
        <p className="mt-2 text-xs text-muted">Tip: Ctrl+Enter (or ⌘+Enter) creates the production and opens Director. Shape the brief, then cast any creatures on Characters.</p>

        <button
          type="button"
          className="mt-5 h-9 w-[210px] rounded-[7px] bg-accent text-[13px] font-bold text-on-accent"
          data-testid="create-production"
          onClick={createProduction}
        >
          Create production
        </button>

        <div className="mt-5 rounded-[9px] bg-inset px-4 py-3">
          <p className="m-0 text-sm font-bold">Active: {studio.activeProject.title}</p>
          <p className="mt-1 text-[13px] text-muted">
            {`${studio.activeProject.kind} · ${castCount} character${castCount === 1 ? "" : "s"} · ${takeCount} take${takeCount === 1 ? "" : "s"} · ${clipCount} clip${clipCount === 1 ? "" : "s"}`}
          </p>
          <p className="mt-3 text-[13px] text-muted">Next step for this project</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {castCount === 0 ? (
              <Link
                href="/characters"
                className="inline-flex h-9 items-center rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent"
                data-testid="home-next-characters"
                onClick={() => studio.setAssetCategory("characters")}
              >
                Continue to Characters
              </Link>
            ) : takeCount === 0 ? (
              <Link
                href="/capture"
                className="inline-flex h-9 items-center rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent"
                data-testid="home-next-capture"
                onClick={() => studio.setAssetCategory("characters")}
              >
                Record on Capture
              </Link>
            ) : clipCount === 0 ? (
              <Link
                href="/edit"
                className="inline-flex h-9 items-center rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent"
                data-testid="home-next-edit"
                onClick={() => studio.setAssetCategory("media")}
              >
                Place takes in Edit
              </Link>
            ) : (
              <Link href="/export" className="inline-flex h-9 items-center rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent" data-testid="home-next-export">
                Export film ({clipCount})
              </Link>
            )}
            <Link href="/director" className="inline-flex h-9 items-center rounded-[7px] bg-card px-4 text-[13px] text-ink" data-testid="home-director">
              Write direction
            </Link>
            {castCount > 0 && takeCount > 0 ? (
              <Link
                href="/characters"
                className="inline-flex h-9 items-center rounded-[7px] bg-card px-4 text-[13px] text-ink"
                onClick={() => studio.setAssetCategory("characters")}
              >
                Characters
              </Link>
            ) : null}
            {castCount > 0 && takeCount === 0 ? (
              <Link
                href="/characters"
                className="inline-flex h-9 items-center rounded-[7px] bg-card px-4 text-[13px] text-ink"
                onClick={() => studio.setAssetCategory("characters")}
              >
                Edit cast
              </Link>
            ) : null}
            {clipCount > 0 ? (
              <Link
                href="/edit"
                className="inline-flex h-9 items-center rounded-[7px] bg-card px-4 text-[13px] text-ink"
                onClick={() => studio.setAssetCategory("media")}
              >
                Open Edit
              </Link>
            ) : null}
          </div>
        </div>

        {message ? (
          <p className="mt-3 text-[13px] text-muted" data-testid="project-message">
            {message}
          </p>
        ) : null}
      </article>
      <BackupControl />
      <Pipeline />
    </section>
  );
}
