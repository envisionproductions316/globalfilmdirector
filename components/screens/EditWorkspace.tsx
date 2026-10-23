"use client";

import Link from "next/link";
import { useState } from "react";
import { GraphBoard } from "@/components/production/Boards";
import { ProductionTimeline } from "@/components/timeline/ProductionTimeline";
import { Pipeline } from "@/components/ui/Pipeline";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
import { useStudio } from "@/lib/studio";

export function EditWorkspace() {
  const studio = useStudio();
  const [view, setView] = useState("Timeline");
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[26px] font-bold">{view === "Graph" ? "22 · Connected Production Graph" : "07 · Film Editing Studio"}</h1>
          <p className="mt-2 text-[15px] text-muted">
            {view === "Graph"
              ? "Track scene, character, camera, voice, and timeline clips. This map does not re-render anything."
              : studio.assetCategory === "assets"
                ? "My Assets — import files to this device, then place them on the shared timeline."
                : "Multitrack film, animation, audio, and captions"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {studio.clips.length === 0 ? (
            <Link
              href="/capture"
              className="inline-flex h-9 items-center rounded-[7px] bg-accent px-3 text-sm font-bold text-on-accent"
              onClick={() => studio.setAssetCategory("characters")}
            >
              Record on Capture
            </Link>
          ) : (
            <Link href="/capture" className="inline-flex h-9 items-center rounded-[7px] bg-inset px-3 text-sm" onClick={() => studio.setAssetCategory("characters")}>
              Capture
            </Link>
          )}
          <Link href="/audio" className="inline-flex h-9 items-center rounded-[7px] bg-inset px-3 text-sm" onClick={() => studio.setAssetCategory("music")}>
            Audio
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
      <ViewSwitch views={["Timeline", "Graph"]} value={view} onChange={setView} />
      {view === "Graph" ? <GraphBoard /> : <ProductionTimeline mode="edit" />}
      <Pipeline />
    </section>
  );
}
