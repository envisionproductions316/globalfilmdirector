"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CharacterProfile } from "@/components/characters/CharacterProfile";
import { useStudio } from "@/lib/studio";

const fieldClass = "rounded-md bg-inset px-2 py-2 text-sm text-ink";

export function ContextPanel() {
  const pathname = usePathname();
  const studio = useStudio();
  const character = studio.selectedCharacter;
  const shot = studio.selectedShot;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <aside aria-label="Inspector" className="bg-rail px-4 py-5 text-ink lg:sticky lg:top-0 lg:max-h-screen lg:w-[320px] lg:overflow-y-auto">
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
          <label className="mt-4 flex flex-col gap-1 text-xs text-muted">
            Name
            <input
              className={fieldClass}
              value={studio.activeProject.title}
              onChange={(event) => studio.updateProject(studio.activeProject.id, { title: event.target.value })}
              onBlur={(event) => {
                if (!event.target.value.trim()) studio.updateProject(studio.activeProject.id, { title: "Untitled production" });
              }}
            />
          </label>
          <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
            Kind
            <select
              className={fieldClass}
              value={studio.activeProject.kind}
              onChange={(event) => studio.updateProject(studio.activeProject.id, { kind: event.target.value })}
            >
              {["Feature", "Music video", "Documentary", "Animation", "Draft"].map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-[13px] text-muted">Project id {studio.activeProject.id}</p>
          <button type="button" className="mt-3 h-9 rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent" onClick={studio.saveLocal}>
            Save on this device
          </button>
          {pendingDeleteId === studio.activeProject.id ? (
            <div className="mt-3">
              <p className="text-sm">Delete {studio.activeProject.title}? Characters and shots in this project are removed from this device.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent" onClick={() => studio.deleteProject(studio.activeProject.id)}>
                  Delete project
                </button>
                <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-[13px]" onClick={() => setPendingDeleteId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="mt-3 block text-sm text-muted" onClick={() => setPendingDeleteId(studio.activeProject.id)}>
              Delete project
            </button>
          )}
        </>
      ) : null}

      {pathname === "/director" ? (
        <>
          <h2 className="m-0 text-base font-bold">Production Plan</h2>
          <p className="mt-2 text-[13px] text-muted">{studio.activeProject.title}</p>
          <ul className="mt-3 list-none space-y-2 p-0 text-sm">
            {studio.plan.map((item) => (
              <li key={item.id} className="rounded-[9px] bg-inset px-3 py-2">
                <span className="block font-bold">{item.label}</span>
                <input
                  className="mt-1 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                  placeholder="Add a local note"
                  value={item.detail}
                  onChange={(event) => studio.updatePlan(item.id, event.target.value)}
                />
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
          {character ? <CharacterProfile character={character} /> : <p className="mt-3 text-sm text-muted">No character in this project yet.</p>}
        </>
      ) : null}

      {pathname === "/capture" ? (
        <>
          <h2 className="m-0 text-base font-bold">Camera</h2>
          <p className="mt-3 text-sm">Mode: Camera capture</p>
          <p className="mt-2 text-[13px] text-muted">Starting the camera does not retarget motion onto a character.</p>
          <p className="mt-3 text-sm">Project: {studio.activeProject.title}</p>
          <p className="mt-2 text-sm">Preview character: {character ? character.name : "None"}</p>
        </>
      ) : null}

      {pathname === "/storyboard" ? (
        <>
          <h2 className="m-0 text-base font-bold">Shot</h2>
          {shot ? (
            <>
              <p className="mt-3 text-sm">{shot.label}</p>
              <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
                Camera
                <input className={fieldClass} value={shot.camera} onChange={(event) => studio.updateShot(shot.id, { camera: event.target.value })} />
              </label>
              <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
                Location
                <input className={fieldClass} value={shot.location} onChange={(event) => studio.updateShot(shot.id, { location: event.target.value })} />
              </label>
              <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
                Action
                <input className={fieldClass} value={shot.action} onChange={(event) => studio.updateShot(shot.id, { action: event.target.value })} />
              </label>
              <p className="mt-3 text-[13px] text-muted">Shot id {shot.id}</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">This project has no shots.</p>
          )}
        </>
      ) : null}

      {pathname === "/edit" ? (
        <>
          <h2 className="m-0 text-base font-bold">Timeline</h2>
          <p className="mt-3 text-sm">Program: 00:24:12 / 01:30:00</p>
          <p className="mt-2 text-[13px] text-muted">Video, motion, dialogue, vocal, music, SFX, and captions. Playback is a layout control, not a rendered cut.</p>
        </>
      ) : null}

      {pathname === "/audio" ? (
        <>
          <h2 className="m-0 text-base font-bold">Audio</h2>
          <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
            Track
            <select
              className="rounded-md bg-inset px-2 py-2 text-sm text-ink"
              value={studio.selectedAudioTrack}
              onChange={(event) => studio.setSelectedAudioTrack(event.target.value)}
            >
              {["Dialogue", "Lead vocal", "Harmony", "Instrumental", "Sound FX", "Ambience", "Captions"].map((track) => (
                <option key={track}>{track}</option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-[13px] text-muted">Mix engine: not connected.</p>
        </>
      ) : null}

      {pathname === "/export" ? (
        <>
          <h2 className="m-0 text-base font-bold">Quality & Export</h2>
          <p className="mt-3 text-sm text-muted">Review renders, costs, quality, and delivery. No renderer is connected.</p>
          <button type="button" className="mt-4 h-9 rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent" onClick={studio.recordLocalExport}>
            Render / Export
          </button>
        </>
      ) : null}

      {pathname === "/connectors" ? (
        <>
          <h2 className="m-0 text-base font-bold">{studio.selectedConnector.name}</h2>
          <p className="mt-3 text-sm">Status: Not connected</p>
          <p className="mt-2 text-sm text-muted">{studio.selectedConnector.kind}</p>
          <p className="mt-2 text-sm text-muted">{studio.selectedConnector.detail}</p>
          <h3 className="mt-4 text-sm font-bold">Permissions</h3>
          <ul className="mt-2 list-none space-y-2 p-0 text-sm">
            {studio.selectedConnector.permissions.map((permission) => (
              <li key={permission} className="rounded-[9px] bg-inset px-3 py-2">
                {permission}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-muted">Viewing a connector does not install it or send credentials.</p>
        </>
      ) : null}
    </aside>
  );
}
