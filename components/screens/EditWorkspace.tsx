"use client";

import { useState } from "react";
import { GraphBoard } from "@/components/production/Boards";
import { ProductionTimeline } from "@/components/timeline/ProductionTimeline";
import { Pipeline } from "@/components/ui/Pipeline";
import { ViewSwitch } from "@/components/ui/ViewSwitch";

export function EditWorkspace() {
  const [view, setView] = useState("Timeline");
  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">{view === "Graph" ? "22 · Connected Production Graph" : "07 · Film Editing Studio"}</h1>
      <p className="mt-2 text-[15px] text-muted">
        {view === "Graph" ? "Track scene, character, camera, voice, and timeline clips. This map does not re-render anything." : "Multitrack film, animation, audio, and captions"}
      </p>
      <ViewSwitch views={["Timeline", "Graph"]} value={view} onChange={setView} />
      {view === "Graph" ? <GraphBoard /> : <ProductionTimeline mode="edit" />}
      <Pipeline />
    </section>
  );
}
