"use client";

import Link from "next/link";
import { useState } from "react";
import { AssemblyBoard } from "@/components/production/Boards";
import { ExportControl } from "@/components/timeline/ExportControl";
import { Pipeline } from "@/components/ui/Pipeline";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
import { useStudio } from "@/lib/studio";

export function ExportWorkspace() {
  const studio = useStudio();
  const [view, setView] = useState("Queue");

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[26px] font-bold">{view === "Assembly" ? "23 · Final Assembly & Continuity QC" : "09 · Production & Export"}</h1>
          <p className="mt-2 text-[15px] text-muted">
            {view === "Assembly" ? "Review the timeline, scenes, and local continuity warnings." : "Encode the current timeline on this computer when FFmpeg is available."}
          </p>
        </div>
        <Link href="/edit" className="inline-flex h-9 items-center rounded-[7px] bg-inset px-3 text-sm" onClick={() => studio.setAssetCategory("media")}>
          Back to Edit
        </Link>
      </div>
      <ViewSwitch views={["Queue", "Assembly"]} value={view} onChange={setView} />
      {view === "Queue" ? (
        <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
          <h2 className="m-0 text-base font-bold">Production Queue</h2>
          <p className="mt-2 text-sm text-muted">An export is listed as completed only after a playable file is written. Sample rows are not live renders.</p>
          {studio.clips.length === 0 ? (
            <p className="mt-3 rounded-[9px] bg-inset px-3 py-3 text-sm" data-testid="export-empty">
              The timeline has no clips yet.{" "}
              <Link href="/capture" className="text-accent" onClick={() => studio.setAssetCategory("characters")}>
                Record on Capture
              </Link>{" "}
              or{" "}
              <Link href="/edit" className="text-accent" onClick={() => studio.setAssetCategory("media")}>
                place media in Edit
              </Link>
              .
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">{studio.clips.length} clip{studio.clips.length === 1 ? "" : "s"} on the shared timeline for {studio.activeProject.title}.</p>
          )}
          <ExportControl />
          <ul className="mt-4 flex list-none flex-col gap-3 p-0">
            {studio.jobs.map((job) => (
              <li key={job.id} className="rounded-[9px] bg-inset px-4 py-5 text-base">
                {job.label} • {job.state}
                {job.sample ? " · sample" : ""}
              </li>
            ))}
          </ul>
        </article>
      ) : (
        <AssemblyBoard />
      )}
      <Pipeline />
    </section>
  );
}
