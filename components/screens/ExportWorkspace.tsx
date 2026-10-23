"use client";

import { useState } from "react";
import { AssemblyBoard } from "@/components/production/Boards";
import { Pipeline } from "@/components/ui/Pipeline";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
import { useStudio } from "@/lib/studio";

export function ExportWorkspace() {
  const studio = useStudio();
  const [view, setView] = useState("Queue");

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">{view === "Assembly" ? "23 · Final Assembly & Continuity QC" : "09 · Production & Export"}</h1>
      <p className="mt-2 text-[15px] text-muted">
        {view === "Assembly" ? "Review the scene list, transitions, and revisions. Playback is not a rendered film." : "Review renders, costs, quality, and final delivery"}
      </p>
      <ViewSwitch views={["Queue", "Assembly"]} value={view} onChange={setView} />
      {view === "Queue" ? (
        <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
          <h2 className="m-0 text-base font-bold">Production Queue</h2>
          <p className="mt-2 text-sm text-muted">Sample rows are not live renders. No renderer is connected for {studio.activeProject.title}.</p>
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
