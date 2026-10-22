"use client";

import { useState } from "react";
import { useStudio } from "@/lib/studio";

export function CharactersWorkspace() {
  const studio = useStudio();
  const [name, setName] = useState("");

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
                onClick={() => studio.selectCharacter(character.id)}
              >
                {character.name}
              </button>
            );
          })}
        </div>
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
              studio.addCharacter(name);
              setName("");
            }}
          >
            Create character
          </button>
        </div>
      </article>
      <p className="pt-6 text-[11px] tracking-wide text-pipeline">
        PROJECT → DIRECTOR → CHARACTERS → SCENES → AUDIO → EDIT → EXPORT
      </p>
    </section>
  );
}
