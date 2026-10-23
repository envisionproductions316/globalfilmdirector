"use client";

import Link from "next/link";
import { useState } from "react";
import { CueBoard } from "@/components/production/Boards";
import { ProductionTimeline } from "@/components/timeline/ProductionTimeline";
import { Pipeline } from "@/components/ui/Pipeline";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
import { useStudio } from "@/lib/studio";

export function AudioWorkspace() {
  const studio = useStudio();
  const [view, setView] = useState("Mixer");
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[26px] font-bold">{view === "Cues" ? "21 · Music Cue & Scene Alignment" : "08 · Audio & Music Studio"}</h1>
          <p className="mt-2 text-[15px] text-muted">
            {view === "Cues"
              ? "Align imported music and effects with scenes. GCIE is not connected, and no music is generated."
              : "Dialogue, narration, music, and effects share the film timeline. Nothing here is synthesized."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/edit" className="inline-flex h-9 items-center rounded-[7px] bg-inset px-3 text-sm" onClick={() => studio.setAssetCategory("media")}>
            Back to Edit
          </Link>
          <Link
            href="/export"
            className={`inline-flex h-9 items-center rounded-[7px] px-3 text-sm ${
              studio.clips.length ? "bg-accent font-bold text-on-accent" : "bg-inset text-muted"
            }`}
            title={studio.clips.length ? undefined : "Add clips to the timeline before export"}
          >
            Export {studio.clips.length ? `(${studio.clips.length})` : ""}
          </Link>
        </div>
      </div>
      <ViewSwitch views={["Mixer", "Cues"]} value={view} onChange={setView} />
      {view === "Mixer" ? <ProductionTimeline mode="audio" /> : <CueBoard />}
      <Pipeline />
    </section>
  );
}
