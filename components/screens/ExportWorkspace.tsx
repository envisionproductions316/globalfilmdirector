"use client";

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
      <h1 className="m-0 text-[26px] font-bold">{view === "Assembly" ? "23 · Final Assembly & Continuity QC" : "09 · Production & Export"}</h1>
      <p className="mt-2 text-[15px] text-muted">
        {view === "Assembly" ? "Review the timeline, scenes, and local continuity warnings." : "Encode the current timeline on this computer when FFmpeg is available."}
      </p>
      <ViewSwitch views={["Queue", "Assembly"]} value={view} onChange={setView} />
      {view === "Queue" ? (
        <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
          <h2 className="m-0 text-base font-bold">Production Queue</h2>
          <p className="mt-2 text-sm text-muted">An export is listed as completed only after a playable file is written. Sample rows are not live renders.</p>
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
