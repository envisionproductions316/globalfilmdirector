"use client";

import { useState } from "react";
import { CueBoard } from "@/components/production/Boards";
import { ProductionTimeline } from "@/components/timeline/ProductionTimeline";
import { Pipeline } from "@/components/ui/Pipeline";
import { ViewSwitch } from "@/components/ui/ViewSwitch";

export function AudioWorkspace() {
  const [view, setView] = useState("Mixer");
  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">{view === "Cues" ? "21 · Music Cue & Scene Alignment" : "08 · Audio & Music Studio"}</h1>
      <p className="mt-2 text-[15px] text-muted">
        {view === "Cues"
          ? "Align imported music and effects with scenes. GCIE is not connected, and no music is generated."
          : "Dialogue, narration, music, and effects share the film timeline. Nothing here is synthesized."}
      </p>
      <ViewSwitch views={["Mixer", "Cues"]} value={view} onChange={setView} />
      {view === "Mixer" ? <ProductionTimeline mode="audio" /> : <CueBoard />}
      <Pipeline />
    </section>
  );
}
