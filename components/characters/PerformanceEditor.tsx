"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getMedia } from "@/lib/media-db";
import { useStudio, type TakeRecord } from "@/lib/studio";

const fieldClass = "mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm text-ink";

function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function PerformanceEditor() {
  const studio = useStudio();
  const character = studio.selectedCharacter;
  const takes = studio.takes.filter((take) => take.characterId === character?.id);
  const selected = takes.find((take) => take.id === studio.selectedTakeId) ?? takes[0];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [missing, setMissing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [keepWarning, setKeepWarning] = useState("");
  const [placeMessage, setPlaceMessage] = useState("");

  useEffect(() => {
    let url = "";
    let cancelled = false;
    setMissing(false);
    if (!selected?.mediaId) return;
    void getMedia(selected.mediaId)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setMissing(true);
          return;
        }
        url = URL.createObjectURL(record.blob);
        if (videoRef.current) {
          videoRef.current.src = url;
        }
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selected?.mediaId]);

  if (!character) return <p className="mt-4 text-sm text-muted">Select a character to see performances.</p>;

  function patch(take: TakeRecord, next: Partial<TakeRecord>) {
    studio.updateTake(take.id, next);
  }

  return (
    <article className="mt-4 rounded-[10px] bg-card px-5 py-4">
      <h2 className="m-0 text-base font-bold">Performance history · {character.name}</h2>
      <p className="mt-2 text-sm text-muted">Takes stay with this character. Saving here does not replace another character&apos;s recording. DNA, appearance, wardrobe, voice, and animation style stay in the inspector.</p>
      {takes.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No recordings for {character.name} yet.{" "}
          <Link href="/capture" className="text-accent" onClick={() => studio.setAssetCategory("characters")}>
            Open Capture
          </Link>{" "}
          to record.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {takes.map((take) => (
          <button
            key={take.id}
            type="button"
            className={`h-9 rounded-md px-3 text-sm ${take.id === selected?.id ? "bg-active" : "bg-inset"}`}
            onClick={() => {
              setConfirmDelete(false);
              setPlaceMessage("");
              studio.selectTake(take.id);
            }}
          >
            {take.name}
          </button>
        ))}
      </div>
      {selected ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <video ref={videoRef} className="max-h-64 w-full rounded-[9px] bg-[#30455f]" controls playsInline />
            {missing ? <p className="mt-2 text-sm text-muted">The recording file is missing from this device.</p> : null}
            <p className="mt-2 text-xs text-muted">
              {formatDuration(selected.durationMs)} · {selected.cameraLabel} · {selected.microphoneLabel} · {selected.tracking} · Retarget {selected.retarget}
            </p>
          </div>
          <div>
            <label className="block text-xs text-muted">
              Take name
              <input className={fieldClass} value={selected.name} onChange={(event) => patch(selected, { name: event.target.value })} />
            </label>
            <label className="mt-3 block text-xs text-muted">
              Scene
              <select className={fieldClass} value={selected.sceneId} onChange={(event) => patch(selected, { sceneId: event.target.value })}>
                <option value="">Unassigned</option>
                {studio.scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs text-muted">
              Approval
              <select
                className={fieldClass}
                value={selected.approval}
                onChange={(event) =>
                  patch(selected, { approval: event.target.value === "Approved" || event.target.value === "In review" ? event.target.value : "Draft" })
                }
              >
                <option>Draft</option>
                <option>In review</option>
                <option>Approved</option>
              </select>
            </label>
            <label className="mt-3 block text-xs text-muted">
              Dialogue
              <textarea className={fieldClass} value={selected.dialogue} onChange={(event) => patch(selected, { dialogue: event.target.value })} />
            </label>
            <label className="mt-3 block text-xs text-muted">
              Performance notes
              <textarea className={fieldClass} value={selected.notes} onChange={(event) => patch(selected, { notes: event.target.value })} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent"
                data-testid="place-performance-take"
                onClick={() => {
                  const error = studio.placeTake(selected.id);
                  setPlaceMessage(error || `${selected.name} was placed on the shared timeline.`);
                }}
              >
                Add to Timeline
              </button>
              <Link href="/edit" className="inline-flex h-9 items-center rounded-[7px] bg-inset px-3 text-sm" onClick={() => studio.setAssetCategory("media")}>
                Open Edit
              </Link>
            </div>
            {placeMessage ? <p className="mt-2 text-sm text-muted" data-testid="place-performance-message">{placeMessage}</p> : null}
            {keepWarning ? (
              <div className="mt-3">
                <p className="text-sm">{keepWarning}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent"
                    onClick={() => {
                      setKeepWarning("");
                      void studio.deleteTake(selected.id, true);
                    }}
                  >
                    Delete the recording anyway
                  </button>
                  <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" onClick={() => setKeepWarning("")}>
                    Keep the recording
                  </button>
                </div>
              </div>
            ) : confirmDelete ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent"
                  onClick={() => {
                    void studio.deleteTake(selected.id).then((message) => {
                      setConfirmDelete(false);
                      if (message) setKeepWarning(message);
                    });
                  }}
                >
                  Delete take
                </button>
                <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="mt-3 text-sm text-muted" onClick={() => setConfirmDelete(true)}>
                Delete take
              </button>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
