"use client";

import { Pipeline } from "@/components/ui/Pipeline";
import { useStudio } from "@/lib/studio";

const TRACKS = [
  { name: "Dialogue", color: "#3478f6" },
  { name: "Lead vocal", color: "#23b7a5" },
  { name: "Harmony", color: "#7258b0" },
  { name: "Instrumental", color: "#9b7741" },
  { name: "Sound FX", color: "#4386b1" },
  { name: "Ambience", color: "#3478f6" },
  { name: "Captions", color: "#23b7a5" },
];

export function AudioWorkspace() {
  const studio = useStudio();

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">08 · Audio & Music Studio</h1>
      <p className="mt-2 text-[15px] text-muted">Dialogue, voices, songs, dubbing, and mixing</p>
      <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Audio Mixer</h2>
        <div className="mt-4 flex flex-col gap-2" role="listbox" aria-label="Audio tracks">
          {TRACKS.map((track) => (
            <button
              key={track.name}
              type="button"
              className={`grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-3 rounded-md p-1 text-left ${
                track.name === studio.selectedAudioTrack ? "outline outline-accent" : ""
              }`}
              onClick={() => studio.setSelectedAudioTrack(track.name)}
            >
              <span className="text-xs text-muted">{track.name}</span>
              <span className="grid grid-cols-4 gap-1 rounded bg-inset p-1" aria-hidden="true">
                {Array.from({ length: 4 }, (_, index) => (
                  <span key={index} className="block h-[22px] rounded-sm" style={{ background: track.color }} />
                ))}
              </span>
            </button>
          ))}
        </div>
      </article>
      <Pipeline />
    </section>
  );
}
