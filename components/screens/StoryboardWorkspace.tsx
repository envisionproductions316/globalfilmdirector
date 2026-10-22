"use client";

import { Pipeline } from "@/components/ui/Pipeline";
import { useStudio } from "@/lib/studio";

export function StoryboardWorkspace() {
  const studio = useStudio();

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">06 · Scene Builder & Storyboard</h1>
      <p className="mt-2 text-[15px] text-muted">Create scenes, shots, locations, and camera movement</p>
      <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Storyboard & Shots</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {studio.shots.map((shot) => (
            <button
              key={shot.id}
              type="button"
              className={`flex min-h-[168px] items-end rounded-[9px] p-3 text-left text-[15px] text-[#f1f6ff] ${
                shot.id === studio.selectedShotId ? "outline-2 outline-offset-2 outline-ink" : ""
              }`}
              style={{ background: shot.color }}
              onClick={() => studio.selectShot(shot.id)}
            >
              {shot.label} • {shot.action}
            </button>
          ))}
        </div>
      </article>
      <Pipeline />
    </section>
  );
}
