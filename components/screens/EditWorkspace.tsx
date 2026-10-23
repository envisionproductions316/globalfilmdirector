"use client";

import { useState } from "react";
import { GraphBoard } from "@/components/production/Boards";
import { Pipeline } from "@/components/ui/Pipeline";
import { Timeline } from "@/components/ui/Timeline";
import { ViewSwitch } from "@/components/ui/ViewSwitch";

const MEDIA = ["Scene 01", "Scene 02", "Scene 03", "Dialogue", "Music", "Captions"];

export function EditWorkspace() {
  const [view, setView] = useState("Timeline");

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">{view === "Graph" ? "22 · Connected Production Graph" : "07 · Film Editing Studio"}</h1>
      <p className="mt-2 text-[15px] text-muted">
        {view === "Graph" ? "Track scene, character, camera, voice, and audio notes. This map does not re-render anything." : "Multitrack film, animation, audio, and captions"}
      </p>
      <ViewSwitch views={["Timeline", "Graph"]} value={view} onChange={setView} />
      {view === "Graph" ? <GraphBoard /> : (
      <>
      <div className="mt-5 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <article className="rounded-[10px] bg-card px-4 py-4">
          <h2 className="m-0 text-base font-bold">Media Library</h2>
          <ul className="mt-3 flex list-none flex-col gap-2 p-0">
            {MEDIA.map((item) => (
              <li key={item} className="rounded-[9px] bg-inset px-3 py-3">
                {item}
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-[10px] bg-card px-4 py-4">
          <h2 className="m-0 text-base font-bold">Program Monitor</h2>
          <div className="mt-3 min-h-[220px] rounded-[9px] bg-[#34436d]" />
          <p className="mt-3">▶ 00:24:12 / 01:30:00</p>
        </article>
      </div>
      <Timeline
        tracks={[
          { name: "Video", color: "#3478f6" },
          { name: "Character motion", color: "#23b7a5" },
          { name: "Dialogue", color: "#7258b0" },
          { name: "Lead vocal", color: "#9b7741" },
          { name: "Music", color: "#4386b1" },
          { name: "SFX", color: "#3478f6" },
          { name: "Captions", color: "#23b7a5" },
        ]}
      />
      </>
      )}
      <Pipeline />
    </section>
  );
}
