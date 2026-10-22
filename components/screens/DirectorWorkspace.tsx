"use client";

import { useStudio } from "@/lib/studio";

export function DirectorWorkspace() {
  const studio = useStudio();

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">02 · Director Assistant</h1>
      <p className="mt-2 text-[15px] text-muted">Describe your vision and approve the production plan</p>
      <article className="mt-5 flex min-h-[430px] flex-col gap-4 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Director Conversation</h2>
        <div className="rounded-[9px] bg-inset px-4 py-4 text-base">
          I can create the cast, storyboard, camera plan, music and editable scene timeline.
        </div>
        <label className="ml-auto block w-[86%] rounded-[9px] bg-user px-4 py-4 text-ink">
          <span className="sr-only">Direction</span>
          <textarea
            className="min-h-12 w-full resize-y bg-transparent text-base outline-none"
            value={studio.directorNote}
            onChange={(event) => studio.setDirectorNote(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="h-9 w-[220px] rounded-[7px] bg-accent text-[13px] font-bold text-on-accent"
          onClick={studio.saveDirection}
        >
          Review production plan
        </button>
      </article>
      <p className="pt-6 text-[11px] tracking-wide text-pipeline">
        PROJECT → DIRECTOR → CHARACTERS → SCENES → AUDIO → EDIT → EXPORT
      </p>
    </section>
  );
}
