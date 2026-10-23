"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pipeline } from "@/components/ui/Pipeline";
import { projectTitleFromPrompt, useStudio } from "@/lib/studio";

export function ProjectsWorkspace() {
  const studio = useStudio();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [message, setMessage] = useState("");

  function createProduction() {
    const raw = prompt;
    const error = studio.createProject(raw);
    if (error) {
      setMessage(error);
      return;
    }
    const title = projectTitleFromPrompt(raw) || "Untitled production";
    setPrompt("");
    setMessage(`“${title}” is ready. Create your cast next.`);
    studio.setAssetCategory("characters");
    router.push("/characters");
  }

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">01 · Projects & Create</h1>
      <p className="mt-2 text-[15px] text-muted">Start a movie, music video, documentary, or animation</p>
      <article className="mt-5 min-h-[430px] rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">New Production</h2>
        <p className="mt-4 mb-4 text-[25px] font-bold">What would you like to create?</p>
        <label className="block min-h-[116px] rounded-[9px] bg-inset px-4 py-7">
          <span className="sr-only">Production description</span>
          <textarea
            className="min-h-16 w-full resize-y bg-transparent text-base text-ink outline-none placeholder:text-muted"
            placeholder="Describe a film, upload footage, or add a script..."
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
        <p className="mt-2 text-xs text-muted">Tip: Ctrl+Enter (or ⌘+Enter) creates the production and opens Characters.</p>
        <button
          type="button"
          className="mt-5 h-9 w-[210px] rounded-[7px] bg-accent text-[13px] font-bold text-on-accent"
          data-testid="create-production"
          onClick={createProduction}
        >
          Create production
        </button>
        <p className="mt-3 text-sm">Active project: {studio.activeProject.title}</p>
        {message ? <p className="mt-2 text-[13px] text-muted" data-testid="project-message">{message}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/characters"
            className="inline-flex h-9 items-center rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent"
            onClick={() => studio.setAssetCategory("characters")}
          >
            Continue to Characters
          </Link>
          <Link href="/director" className="inline-flex h-9 items-center rounded-[7px] bg-inset px-4 text-[13px] text-ink">
            Open Director notes
          </Link>
          {studio.characters.length > 0 ? (
            <Link
              href="/capture"
              className="inline-flex h-9 items-center rounded-[7px] bg-inset px-4 text-[13px] text-ink"
              onClick={() => studio.setAssetCategory("characters")}
            >
              Go to Capture
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center rounded-[7px] bg-inset px-4 text-[13px] text-muted" title="Add a character first">
              Capture needs a character
            </span>
          )}
        </div>
      </article>
      <Pipeline />
    </section>
  );
}
