"use client";

import { useState } from "react";
import { Pipeline } from "@/components/ui/Pipeline";
import { Timeline } from "@/components/ui/Timeline";
import { useStudio } from "@/lib/studio";

const CONTROLS = ["Face", "Body", "Voice", "Wardrobe"] as const;

export function CharactersWorkspace() {
  const studio = useStudio();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [control, setControl] = useState<(typeof CONTROLS)[number]>("Face");

  if (studio.editorOpen) {
    return (
      <section>
        <h1 className="m-0 text-[26px] font-bold">05 · Individual Character Editor</h1>
        <p className="mt-2 text-[15px] text-muted">Edit every actor independently</p>
        <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-base font-bold">Characters in Scene</h2>
            <button type="button" className="text-sm text-muted" onClick={studio.closeEditor}>
              Back to library
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {studio.characters.map((character) => (
              <button
                key={character.id}
                type="button"
                className={`flex min-h-[110px] items-end rounded-[9px] p-3 text-left font-bold text-[#f1f6ff] ${
                  character.id === studio.selectedCharacterId ? "outline-2 outline-offset-2 outline-ink" : ""
                }`}
                style={{ background: character.color }}
                onClick={() => studio.selectCharacter(character.id)}
              >
                {character.name}
              </button>
            ))}
          </div>
        </article>
        <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <article className="rounded-[10px] bg-card px-5 py-4">
            <h2 className="m-0 text-base font-bold">Individual Controls</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {CONTROLS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`h-9 rounded-md px-3 text-sm ${item === control ? "bg-active" : "bg-inset"}`}
                  onClick={() => setControl(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">{control} for the selected actor. Retake does not start a camera.</p>
            {studio.selectedCharacter ? (
              <dl className="mt-4 grid gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted">Character DNA</dt>
                  <dd className="m-0">{studio.selectedCharacter.dna || "Unset"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Appearance</dt>
                  <dd className="m-0">{studio.selectedCharacter.appearance || "Unset"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Animation style</dt>
                  <dd className="m-0">{studio.selectedCharacter.animationStyle}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Scenes</dt>
                  <dd className="m-0">
                    {studio.selectedCharacter.sceneIds.length
                      ? studio.shots
                          .filter((shot) => studio.selectedCharacter?.sceneIds.includes(shot.id))
                          .map((shot) => shot.label)
                          .join(", ")
                      : "None assigned"}
                  </dd>
                </div>
              </dl>
            ) : null}
            <button
              type="button"
              className="mt-4 h-9 w-[180px] rounded-[7px] bg-accent text-[13px] font-bold text-on-accent"
              onClick={() => studio.recordNote(`Retake marked for ${control}. No capture was started.`)}
            >
              Retake selected
            </button>
          </article>
          <article className="rounded-[10px] bg-card px-5 py-4">
            <h2 className="m-0 text-base font-bold">Independent Performance Tracks</h2>
            <Timeline
              tracks={studio.characters.map((character, index) => ({
                name: character.name,
                color: ["#3478f6", "#23b7a5", "#7258b0", "#9b7741", "#4386b1"][index % 5],
              }))}
            />
          </article>
        </div>
        <Pipeline />
      </section>
    );
  }

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">03 · Character Library</h1>
      <p className="mt-2 text-[15px] text-muted">Create 2D/3D characters, voices, looks, and identities</p>
      <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Character Library</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {studio.characters.map((character) => {
            const selected = character.id === studio.selectedCharacterId;
            return (
              <button
                key={character.id}
                type="button"
                className={`flex min-h-[220px] items-end rounded-[9px] p-4 text-left text-[17px] font-bold text-[#f1f6ff] ${
                  selected ? "outline-2 outline-offset-2 outline-ink" : ""
                }`}
                style={{ background: character.color }}
                onClick={() => studio.openCharacter(character.id)}
              >
                {character.name}
              </button>
            );
          })}
        </div>
        {studio.characters.length === 0 ? <p className="mt-4 text-sm text-muted">No characters in {studio.activeProject.title} yet.</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label>
            <span className="sr-only">Character name</span>
            <input
              className="h-9 rounded-md bg-inset px-3 text-sm text-ink"
              placeholder="Character name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="h-9 w-[190px] rounded-[7px] bg-accent text-[13px] font-bold text-on-accent"
            onClick={() => {
              const error = studio.addCharacter(name);
              if (error) {
                setMessage(error);
                return;
              }
              setName("");
              setMessage("");
            }}
          >
            Create character
          </button>
        </div>
        {message ? <p className="mt-3 text-[13px] text-muted">{message}</p> : null}
      </article>
      <Pipeline />
    </section>
  );
}
