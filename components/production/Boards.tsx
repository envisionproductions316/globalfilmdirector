"use client";

import { useState } from "react";
import { TimelinePreview } from "@/components/timeline/TimelinePreview";
import { useStudio } from "@/lib/studio";

const buttonClass = "h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent";

export function SequenceBoard() {
  const studio = useStudio();
  const [dragId, setDragId] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
      <article className="rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Story Sequence • Drag to reorder</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {studio.scenes.map((scene) => (
            <div
              key={scene.id}
              draggable
              onDragStart={() => setDragId(scene.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dragId && studio.moveScene(dragId, scene.id)}
              className="rounded-[9px] bg-inset p-3 text-left"
              onClick={() => studio.selectScene(scene.id)}
            >
              <span className="block h-16 rounded-[8px]" style={{ background: scene.color }} />
              <span className="mt-3 block text-sm font-bold">{scene.number}. {scene.title}</span>
              <span className="mt-1 block text-xs text-muted">{scene.status}</span>
              <span className="mt-2 flex gap-2">
                <button type="button" className="rounded bg-card px-2 py-1 text-xs text-ink" onClick={(event) => { event.stopPropagation(); const previous = studio.scenes[studio.scenes.indexOf(scene) - 1]; if (previous) studio.moveScene(scene.id, previous.id); }}>Earlier</button>
                <button type="button" className="rounded bg-card px-2 py-1 text-xs text-ink" onClick={(event) => { event.stopPropagation(); const next = studio.scenes[studio.scenes.indexOf(scene) + 1]; if (next) studio.moveScene(scene.id, next.id); }}>Later</button>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={studio.addScene}>+ Add scene</button>
          <button type="button" className={buttonClass} onClick={() => { setNote("No sequence model is connected. The order was not changed."); studio.recordNote("AI arrange was not run. No sequence model is connected."); }}>AI arrange sequence</button>
          <button type="button" className={buttonClass} onClick={() => { const lines = studio.warnings.map((warning) => warning.message); setNote(lines.length ? lines.join(" ") : "Local check found no conflicts. No continuity service reviewed the story."); studio.recordNote(lines.length ? `${lines.length} continuity warning(s) are listed on this device.` : "Local continuity check found no conflicts."); }}>Check continuity</button>
          <button type="button" className={buttonClass} onClick={() => { const approved = studio.scenes.filter((scene) => scene.status === "Approved"); const linked = studio.takes.find((take) => approved.some((scene) => scene.id === take.sceneId)); const placement = linked ? studio.placeTake(linked.id) : "No saved take is attached to an approved scene."; setNote(placement || `${linked?.name ?? "Take"} is on the shared timeline.`); studio.recordNote(placement || `${linked?.name ?? "Take"} was placed on the timeline.`); }}>Send approved to Edit</button>
        </div>
        {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
      </article>
      <article className="rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Continuity Assistant</h2>
        <ul className="mt-4 list-none space-y-3 p-0 text-sm">
          {["Character identity", "Wardrobe consistency", "Voice continuity", "Location / time check", "Entry / exit positions", "Props and camera axis", "Transitions to next scene"].map((item) => (
            <li key={item}>{item} · not reviewed</li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] text-muted">No continuity assistant is connected.</p>
      </article>
    </div>
  );
}

export function SceneDetail() {
  const studio = useStudio();
  const scene = studio.selectedScene;
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!scene) return <p className="mt-4 text-sm text-muted">This project has no scenes.</p>;
  const field = "mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm text-ink";
  const linkedTakes = studio.takes.filter((take) => take.sceneId === scene.id);
  const linkedShots = studio.shots.filter((shot) => shot.sceneId === scene.id);
  return (
    <div className="mt-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <article className="rounded-[10px] bg-card px-5 py-4">
          <h2 className="m-0 text-base font-bold">{scene.title}</h2>
          <label className="mt-3 block text-xs text-muted">
            Title
            <input className={field} value={scene.title} onChange={(event) => studio.updateScene(scene.id, { title: event.target.value })} />
          </label>
          <label className="mt-3 block text-xs text-muted">
            Description
            <textarea className={field} value={scene.description} onChange={(event) => studio.updateScene(scene.id, { description: event.target.value })} />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Location
              <input className={field} value={scene.location} onChange={(event) => studio.updateScene(scene.id, { location: event.target.value, world: event.target.value })} />
            </label>
            <label className="text-xs text-muted">
              Time of day
              <input className={field} value={scene.timeOfDay} onChange={(event) => studio.updateScene(scene.id, { timeOfDay: event.target.value })} />
            </label>
            <label className="text-xs text-muted">
              Camera
              <input className={field} value={scene.camera} onChange={(event) => studio.updateScene(scene.id, { camera: event.target.value })} />
            </label>
            <label className="text-xs text-muted">
              Movement
              <input className={field} value={scene.movement} onChange={(event) => studio.updateScene(scene.id, { movement: event.target.value })} />
            </label>
            <label className="text-xs text-muted">
              Duration
              <input className={field} value={scene.duration} onChange={(event) => studio.updateScene(scene.id, { duration: event.target.value })} />
            </label>
            <label className="text-xs text-muted">
              Music
              <input className={field} value={scene.music} onChange={(event) => studio.updateScene(scene.id, { music: event.target.value })} />
            </label>
          </div>
          <label className="mt-3 block text-xs text-muted">
            Action
            <textarea className={field} value={scene.action} onChange={(event) => studio.updateScene(scene.id, { action: event.target.value })} />
          </label>
          <label className="mt-3 block text-xs text-muted">
            Dialogue
            <textarea className={field} value={scene.dialogue} onChange={(event) => studio.updateScene(scene.id, { dialogue: event.target.value })} />
          </label>
          <label className="mt-3 block text-xs text-muted">
            Sound notes
            <textarea className={field} value={scene.soundNotes} onChange={(event) => studio.updateScene(scene.id, { soundNotes: event.target.value })} />
          </label>
          <p className="mt-3 text-sm text-muted">Stage {scene.stage}. Number {scene.number}. Passport {scene.passport}. Rights {scene.rights}.</p>
        </article>
        <article className="rounded-[10px] bg-card px-5 py-4">
          <h2 className="m-0 text-base font-bold">Linked Production Assets</h2>
          <h3 className="mt-4 text-sm font-bold">Characters</h3>
          <ul className="mt-2 list-none space-y-2 p-0 text-sm">
            {studio.characters.map((character) => (
              <li key={character.id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={scene.characterIds.includes(character.id)}
                    onChange={(event) =>
                      studio.updateScene(scene.id, {
                        characterIds: event.target.checked
                          ? [...scene.characterIds, character.id]
                          : scene.characterIds.filter((id) => id !== character.id),
                      })
                    }
                  />
                  {character.name}
                </label>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-sm font-bold">Shots</h3>
          <ul className="mt-2 list-none space-y-2 p-0 text-sm">
            {linkedShots.length === 0 ? <li className="text-muted">No shots assigned.</li> : linkedShots.map((shot) => <li key={shot.id}>{shot.label} · {shot.camera}</li>)}
          </ul>
          <h3 className="mt-4 text-sm font-bold">Takes</h3>
          <ul className="mt-2 list-none space-y-2 p-0 text-sm">
            {linkedTakes.length === 0 ? <li className="text-muted">No recordings assigned.</li> : linkedTakes.map((take) => <li key={take.id}>{take.name} · {studio.characters.find((character) => character.id === take.characterId)?.name ?? "Missing character"}</li>)}
          </ul>
        </article>
      </div>
      <article className="mt-4 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Approval & Handoff</h2>
        <p className="mt-3 text-sm">Draft → Continuity Review → Approved → Animation / Edit / Audio</p>
        <p className="mt-2 text-[13px] text-muted">Current stage: {scene.stage}. Handoffs stay on this device.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={() => studio.approveScene(scene.id)}>Approve scene</button>
          <button type="button" className={buttonClass} onClick={() => studio.duplicateScene(scene.id)}>Duplicate scene</button>
          {confirmDelete ? (
            <button type="button" className={buttonClass} onClick={() => studio.deleteScene(scene.id)}>Confirm delete</button>
          ) : (
            <button type="button" className={buttonClass} onClick={() => setConfirmDelete(true)}>Delete scene</button>
          )}
          <button type="button" className={buttonClass} onClick={() => { setNote("Noted for animation. No animation tool is connected."); studio.recordNote("Scene noted for animation. No animation tool is connected."); }}>Send to animation</button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              const placed = studio.placeScene(scene.id);
              studio.setAssetCategory("music");
              studio.setSelectedAudioTrack("music");
              setNote(placed || "Scene recordings were placed on the shared timeline. Open Audio to mix them.");
              studio.recordNote(placed || "Scene recordings were placed on the shared timeline for Audio.");
            }}
          >
            Send to Music & Audio
          </button>
        </div>
        {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
      </article>
    </div>
  );
}

export function ContinuityBoard() {
  const studio = useStudio();
  const [sceneForShot, setSceneForShot] = useState<Record<string, string>>({});
  return (
    <article className="mt-4 rounded-[10px] bg-card px-5 py-4">
      <h2 className="m-0 text-base font-bold">26 · Continuity Rules & Conflict Review</h2>
      <p className="mt-2 text-sm text-muted">These checks stay on this device. Approving or editing remains your choice. Nothing here rewrites a scene on its own.</p>
      {studio.warnings.length === 0 ? <p className="mt-4 text-sm">No continuity warnings for {studio.activeProject.title}.</p> : null}
      <ul className="mt-4 list-none space-y-3 p-0">
        {studio.warnings.map((warning) => (
          <li key={warning.id} className="rounded-[9px] bg-inset px-3 py-3 text-sm">
            <p className="m-0">{warning.message}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {warning.kind === "missing-character" ? (
                <button type="button" className={buttonClass} onClick={() => studio.removeSceneCharacter(warning.sceneId, warning.characterId)}>Remove missing character</button>
              ) : null}
              {warning.kind === "approved-modified" ? (
                <>
                  <button type="button" className={buttonClass} onClick={() => studio.confirmSceneVersion(warning.sceneId)}>Confirm this version</button>
                  <button type="button" className={buttonClass} onClick={() => studio.markSceneNeedsReview(warning.sceneId)}>Mark needs review</button>
                </>
              ) : null}
              {warning.kind === "shot-scene" ? (
                <>
                  <select className="h-9 rounded-md bg-card px-2 text-sm" value={sceneForShot[warning.shotId] || studio.selectedSceneId} onChange={(event) => setSceneForShot((current) => ({ ...current, [warning.shotId]: event.target.value }))}>
                    {studio.scenes.map((scene) => (
                      <option key={scene.id} value={scene.id}>{scene.title}</option>
                    ))}
                  </select>
                  <button type="button" className={buttonClass} onClick={() => studio.updateShot(warning.shotId, { sceneId: sceneForShot[warning.shotId] || studio.selectedSceneId })}>Assign shot</button>
                </>
              ) : null}
              {warning.kind === "take-cast" ? (
                <button type="button" className={buttonClass} onClick={() => studio.updateScene(warning.sceneId, { characterIds: [...new Set([...(studio.scenes.find((scene) => scene.id === warning.sceneId)?.characterIds ?? []), warning.characterId])] })}>Add character to scene</button>
              ) : null}
              {warning.kind === "take-character" || warning.kind === "missing-media" || warning.kind === "take-scene" ? (
                <button type="button" className={buttonClass} onClick={() => { void studio.deleteTake(warning.takeId).then((message) => { if (message) studio.recordNote(message); }); }}>Delete take</button>
              ) : null}
              {warning.kind === "clip-take" || warning.kind === "clip-media" ? (
                <button type="button" className={buttonClass} onClick={() => studio.deleteClip(warning.clipId)}>Remove clip</button>
              ) : null}
              {warning.kind === "unapproved-scene" ? (
                <>
                  <button type="button" className={buttonClass} onClick={() => studio.approveScene(warning.sceneId)}>Approve scene</button>
                  <button type="button" className={buttonClass} onClick={() => studio.removeSceneClips(warning.sceneId)}>Remove scene clips</button>
                </>
              ) : null}
              {warning.kind === "audio-overrun" ? (
                <button type="button" className={buttonClass} onClick={() => studio.fitClipToPicture(warning.clipId)}>Trim to picture</button>
              ) : null}
              {warning.kind === "timeline-gap" ? (
                <button type="button" className={buttonClass} data-testid="continuity-close-gaps" onClick={() => studio.closeTimelineGaps("video")}>
                  Close picture gaps
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function GraphBoard() {
  const studio = useStudio();
  const [note, setNote] = useState("");
  const columns = [
    ["Scenes", studio.scenes.map((scene) => scene.title)],
    ["Characters", studio.characters.map((character) => character.name)],
    ["Performances", studio.takes.map((take) => take.name)],
    ["Audio", studio.clips.filter((clip) => clip.track === "dialogue" || clip.track === "voice" || clip.track === "music" || clip.track === "sfx").map((clip) => clip.name)],
    ["Outputs", [
      "Storyboard",
      "No rendered animation",
      ...(studio.clips.some((clip) => clip.track === "video") ? studio.clips.filter((clip) => clip.track === "video").map((clip) => clip.name) : ["No timeline picture"]),
      ...studio.jobs.filter((job) => !job.sample).map((job) => job.label),
    ]],
  ];
  return (
    <div className="mt-4">
      <article className="rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Production Graph • Linked Objects</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {columns.map(([title, items]) => (
            <section key={String(title)} className="rounded-[9px] bg-inset p-3">
              <h3 className="m-0 text-sm font-bold">{title}</h3>
              <ul className="mt-3 list-none space-y-2 p-0 text-sm">
                {(items as string[]).length === 0 ? <li className="text-muted">None in this project</li> : null}
                {(items as string[]).map((item, index) => (
                  <li key={`${String(title)}-${index}`} className="rounded-[8px] bg-card px-3 py-3">{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-muted">Local map for {studio.activeProject.title}. Links are not sent to a render service.</p>
      </article>
      <article className="mt-4 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Change Impact Review</h2>
        <p className="mt-3 text-sm">Changing a character voice may require lip-sync review, captions update, and a selected audio pass. None of those services are connected.</p>
        <button type="button" className={`${buttonClass} mt-3`} onClick={() => { setNote("Affected items stay in this project: character voice, scene music cue, and captions. Nothing was re-rendered."); studio.recordNote("Impact preview stayed on this device. No re-render was started."); }}>Preview affected items</button>
        {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
      </article>
    </div>
  );
}

export function CueBoard() {
  const studio = useStudio();
  const [note, setNote] = useState("");
  return (
    <div className="mt-4">
      <article className="rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Scene-aligned Music & Sound</h2>
        <p className="mt-3 text-[13px] text-muted">Cue rows follow the shared timeline. Bars are not a second mix.</p>
        <ul className="mt-3 list-none space-y-3 p-0">
          {studio.clips.filter((clip) => clip.track === "music" || clip.track === "sfx" || clip.track === "dialogue" || clip.track === "voice").map((clip) => (
            <li key={clip.id} className="rounded-[9px] bg-inset px-3 py-3 text-sm">
              <p className="m-0 font-bold">{clip.name}</p>
              <label className="mt-2 block text-xs text-muted">
                Scene
                <select className="mt-1 h-9 w-full rounded-md bg-card px-2 text-sm text-ink" value={clip.sceneId} onChange={(event) => studio.updateClip(clip.id, { sceneId: event.target.value })}>
                  <option value="">Unassigned</option>
                  {studio.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.number}. {scene.title}</option>)}
                </select>
              </label>
              <button type="button" className={`${buttonClass} mt-2`} onClick={() => {
                const sceneId = clip.sceneId || studio.selectedSceneId;
                const anchor = studio.clips.filter((item) => item.track === "video" && item.sceneId === sceneId).sort((a, b) => a.startMs - b.startMs)[0];
                studio.moveTimelineClip(clip.id, anchor?.startMs ?? 0, clip.track);
                setNote(anchor ? `${clip.name} now starts with the scene picture.` : `${clip.name} starts at the beginning. That scene has no picture.`);
              }}>Align to scene picture</button>
            </li>
          ))}
          {studio.clips.every((clip) => clip.track === "video" || clip.track === "motion" || clip.track === "captions") ? <li className="text-sm text-muted">No dialogue, narration, music, or effects are on the timeline.</li> : null}
        </ul>
      </article>
      <article className="mt-4 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Cue-to-Scene Mapping</h2>
        <ul className="mt-3 list-none space-y-2 p-0 text-sm">
          {studio.scenes.filter((scene) => scene.music !== "Pending").map((scene) => (
            <li key={scene.id}>{scene.title} → {scene.music}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={() => { setNote("No beat grid is connected. Cues were not moved."); studio.recordNote("Align to beat was not run. No beat grid is connected."); }}>Align to beat</button>
          <button type="button" className={buttonClass} onClick={() => { setNote("Cue map saved on this device."); studio.saveLocal(); }}>Save cue map</button>
        </div>
        {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
        <TimelinePreview caption="This plays the shared timeline, including music and dialogue that are already placed. It is not a separate mix." />
      </article>
    </div>
  );
}

const QC = ["Scene order", "Character appearance", "Wardrobe and props", "Camera continuity", "Dialogue and lip sync", "Music cue alignment", "Caption timing", "Rights and budget"];

export function AssemblyBoard() {
  const studio = useStudio();
  const [checked, setChecked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  return (
    <div className="mt-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <article className="rounded-[10px] bg-card px-5 py-4">
          <h2 className="m-0 text-base font-bold">Final Assembly Preview</h2>
          {studio.clips.length > 0 ? (
            <TimelinePreview caption="Playback follows the shared timeline. Transitions are part of the MP4 only after you export." />
          ) : (
            <div className="mt-4 grid min-h-[220px] place-items-center rounded-[9px] bg-[#37456d] p-4 text-center text-[#f1f6ff]">
              The timeline has no clips. No cut has been rendered.
            </div>
          )}
          <p className="mt-3 text-sm text-muted">Scene transitions and music synchronization are checklist items, not a player.</p>
        </article>
        <article className="rounded-[10px] bg-card px-5 py-4">
          <h2 className="m-0 text-base font-bold">Continuity & Quality Checks</h2>
          <ul className="mt-4 list-none space-y-2 p-0 text-sm">
            {QC.map((item) => (
              <li key={item}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked.includes(item)}
                    onChange={(event) => setChecked((current) => event.target.checked ? [...current, item] : current.filter((entry) => entry !== item))}
                  />
                  {item}
                </label>
              </li>
            ))}
          </ul>
        </article>
      </div>
      <article className="mt-4 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Revision History & Approvals</h2>
        <p className="mt-3 text-sm">Scene edits stay in this project. Dependent services are not updated automatically.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={() => setNote("There is one local copy. No earlier render exists to compare.")}>Compare versions</button>
          <button type="button" className={buttonClass} onClick={() => { const count = studio.warnings.length; setNote(count ? `${count} local continuity warning(s). No QC service ran.` : "No local continuity warnings. No QC service ran."); studio.recordNote(count ? `${count} continuity warning(s) remain. No QC service ran.` : "Continuity QC was not run. No local warnings were found."); }}>Run continuity QC</button>
          <button type="button" className={buttonClass} onClick={() => { setNote("Use Export to encode the shared timeline. This button does not render a cut."); studio.recordNote("Assembly stayed on this device. No encode was started."); }}>Export approved cut</button>
        </div>
        {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
      </article>
    </div>
  );
}
