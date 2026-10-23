"use client";

import Link from "next/link";
import { useState } from "react";
import { Pipeline } from "@/components/ui/Pipeline";
import { useStudio } from "@/lib/studio";

export function DirectorWorkspace() {
  const studio = useStudio();
  const [message, setMessage] = useState("");

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">02 · Director Assistant</h1>
      <p className="mt-2 text-[15px] text-muted">Describe your vision and approve the production plan</p>
      <article className="mt-5 flex min-h-[430px] flex-col gap-4 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Director Conversation</h2>
        <p className="m-0 text-sm text-muted">Project: {studio.activeProject.title}</p>
        <div className="rounded-[9px] bg-inset px-4 py-4 text-base">
          <p className="m-0 text-xs font-bold tracking-wide text-muted">Provider unavailable</p>
          <p className="mt-2 mb-0">APG is not connected. Direction stays on this device. This assistant does not generate a plan. Use Characters next to cast, then Capture to record.</p>
        </div>
        <div className="flex flex-col gap-3">
          {studio.messages.map((entry) => (
            <div
              key={entry.id}
              className={entry.role === "user" ? "ml-auto w-[86%] rounded-[9px] bg-user px-4 py-4" : "rounded-[9px] bg-inset px-4 py-4"}
            >
              <p className="m-0 text-xs font-bold tracking-wide text-muted">{entry.role === "user" ? "You" : "Provider unavailable"}</p>
              <p className="mt-2 mb-0">{entry.text}</p>
            </div>
          ))}
        </div>
        <label className="ml-auto block w-[86%] rounded-[9px] bg-user px-4 py-4 text-ink">
          <span className="sr-only">Direction</span>
          <textarea
            className="min-h-12 w-full resize-y bg-transparent text-base outline-none"
            value={studio.directorNote}
            onChange={(event) => studio.setDirectorNote(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="h-9 rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent"
            onClick={() => {
              const error = studio.saveDirection();
              setMessage(error ?? "Saved in this project’s history. APG did not reply.");
            }}
          >
            Save direction
          </button>
          <Link
            href="/characters"
            className="inline-flex h-9 items-center rounded-[7px] bg-inset px-4 text-[13px] font-bold text-ink"
            onClick={() => studio.setAssetCategory("characters")}
          >
            Continue to Characters
          </Link>
        </div>
        {message ? <p className="m-0 text-[13px] text-muted">{message}</p> : null}
      </article>
      <Pipeline />
    </section>
  );
}
