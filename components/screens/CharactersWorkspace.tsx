"use client";

import Link from "next/link";
import { useState } from "react";
import { Pipeline } from "@/components/ui/Pipeline";
import { Timeline } from "@/components/ui/Timeline";
import { PerformanceEditor } from "@/components/characters/PerformanceEditor";
import { useRouter } from "next/navigation";
import { ANIMATION_STYLES, CHARACTER_KINDS, useStudio, type CharacterKind, type CharacterRecord } from "@/lib/studio";

const CONTROLS = ["Face", "Body", "Voice", "Wardrobe"] as const;
const fieldClass = "mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm text-ink";

export function CharactersWorkspace() {
  const studio = useStudio();
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CharacterKind>("human");
  const [species, setSpecies] = useState("");
  const [message, setMessage] = useState("");
  const [control, setControl] = useState<(typeof CONTROLS)[number]>("Face");

  if (studio.editorOpen) {
    return (
      <section>
        <h1 className="m-0 text-[26px] font-bold">05 · Individual Character Editor</h1>
          <p className="mt-2 text-[15px] text-muted">Edit every being independently — human, animal, or any creature</p>
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
                  data-testid={`control-${item.toLowerCase()}`}
                  onClick={() => setControl(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">
              Edit {control.toLowerCase()} for {studio.selectedCharacter?.name ?? "this actor"} on this device. Retake notes do not start the camera.
            </p>
            {studio.selectedCharacter ? (
              <div className="mt-4 space-y-3" data-testid="character-control-fields">
                {control === "Face" ? (
                  <>
                    <label className="block text-xs text-muted">
                      Kind
                      <select
                        className={fieldClass}
                        value={studio.selectedCharacter.kind}
                        data-testid="edit-kind"
                        onChange={(event) => studio.updateCharacter(studio.selectedCharacter!.id, { kind: event.target.value as CharacterKind })}
                      >
                        {CHARACTER_KINDS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs text-muted">
                      Species / form
                      <input
                        className={fieldClass}
                        value={studio.selectedCharacter.species}
                        placeholder="e.g. wolf, dragon, android, human"
                        data-testid="edit-species"
                        onChange={(event) => studio.updateCharacter(studio.selectedCharacter!.id, { species: event.target.value })}
                      />
                    </label>
                    <label className="block text-xs text-muted">
                      Appearance
                      <textarea
                        className={`${fieldClass} min-h-20`}
                        value={studio.selectedCharacter.appearance}
                        placeholder="Face, muzzle, expression, and look notes"
                        data-testid="edit-appearance"
                        onChange={(event) => studio.updateCharacter(studio.selectedCharacter!.id, { appearance: event.target.value })}
                      />
                    </label>
                    <label className="block text-xs text-muted">
                      Look
                      <select
                        className={fieldClass}
                        value={studio.selectedCharacter.look}
                        data-testid="edit-look"
                        onChange={(event) => studio.updateCharacter(studio.selectedCharacter!.id, { look: event.target.value as "2D" | "3D" })}
                      >
                        <option>2D</option>
                        <option>3D</option>
                      </select>
                    </label>
                  </>
                ) : null}
                {control === "Body" ? (
                  <>
                    <label className="block text-xs text-muted">
                      Character DNA
                      <textarea
                        className={`${fieldClass} min-h-20`}
                        value={studio.selectedCharacter.dna}
                        placeholder="Identity, posture, locomotion, and movement notes for any being"
                        data-testid="edit-dna"
                        onChange={(event) => studio.updateCharacter(studio.selectedCharacter!.id, { dna: event.target.value })}
                      />
                    </label>
                    <label className="block text-xs text-muted">
                      Animation style
                      <select
                        className={fieldClass}
                        value={studio.selectedCharacter.animationStyle}
                        data-testid="edit-animation-style"
                        onChange={(event) =>
                          studio.updateCharacter(studio.selectedCharacter!.id, {
                            animationStyle: event.target.value as CharacterRecord["animationStyle"],
                          })
                        }
                      >
                        {ANIMATION_STYLES.map((style) => (
                          <option key={style}>{style}</option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : null}
                {control === "Voice" ? (
                  <label className="block text-xs text-muted">
                    Voice
                    <input
                      className={fieldClass}
                      value={studio.selectedCharacter.voice}
                      placeholder="Voice casting notes"
                      data-testid="edit-voice"
                      onChange={(event) => studio.updateCharacter(studio.selectedCharacter!.id, { voice: event.target.value })}
                    />
                  </label>
                ) : null}
                {control === "Wardrobe" ? (
                  <label className="block text-xs text-muted">
                    Wardrobe
                    <input
                      className={fieldClass}
                      value={studio.selectedCharacter.wardrobe}
                      placeholder="Costume and wardrobe notes"
                      data-testid="edit-wardrobe"
                      onChange={(event) => studio.updateCharacter(studio.selectedCharacter!.id, { wardrobe: event.target.value })}
                    />
                  </label>
                ) : null}
                <p className="m-0 text-xs text-muted">
                  Assigned shots:{" "}
                  {studio.selectedCharacter.sceneIds.length
                    ? studio.shots
                        .filter((shot) => studio.selectedCharacter?.sceneIds.includes(shot.id))
                        .map((shot) => shot.label)
                        .join(", ") || "None"
                    : "None — use the inspector to assign shots"}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">Select a character above to edit their passport.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/capture"
                className="inline-flex h-9 items-center rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent"
                data-testid="record-performance"
                onClick={() => studio.setAssetCategory("characters")}
              >
                Record performance
              </Link>
              <button
                type="button"
                className="h-9 rounded-[7px] bg-inset px-3 text-[13px]"
                data-testid="mark-retake"
                onClick={() => {
                  studio.setAssetCategory("characters");
                  studio.requestCaptureAction("retake");
                  router.push("/capture");
                }}
              >
                Retake on Capture
              </button>
            </div>
          </article>
          <article className="rounded-[10px] bg-card px-5 py-4">
            <h2 className="m-0 text-base font-bold">Independent Performance Tracks</h2>
            <p className="mt-2 text-[12px] text-muted">Bars match real take lengths on this device. Place sends a clip to the shared Edit timeline without rewriting the file.</p>
            <Timeline
              tracks={studio.characters.map((character, index) => ({
                id: character.id,
                name: character.name,
                color: ["#3478f6", "#23b7a5", "#7258b0", "#9b7741", "#4386b1"][index % 5],
                takes: studio.takes
                  .filter((take) => take.characterId === character.id)
                  .map((take) => ({ id: take.id, name: take.name, durationMs: take.durationMs })),
              }))}
              selectedTakeId={studio.selectedTakeId}
              onSelectTake={(takeId) => studio.selectTake(takeId)}
              onPlaceTake={(takeId) => {
                const error = studio.placeTake(takeId);
                setMessage(error || "Take placed on the Edit timeline.");
              }}
            />
            {message ? <p className="mt-3 text-[13px] text-muted" data-testid="character-editor-message">{message}</p> : null}
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
          : "Create humans, animals, and any creatures — 2D/3D looks, voices, and identities"}
      </p>
      <p className="mt-2 text-sm text-muted lg:hidden">Open a character to edit DNA, appearance, voice, wardrobe, scenes, and saved takes.</p>
      {studio.assetCategory === "styles" ? (
        <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
          <h2 className="m-0 text-base font-bold">Styles in this project</h2>
          {studio.characters.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No cast yet.{" "}
              <button type="button" className="text-accent" onClick={() => studio.setAssetCategory("characters")}>
                Create a character
              </button>{" "}
              to assign an animation style.
            </p>
          ) : (
            <ul className="mt-3 list-none space-y-2 p-0">
              {studio.characters.map((character) => (
                <li key={character.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[9px] bg-inset px-3 py-3 text-sm">
                  <button type="button" className="font-bold" onClick={() => studio.openCharacter(character.id)}>
                    {character.name}
                  </button>
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
          )}
        </article>
      ) : null}
      <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Character Library</h2>
        <p className="mt-2 text-sm text-muted">
          Project: {studio.activeProject.title}. Name any being, pick a kind, then record on Capture.
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
                <span className="block">
                  {character.name}
                  <span className="mt-1 block text-xs font-normal opacity-90">
                    {character.kind}
                    {character.species ? ` · ${character.species}` : ""} · {studio.takes.filter((take) => take.characterId === character.id).length} takes
                  </span>
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
              placeholder="Name any being"
              value={name}
              data-testid="character-name"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const error = studio.addCharacter(name, { kind, species: species.trim() });
                if (error) {
                  setMessage(error);
                  return;
                }
                const created = name.trim();
                setName("");
                setSpecies("");
                setMessage(`“${created}” (${kind}) saved. Record a performance when ready.`);
              }}
            />
          </label>
          <label>
            <span className="sr-only">Kind</span>
            <select
              className="h-9 rounded-md bg-inset px-3 text-sm text-ink"
              value={kind}
              data-testid="character-kind"
              onChange={(event) => setKind(event.target.value as CharacterKind)}
            >
              {CHARACTER_KINDS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Species or form</span>
            <input
              className="h-9 rounded-md bg-inset px-3 text-sm text-ink"
              placeholder="Species / form"
              value={species}
              data-testid="character-species"
              onChange={(event) => setSpecies(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={`h-9 w-[190px] rounded-[7px] text-[13px] font-bold ${
              studio.characters.length === 0 ? "bg-accent text-on-accent" : "bg-inset text-ink"
            }`}
            data-testid="create-character"
            onClick={() => {
              const error = studio.addCharacter(name, { kind, species: species.trim() });
              if (error) {
                setMessage(error);
                return;
              }
              const created = name.trim();
              setName("");
              setSpecies("");
              setMessage(`“${created}” (${kind}) saved. Record a performance when ready.`);
            }}
          >
            Create character
          </button>
          {studio.characters.length > 0 ? (
            <Link
              href="/capture"
              className="inline-flex h-9 items-center rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent"
              data-testid="go-capture"
              onClick={() => studio.setAssetCategory("characters")}
            >
              Record on Capture
            </Link>
          ) : null}
          <Link href="/projects" className="inline-flex h-9 items-center rounded-[7px] bg-inset px-4 text-[13px] text-muted">
            Projects
          </Link>
        </div>
        {message ? <p className="mt-3 text-[13px] text-muted" data-testid="character-message">{message}</p> : null}
      </article>
      <Pipeline />
    </section>
  );
}
