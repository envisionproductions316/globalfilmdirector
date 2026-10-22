"use client";

import { useState } from "react";
import { useStudio } from "@/lib/studio";

export function ProjectsWorkspace() {
  const studio = useStudio();
  const [prompt, setPrompt] = useState("");
  const [message, setMessage] = useState("");

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">01 · Projects & Create</h1>
      <p className="mt-2 text-[15px] text-muted">Start a movie, music video, documentary, or animation</p>
      <article className="mt-5 min-h-[430px] rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">New Production</h2>
        <p className="mt-4 mb-4 text-[25px] font-bold">What would you like to create?</p>
        <label className="block min-h-[116px] rounded-[9px] bg-inset px-4 py-7">
          <span className="sr-only">Production description</span>
          <textarea
            className="min-h-16 w-full resize-y bg-transparent text-base text-ink outline-none placeholder:text-muted"
            placeholder="Describe a film, upload footage, or add a script..."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="mt-5 h-9 w-[210px] rounded-[7px] bg-accent text-[13px] font-bold text-on-accent"
          onClick={() => {
            const error = studio.createProject(prompt);
            if (error) {
              setMessage(error);
              return;
            }
            setPrompt("");
            setMessage("");
          }}
        >
          Create production
        </button>
        {message ? <p className="mt-3 text-[13px] text-muted">{message}</p> : null}
      </article>
      <p className="mt-auto pt-6 text-[11px] tracking-wide text-pipeline">
        PROJECT → DIRECTOR → CHARACTERS → SCENES → AUDIO → EDIT → EXPORT
      </p>
    </section>
  );
}
