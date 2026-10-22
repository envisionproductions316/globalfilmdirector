"use client";

import { usePathname } from "next/navigation";
import { useStudio } from "@/lib/studio";

export function ContextPanel() {
  const pathname = usePathname();
  const studio = useStudio();
  const character = studio.selectedCharacter;

  return (
    <aside aria-label="Inspector" className="bg-rail px-4 py-5 text-ink lg:w-[320px]">
      {pathname === "/projects" ? (
        <>
          <h2 className="m-0 text-base font-bold">Recent Projects</h2>
          <ul className="mt-3 flex list-none flex-col gap-2 p-0">
            {studio.projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className="w-full rounded-[9px] bg-inset px-3 py-3 text-left"
                  onClick={() => studio.setActiveProjectId(project.id)}
                >
                  <strong className="block">{project.title}</strong>
                  <span className="text-[13px] text-muted">
                    {project.kind}
                    {project.id === studio.activeProjectId ? " · Active" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {pathname === "/director" ? (
        <>
          <h2 className="m-0 text-base font-bold">Production Plan</h2>
          <ul className="mt-3 list-none space-y-2 p-0 text-sm">
            {["Cast", "Storyboard", "Camera plan", "Music", "Editable scene timeline"].map((item) => (
              <li key={item} className="rounded-[9px] bg-inset px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-muted">
            {studio.planApproved ? "Approved by the creator on this device." : "Waiting for creator approval."}
          </p>
          <button
            type="button"
            className="mt-3 h-9 rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent disabled:opacity-60"
            onClick={studio.approvePlan}
            disabled={studio.planApproved}
          >
            {studio.planApproved ? "Plan approved" : "Approve plan"}
          </button>
        </>
      ) : null}

      {pathname === "/characters" ? (
        <>
          <h2 className="m-0 text-base font-bold">Character</h2>
          <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
            Name
            <input
              className="rounded-md bg-inset px-2 py-2 text-sm text-ink"
              value={character.name}
              onChange={(event) => studio.updateCharacter(character.id, { name: event.target.value })}
            />
          </label>
          <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
            Look
            <select
              className="rounded-md bg-inset px-2 py-2 text-sm text-ink"
              value={character.look}
              onChange={(event) => studio.updateCharacter(character.id, { look: event.target.value as "2D" | "3D" })}
            >
              <option>2D</option>
              <option>3D</option>
            </select>
          </label>
          <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
            Voice
            <input
              className="rounded-md bg-inset px-2 py-2 text-sm text-ink"
              value={character.voice}
              onChange={(event) => studio.updateCharacter(character.id, { voice: event.target.value })}
            />
          </label>
          <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
            Wardrobe
            <input
              className="rounded-md bg-inset px-2 py-2 text-sm text-ink"
              value={character.wardrobe}
              onChange={(event) => studio.updateCharacter(character.id, { wardrobe: event.target.value })}
            />
          </label>
          <p className="mt-3 text-[13px] text-muted">Face, body, voice, and wardrobe stay on this character. Nothing is uploaded.</p>
        </>
      ) : null}

      {pathname !== "/projects" && pathname !== "/director" && pathname !== "/characters" ? (
        <>
          <h2 className="m-0 text-base font-bold">Inspector</h2>
          <p className="mt-3 text-sm text-muted">This destination’s controls are not in the current build.</p>
        </>
      ) : null}
    </aside>
  );
}
