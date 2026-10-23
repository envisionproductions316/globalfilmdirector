"use client";

import { useState } from "react";
import { TakePlayer } from "@/components/media/TakePlayer";
import { ContinuityBoard, GraphBoard, SceneDetail, SequenceBoard } from "@/components/production/Boards";
import { Pipeline } from "@/components/ui/Pipeline";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
import { useStudio } from "@/lib/studio";

const VIEWS = ["Shots", "Sequence", "Scene", "Continuity", "Graph"];

export function StoryboardWorkspace() {
  const studio = useStudio();
  const [view, setView] = useState("Shots");

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">
        {view === "Sequence" ? "19 · Storyboard Sequence & Continuity" : view === "Scene" ? "20 · Scene Detail & Approval Handoff" : view === "Graph" ? "22 · Connected Production Graph" : view === "Continuity" ? "26 · Continuity Rules & Conflict Review" : "06 · Scene Builder & Storyboard"}
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        {view === "Sequence" ? "Organize scenes into a continuous story. No continuity service is connected." : view === "Scene" ? "Edit a scene and keep its linked notes on this device." : view === "Graph" ? "Track scene, character, and take records for this project." : view === "Continuity" ? "Review conflicts without rewriting approved work." : "Create scenes, shots, locations, and camera movement"}
      </p>
      <ViewSwitch views={VIEWS} value={view} onChange={setView} />
      {view === "Shots" ? (
        <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
          <h2 className="m-0 text-base font-bold">Storyboard & Shots</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent" onClick={studio.addShot}>Add shot</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {studio.shots.map((shot, index) => {
              const scene = studio.scenes.find((item) => item.id === shot.sceneId);
              const linked = studio.takes.filter((take) => take.shotId === shot.id);
              const previous = studio.shots[index - 1];
              const next = studio.shots[index + 1];
              return (
                <div
                  key={shot.id}
                  className={`flex min-h-[168px] flex-col justify-end rounded-[9px] p-3 text-left text-[15px] text-[#f1f6ff] ${
                    shot.id === studio.selectedShotId ? "outline-2 outline-offset-2 outline-ink" : ""
                  }`}
                  style={{ background: shot.color }}
                >
                  <button type="button" className="text-left" onClick={() => studio.selectShot(shot.id)}>
                    {shot.label} • {shot.action || "No action"}
                    <span className="mt-1 block text-xs">{scene ? scene.title : "No scene"}</span>
                    <span className="mt-1 block text-xs">{linked.length ? linked.map((take) => take.name).join(", ") : "No recording"}</span>
                  </button>
                  <span className="mt-2 flex gap-2">
                    <button type="button" className="rounded bg-black/20 px-2 py-1 text-xs" onClick={() => previous && studio.moveShot(shot.id, previous.id)}>Earlier</button>
                    <button type="button" className="rounded bg-black/20 px-2 py-1 text-xs" onClick={() => next && studio.moveShot(shot.id, next.id)}>Later</button>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            {studio.takes.filter((take) => take.shotId === studio.selectedShotId).map((take) => (
              <TakePlayer key={take.id} mediaId={take.mediaId} caption={`${take.name} is linked to this shot. It is a raw recording, not an animated panel.`} />
            ))}
          </div>
        </article>
      ) : null}
      {view === "Sequence" ? <SequenceBoard /> : null}
      {view === "Scene" ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {studio.scenes.map((scene) => (
              <button key={scene.id} type="button" className={`h-9 rounded-md px-3 text-sm ${scene.id === studio.selectedSceneId ? "bg-active" : "bg-inset"}`} onClick={() => studio.selectScene(scene.id)}>
                {scene.title}
              </button>
            ))}
          </div>
          <SceneDetail />
        </>
      ) : null}
      {view === "Graph" ? <GraphBoard /> : null}
      {view === "Continuity" ? <ContinuityBoard /> : null}
      <Pipeline />
    </section>
  );
}
