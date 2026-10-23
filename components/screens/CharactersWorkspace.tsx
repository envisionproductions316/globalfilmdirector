"use client";

import Link from "next/link";
import { useState } from "react";
import { Pipeline } from "@/components/ui/Pipeline";
import { Timeline } from "@/components/ui/Timeline";
import { PerformanceEditor } from "@/components/characters/PerformanceEditor";
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
            <p className="mt-3 text-sm text-muted lg:hidden">Profile fields are in the inspector. Performances for this character are below.</p>
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
                  <dt className="text-xs text-muted">Assigned shots</dt>
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/capture"
                className="inline-flex h-9 items-center rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent"
                data-testid="record-performance"
              >
                Record performance
              </Link>
              <button
                type="button"
                className="h-9 rounded-[7px] bg-inset px-3 text-[13px]"
                onClick={() => studio.recordNote(`Retake marked for ${control}. No capture was started.`)}
              >
                Mark retake note
              </button>
            </div>
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
        <PerformanceEditor />
        <Pipeline />
      </section>
    );
  }

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">{studio.assetCategory === "styles" ? "Visual Styles" : "03 · Character Library"}</h1>
      <p className="mt-2 text-[15px] text-muted">
        {studio.assetCategory === "styles"
          ? "Animation styles from each character passport. No AI style engine is connected."
          : "Create 2D/3D characters, voices, looks, and identities"}
      </p>
      <p className="mt-2 text-sm text-muted lg:hidden">Open a character to edit DNA, appearance, voice, wardrobe, scenes, and saved takes.</p>
      {studio.assetCategory === "styles" ? (
        <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
          <h2 className="m-0 text-base font-bold">Styles in this project</h2>
          <ul className="mt-3 list-none space-y-2 p-0">
            {studio.characters.map((character) => (
              <li key={character.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[9px] bg-inset px-3 py-3 text-sm">
                <button type="button" className="font-bold" onClick={() => studio.openCharacter(character.id)}>{character.name}</button>
                <select
                  className="rounded-md bg-card px-2 py-1.5 text-sm"
                  value={character.animationStyle}
                  onChange={(event) => studio.updateCharacter(character.id, { animationStyle: event.target.value as typeof character.animationStyle })}
                >
                  {["Unassigned", "Realistic", "Stylized", "Limited", "Graphic"].map((style) => (
                    <option key={style}>{style}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
      <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Character Library</h2>
        <p className="mt-2 text-sm text-muted">
          Project: {studio.activeProject.title}. Type a name, create the character, then record on Capture.
        </p>
        {studio.activeProject.directorNote ? (
          <p className="mt-2 rounded-[9px] bg-inset px-3 py-2 text-sm text-muted" data-testid="project-brief">
            Brief: {studio.activeProject.directorNote.length > 220 ? `${studio.activeProject.directorNote.slice(0, 217)}…` : studio.activeProject.directorNote}
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {studio.characters.map((character) => {
            const selected = character.id === studio.selectedCharacterId;
            return (
              <button
                key={character.id}
                type="button"
                className={`flex min-h-[120px] items-end rounded-[9px] p-4 text-left text-[17px] font-bold text-[#f1f6ff] lg:min-h-[220px] ${
                  selected ? "outline-2 outline-offset-2 outline-ink" : ""
                }`}
                style={{ background: character.color }}
                onClick={() => studio.openCharacter(character.id)}
              >
                {character.name}
                <span className="mt-1 block text-xs font-normal">
                  {studio.takes.filter((take) => take.characterId === character.id).length} takes
                </span>
              </button>
            );
          })}
        </div>
        {studio.characters.length === 0 ? <p className="mt-4 text-sm text-muted">No characters in {studio.activeProject.title} yet. Add your first cast member below.</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label>
            <span className="sr-only">Character name</span>
            <input
              className="h-9 rounded-md bg-inset px-3 text-sm text-ink"
              placeholder="Character name"
              value={name}
              data-testid="character-name"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const error = studio.addCharacter(name);
                if (error) {
                  setMessage(error);
                  return;
                }
                setName("");
                setMessage(`“${name.trim()}” saved. Record a performance when ready.`);
              }}
            />
          </label>
          <button
            type="button"
            className="h-9 w-[190px] rounded-[7px] bg-accent text-[13px] font-bold text-on-accent"
            data-testid="create-character"
            onClick={() => {
              const error = studio.addCharacter(name);
              if (error) {
                setMessage(error);
                return;
              }
              const created = name.trim();
              setName("");
              setMessage(`“${created}” saved. Record a performance when ready.`);
            }}
          >
            Create character
          </button>
          {studio.characters.length > 0 ? (
            <Link
              href="/capture"
              className="inline-flex h-9 items-center rounded-[7px] bg-inset px-4 text-[13px] font-bold text-ink"
              data-testid="go-capture"
            >
              Record on Capture
            </Link>
          ) : null}
        </div>
        {message ? <p className="mt-3 text-[13px] text-muted" data-testid="character-message">{message}</p> : null}
      </article>
      <Pipeline />
    </section>
  );
}
