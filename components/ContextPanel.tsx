"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CharacterProfile } from "@/components/characters/CharacterProfile";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isProjectVisibleToUser } from "@/lib/auth/types";
import { useStudio } from "@/lib/studio";
import { FRAME_MS, TRACK_META, clipSpan, formatSeconds, formatTimecode, secondsToMs, trackMeta, type TrackId } from "@/lib/timeline";

const fieldClass = "rounded-md bg-inset px-2 py-2 text-sm text-ink";

export function ContextPanel() {
  const pathname = usePathname();
  const studio = useStudio();
  const auth = useAuth();
  const character = studio.selectedCharacter;
  const shot = studio.selectedShot;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const visibleProjects = useMemo(
    () => studio.projects.filter((project) => isProjectVisibleToUser(project, auth.user?.id ?? null)),
    [studio.projects, auth.user?.id],
  );

  return (
    <aside aria-label="Inspector" className="bg-rail px-4 py-5 text-ink lg:sticky lg:top-0 lg:max-h-screen lg:w-[320px] lg:overflow-y-auto">
      {pathname === "/projects" ? (
        <>
          <h2 className="m-0 text-base font-bold">Recent Projects</h2>
          <ul className="mt-3 flex list-none flex-col gap-2 p-0">
            {visibleProjects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  data-testid={`recent-project-${project.id}`}
                  className={`w-full rounded-[9px] px-3 py-3 text-left ${project.id === studio.activeProjectId ? "bg-active" : "bg-inset"}`}
                  onClick={() => {
                    studio.setActiveProjectId(project.id);
                    setPendingDeleteId(null);
                  }}
                >
                  <strong className="block">{project.title}</strong>
                  <span className="text-[13px] text-muted">
                    {project.kind}
                    {project.id === studio.activeProjectId ? " · Active" : " · Switch to this project"}
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
              data-testid="project-title"
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
              data-testid="project-kind"
              onChange={(event) => studio.updateProject(studio.activeProject.id, { kind: event.target.value })}
            >
              {["Feature", "Music video", "Documentary", "Animation", "Draft"].map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-[13px] text-muted">Saved in this browser. Project id {studio.activeProject.id}</p>
          <button
            type="button"
            className="mt-3 h-9 rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent"
            data-testid="save-project"
            onClick={() => {
              studio.saveLocal();
              setPendingDeleteId(null);
            }}
          >
            Save on this device
          </button>
          <p className="mt-2 text-[12px] text-muted">Autosaves as you edit. Use Save to confirm a snapshot in Notifications.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/characters"
              className="inline-flex h-9 items-center rounded-[7px] bg-inset px-3 text-[13px]"
              onClick={() => studio.setAssetCategory("characters")}
            >
              Open Characters
            </Link>
            <Link href="/director" className="inline-flex h-9 items-center rounded-[7px] bg-inset px-3 text-[13px]">
              Direction
            </Link>
          </div>
          {pendingDeleteId === studio.activeProject.id ? (
            <div className="mt-3">
              <p className="text-sm">Delete {studio.activeProject.title}? Characters, takes, and clips in this project are removed from this device.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent"
                  data-testid="confirm-delete-project"
                  onClick={() => {
                    studio.deleteProject(studio.activeProject.id);
                    setPendingDeleteId(null);
                  }}
                >
                  Delete project
                </button>
                <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-[13px]" onClick={() => setPendingDeleteId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="mt-3 block text-sm text-muted" data-testid="delete-project" onClick={() => setPendingDeleteId(studio.activeProject.id)}>
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
          <h2 className="m-0 text-base font-bold">Performance Controls</h2>
          <div className="mt-3 flex flex-wrap gap-1">
            {(["face", "body", "voice", "style"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`rounded-md px-2 py-1 text-xs capitalize ${studio.capturePrefs.tab === tab ? "bg-active text-ink" : "bg-inset text-muted"}`}
                onClick={() => studio.setCapturePrefs({ tab })}
              >
                {tab}
              </button>
            ))}
          </div>
          {studio.capturePrefs.tab === "body" ? (
            <div className="mt-3 space-y-3">
              <label className="block text-xs text-muted">
                Motion Strength {studio.capturePrefs.motionStrength}%
                <input className="mt-1 w-full" type="range" min={0} max={200} value={studio.capturePrefs.motionStrength} onChange={(event) => studio.setCapturePrefs({ motionStrength: Number(event.target.value) })} />
              </label>
              <label className="block text-xs text-muted">
                Smoothing {studio.capturePrefs.smoothing}%
                <input className="mt-1 w-full" type="range" min={0} max={100} value={studio.capturePrefs.smoothing} onChange={(event) => studio.setCapturePrefs({ smoothing: Number(event.target.value) })} />
              </label>
              <label className="block text-xs text-muted">
                Exaggeration {studio.capturePrefs.exaggeration}%
                <input className="mt-1 w-full" type="range" min={0} max={200} value={studio.capturePrefs.exaggeration} onChange={(event) => studio.setCapturePrefs({ exaggeration: Number(event.target.value) })} />
              </label>
              <p className="text-[12px] text-muted">These preferences are stored on this device. They do not drive a retargeter.</p>
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-muted">
              {studio.capturePrefs.tab === "face"
                ? "Face landmark controls are not wired. Capture can show a body pose overlay; that is not face tracking or retargeting."
                : studio.capturePrefs.tab === "voice"
                  ? "Voice transform is not connected. The microphone records raw audio only."
                  : "Visual style comes from the character passport. No AI style engine is connected."}
            </p>
          )}

          {studio.capturePrefs.tab === "style" && character ? (
            <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
              Animation style
              <select
                className={fieldClass}
                value={character.animationStyle}
                onChange={(event) => studio.updateCharacter(character.id, { animationStyle: event.target.value as typeof character.animationStyle })}
              >
                {["Unassigned", "Realistic", "Stylized", "Limited", "Graphic"].map((style) => (
                  <option key={style}>{style}</option>
                ))}
              </select>
            </label>
          ) : null}

          <h3 className="mt-5 text-sm font-bold">Character Actions</h3>
          <div className="mt-2 grid gap-2">
            <p className="m-0 text-[13px] text-muted">Preview character: {character ? character.name : "None"} · {studio.takes.filter((take) => take.characterId === character?.id).length} takes</p>
            <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-left text-sm" data-testid="tools-retake" onClick={() => studio.requestCaptureAction("retake")}>Retake Performance</button>
            <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-left text-sm text-muted" disabled>Apply to Selected Shots · Not available</button>
            <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-left text-sm text-muted" disabled>Copy to Other Characters · Not available</button>
            <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-left text-sm text-muted" disabled>Save as Motion Style · Not available</button>
            <button
              type="button"
              className="h-10 rounded-[7px] bg-accent px-3 text-left text-sm font-bold text-on-accent"
              data-testid="tools-add-timeline"
              onClick={() => studio.requestCaptureAction("add-to-timeline")}
            >
              Add to Timeline
            </button>
          </div>

          <h3 className="mt-5 text-sm font-bold">Scene Tools</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Link href="/edit" className="inline-flex h-9 items-center justify-center rounded-[7px] bg-inset px-2 text-ink">
              Split / Trim
            </Link>
            <Link
              href="/edit"
              className="inline-flex h-9 items-center justify-center rounded-[7px] bg-inset px-2 text-ink"
              title="Open Edit to close picture gaps (ripple pack left)"
            >
              Close gaps
            </Link>
            <button type="button" className="h-9 rounded-[7px] bg-inset px-2 text-muted" disabled title="Speed changes are not available yet">
              Speed
            </button>
          </div>
          <Link href="/edit" className="mt-2 block text-xs text-accent">Open Edit to trim, split, and close picture gaps</Link>

          <h3 className="mt-5 text-sm font-bold">AI Tools</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {["Fix Lip Sync", "Regenerate Motion", "Change Expression", "Apply to Similar"].map((label) => (
              <button key={label} type="button" className="h-9 rounded-[7px] bg-inset px-2 text-muted" disabled>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">AI tools are not connected.</p>

          <h3 className="mt-5 text-sm font-bold">Camera Tools</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {["Auto Frame", "Set Angle", "Depth of Field", "Camera Move"].map((label) => (
              <button key={label} type="button" className="h-9 rounded-[7px] bg-inset px-2 text-muted" disabled>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">Camera tools are not connected. Device camera controls are on the Capture stage.</p>
          <p className="mt-3 text-[13px] text-muted">Project: {studio.activeProject.title}. Recordings stay on this device.</p>
        </>
      ) : null}

      {pathname === "/locations" ? (
        <>
          <h2 className="m-0 text-base font-bold">Locations</h2>
          <p className="mt-3 text-sm text-muted">Places used by scenes in {studio.activeProject.title}. Edit location fields on Storyboard scenes.</p>
          <ul className="mt-3 list-none space-y-2 p-0 text-sm">
            {studio.scenes.map((scene) => (
              <li key={scene.id} className="rounded-[9px] bg-inset px-3 py-2">
                <strong className="block">{scene.location || scene.world || "Unspecified"}</strong>
                <span className="text-xs text-muted">{scene.title} · {scene.timeOfDay}</span>
              </li>
            ))}
          </ul>
          <Link href="/storyboard" className="mt-3 block text-sm text-accent" onClick={() => studio.setAssetCategory("scenes")}>
            Open Storyboard
          </Link>
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
              <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
                Scene
                <select className={fieldClass} value={shot.sceneId} onChange={(event) => studio.updateShot(shot.id, { sceneId: event.target.value })}>
                  <option value="">Unassigned</option>
                  {studio.scenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>{scene.title}</option>
                  ))}
                </select>
              </label>
              <p className="mt-3 text-[13px] text-muted">Shot id {shot.id}</p>
              {studio.selectedScene ? (
                <p className="mt-3 text-[13px] text-muted">
                  Scene {studio.selectedScene.title} · {studio.selectedScene.status} · {studio.selectedScene.stage}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">This project has no shots.</p>
          )}
        </>
      ) : null}

      {pathname === "/edit" || pathname === "/audio" ? (
        <>
          <h2 className="m-0 text-base font-bold">
            {studio.assetCategory === "assets" ? "My Assets" : pathname === "/audio" ? "Audio" : "Timeline"}
          </h2>
          {studio.assetCategory === "assets" ? (
            <>
              <p className="mt-3 text-sm text-muted">
                {`${studio.assets.length} file${studio.assets.length === 1 ? "" : "s"} stored for ${studio.activeProject.title}. Import stores without placing; Place on timeline adds clips.`}
              </p>
              <ul className="mt-3 list-none space-y-2 p-0 text-sm">
                {studio.assets.slice(0, 8).map((asset) => (
                  <li key={asset.id} className="rounded-[9px] bg-inset px-3 py-2">
                    <strong className="block truncate">{asset.name}</strong>
                    <span className="text-xs text-muted">
                      {asset.hasVideo ? "Video" : "Audio"} ·{" "}
                      {asset.durationMs < 1000 ? `${(asset.durationMs / 1000).toFixed(1)}s` : formatTimecode(asset.durationMs)}
                      {studio.clips.some((clip) => clip.mediaId === asset.id) ? " · On timeline" : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {studio.assets.length === 0 ? <p className="mt-3 text-sm text-muted">No assets yet. Use Import to My Assets in the Edit bin.</p> : null}
            </>
          ) : studio.selectedClip ? (
            <>
              <p className="mt-3 text-sm font-bold">{studio.selectedClip.name}</p>
              <p className="mt-2 text-[13px] text-muted">
                {trackMeta(studio.selectedClip.track).label} · {formatTimecode(clipSpan(studio.selectedClip))} · {studio.selectedClip.characterId || "No character"}
              </p>
              <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
                Start (s)
                <input
                  className={fieldClass}
                  type="number"
                  step={0.04}
                  min={0}
                  data-testid="inspector-clip-start"
                  value={formatSeconds(studio.selectedClip.startMs)}
                  onChange={(event) => studio.moveTimelineClip(studio.selectedClip!.id, secondsToMs(event.target.value), studio.selectedClip!.track)}
                />
              </label>
              <label className="mt-2 flex flex-col gap-1 text-xs text-muted">
                In (s)
                <input
                  className={fieldClass}
                  type="number"
                  step={0.04}
                  min={0}
                  data-testid="inspector-trim-in"
                  value={formatSeconds(studio.selectedClip.inMs)}
                  onChange={(event) => studio.trimTimelineClip(studio.selectedClip!.id, "in", secondsToMs(event.target.value))}
                />
              </label>
              <label className="mt-2 flex flex-col gap-1 text-xs text-muted">
                Out (s)
                <input
                  className={fieldClass}
                  type="number"
                  step={0.04}
                  min={0}
                  data-testid="inspector-trim-out"
                  value={formatSeconds(studio.selectedClip.outMs)}
                  onChange={(event) => studio.trimTimelineClip(studio.selectedClip!.id, "out", secondsToMs(event.target.value))}
                />
              </label>
              <label className="mt-2 flex flex-col gap-1 text-xs text-muted">
                Volume
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  data-testid="inspector-clip-volume"
                  value={studio.selectedClip.volume}
                  onChange={(event) => studio.updateClip(studio.selectedClip!.id, { volume: Number(event.target.value) })}
                />
              </label>
              <label className="mt-2 flex flex-col gap-1 text-xs text-muted">
                Track
                <select
                  className={fieldClass}
                  value={studio.selectedClip.track}
                  data-testid="inspector-clip-track"
                  onChange={(event) => studio.moveTimelineClip(studio.selectedClip!.id, studio.selectedClip!.startMs, event.target.value as TrackId)}
                >
                  {TRACK_META.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="h-8 rounded-md bg-inset px-2 text-xs"
                  data-testid="inspector-split"
                  onClick={() => studio.splitTimelineClip(studio.selectedClip!.id, studio.playheadMs)}
                >
                  Split at playhead
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md bg-inset px-2 text-xs"
                  onClick={() => studio.moveTimelineClip(studio.selectedClip!.id, Math.max(0, studio.selectedClip!.startMs - FRAME_MS), studio.selectedClip!.track)}
                >
                  −1 frame
                </button>
                <button
                  type="button"
                  className="h-8 rounded-md bg-inset px-2 text-xs"
                  onClick={() => studio.moveTimelineClip(studio.selectedClip!.id, studio.selectedClip!.startMs + FRAME_MS, studio.selectedClip!.track)}
                >
                  +1 frame
                </button>
              </div>
              <p className="mt-2 text-[12px] text-muted">Trimming does not rewrite the source file.</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">No clip is selected. Place media on the timeline, then select a clip to adjust start, in/out, volume, or track.</p>
          )}
          <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
            Preferred track
            <select className="rounded-md bg-inset px-2 py-2 text-sm text-ink" value={studio.selectedAudioTrack} onChange={(event) => studio.setSelectedAudioTrack(event.target.value)}>
              {TRACK_META.map((track) => (
                <option key={track.id} value={track.id}>{track.label}</option>
              ))}
            </select>
          </label>
          {studio.timelineGaps.length > 0 ? (
            <button
              type="button"
              className="mt-3 h-9 w-full rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent"
              data-testid="inspector-close-gaps"
              onClick={() => studio.closeTimelineGaps("video")}
            >
              Close {studio.timelineGaps.length} picture gap{studio.timelineGaps.length === 1 ? "" : "s"}
            </button>
          ) : (
            <p className="mt-3 text-[12px] text-muted">No picture gaps on the shared timeline.</p>
          )}
          {pathname === "/audio" ? <p className="mt-3 text-[13px] text-muted">GCIE is not connected. Volume, mute, and fades apply to imported or recorded files only.</p> : null}
        </>
      ) : null}

      {pathname === "/export" ? (
        <>
          <h2 className="m-0 text-base font-bold">Quality & Export</h2>
          <p className="mt-3 text-sm text-muted">The queue encodes the shared timeline with local FFmpeg on this computer. A row is completed only after the MP4 is written.</p>
          <p className="mt-3 text-sm">{studio.warnings.filter((warning) => warning.kind === "export-unsupported" || warning.kind === "clip-media").map((warning) => warning.message).join(" ") || "No export-blocking warnings are stored."}</p>
        </>
      ) : null}

      {pathname === "/connectors" ? (
        <>
          <h2 className="m-0 text-base font-bold">{studio.selectedConnector.name}</h2>
          <p className="mt-3 text-sm text-muted">{studio.selectedConnector.kind} tool</p>
          <p className="mt-2 text-sm">{studio.selectedConnector.detail}</p>
          <p className="mt-2 text-[13px] text-muted">Used by {studio.selectedConnector.usedBy}</p>
          <h3 className="mt-4 text-sm font-bold">Permissions</h3>
          <ul className="mt-2 list-none space-y-2 p-0 text-sm">
            {studio.selectedConnector.permissions.map((permission) => (
              <li key={permission} className="rounded-[9px] bg-inset px-3 py-2">
                {permission}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-muted">This page lists only tools the studio actually uses on this device.</p>
        </>
      ) : null}
    </aside>
  );
}
