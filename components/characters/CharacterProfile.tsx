"use client";

import { useState } from "react";
import { ANIMATION_STYLES, useStudio, type CharacterRecord } from "@/lib/studio";

const fieldClass = "rounded-md bg-inset px-2 py-2 text-sm text-ink";

export function CharacterProfile({ character }: { character: CharacterRecord }) {
  const studio = useStudio();
  const [confirming, setConfirming] = useState(false);

  return (
    <div>
      <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
        Name
        <input className={fieldClass} value={character.name} onChange={(event) => studio.updateCharacter(character.id, { name: event.target.value })} />
      </label>
      <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
        Character DNA
        <textarea
          className={`${fieldClass} min-h-16`}
          value={character.dna}
          placeholder="Identity notes stored on this device"
          onChange={(event) => studio.updateCharacter(character.id, { dna: event.target.value })}
        />
      </label>
      <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
        Appearance
        <textarea
          className={`${fieldClass} min-h-16`}
          value={character.appearance}
          placeholder="Face, body, and look notes"
          onChange={(event) => studio.updateCharacter(character.id, { appearance: event.target.value })}
        />
      </label>
      <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
        Look
        <select
          className={fieldClass}
          value={character.look}
          onChange={(event) => studio.updateCharacter(character.id, { look: event.target.value as "2D" | "3D" })}
        >
          <option>2D</option>
          <option>3D</option>
        </select>
      </label>
      <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
        Voice
        <input className={fieldClass} value={character.voice} onChange={(event) => studio.updateCharacter(character.id, { voice: event.target.value })} />
      </label>
      <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
        Wardrobe
        <input className={fieldClass} value={character.wardrobe} onChange={(event) => studio.updateCharacter(character.id, { wardrobe: event.target.value })} />
      </label>
      <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
        Animation style
        <select
          className={fieldClass}
          value={character.animationStyle}
          onChange={(event) => studio.updateCharacter(character.id, { animationStyle: event.target.value as CharacterRecord["animationStyle"] })}
        >
          {ANIMATION_STYLES.map((style) => (
            <option key={style}>{style}</option>
          ))}
        </select>
      </label>
      <fieldset className="mt-3">
        <legend className="text-xs text-muted">Scene assignments</legend>
        <div className="mt-2 flex flex-col gap-2">
          {studio.shots.map((shot) => (
            <label key={shot.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={character.sceneIds.includes(shot.id)}
                onChange={(event) => studio.setSceneAssignment(character.id, shot.id, event.target.checked)}
              />
              {shot.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-[13px] text-muted">Profile stays in project {studio.activeProject.title}. Nothing is uploaded.</p>
      {confirming ? (
        <div className="mt-3">
          <p className="text-sm">Delete {character.name} from this project?</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent" onClick={() => studio.deleteCharacter(character.id)}>
              Delete character
            </button>
            <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-[13px]" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="mt-3 text-sm text-muted" onClick={() => setConfirming(true)}>
          Delete character
        </button>
      )}
    </div>
  );
}
