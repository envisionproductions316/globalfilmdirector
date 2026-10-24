"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Pipeline } from "@/components/ui/Pipeline";
import { useStudio } from "@/lib/studio";

type ProviderMode = "checking" | "local" | "llm" | "unavailable";

export function DirectorWorkspace() {
  const studio = useStudio();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [provider, setProvider] = useState<ProviderMode>("checking");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/director")
      .then(async (response) => {
        if (!response.ok) throw new Error("probe failed");
        const body = (await response.json()) as { llmConfigured?: boolean };
        if (!cancelled) setProvider(body.llmConfigured ? "llm" : "local");
      })
      .catch(() => {
        if (!cancelled) setProvider("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [studio.messages.length]);

  async function sendDirection() {
    const text = draft.trim() || studio.directorNote.trim();
    if (!text) {
      setMessage("Write a direction before sending.");
      return;
    }
    setSending(true);
    setMessage("");
    const { error, result } = await studio.applyDirection(text);
    setSending(false);
    if (error) {
      setMessage(error);
      return;
    }
    setDraft("");
    studio.setDirectorNote("");
    if (result?.source === "llm") setProvider("llm");
    else if (provider === "checking") setProvider("local");
    setMessage(result?.source === "llm" ? "Applied with LLM. Review plan and cast." : "Applied locally. Review plan and cast.");
  }

  const chip =
    provider === "checking"
      ? "Checking…"
      : provider === "llm"
        ? "LLM connected"
        : provider === "unavailable"
          ? "Unavailable"
          : "Local Studio Director";

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[26px] font-bold">02 · Director Assistant</h1>
          <p className="mt-2 text-[15px] text-muted">Prompt to shape the plan and cast — humans, animals, any creatures</p>
        </div>
        <p
          className="m-0 rounded-full bg-inset px-3 py-1 text-xs font-bold tracking-wide text-muted"
          data-testid="director-provider"
        >
          {chip}
        </p>
      </div>

      <article className="mt-5 flex min-h-[430px] flex-col gap-4 rounded-[var(--radius-lg)] bg-card px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-base font-bold">Director Conversation</h2>
          <p className="m-0 text-sm text-muted">Project: {studio.activeProject.title}</p>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-inset/60 px-4 py-3" data-testid="film-brief">
          <p className="m-0 text-xs font-bold tracking-wide text-muted">Film brief (your instructions)</p>
          <p className="mt-2 mb-0 text-sm text-ink">
            {studio.activeProject.directorNote?.trim() ||
              studio.messages.find((entry) => entry.role === "user")?.text ||
              "No brief yet — send a direction below. Suggestions from the Studio Director appear separately in the thread."}
          </p>
          <p className="mt-2 mb-0 text-[12px] text-muted">
            {`Continuity: ${studio.scenes.length} scene${studio.scenes.length === 1 ? "" : "s"} · ${studio.shots.length} shot${studio.shots.length === 1 ? "" : "s"} · plan ${studio.planApproved ? "approved" : "awaiting approval"}`}
          </p>
        </div>

        <div
          ref={scroller}
          className="flex max-h-[320px] min-h-[200px] flex-col gap-3 overflow-y-auto rounded-[var(--radius-md)] bg-inset px-4 py-4"
          data-testid="director-thread"
          aria-label="Direction thread — your messages and generated suggestions"
        >
          {studio.messages.length === 0 ? (
            <div className="rounded-[9px] bg-card px-4 py-4 text-sm text-muted">
              <p className="m-0 text-xs font-bold tracking-wide">Start with a prompt</p>
              <p className="mt-2 mb-0">
                Example: “A wolf named Ash and a human detective chase a dragon through rain-soaked alleys. Cinematic night photography,
                tense score.”
              </p>
            </div>
          ) : null}
          {studio.messages.map((entry) => {
            const isUser = entry.role === "user";
            const label =
              entry.role === "user"
                ? "You"
                : entry.role === "assistant"
                  ? entry.source === "llm"
                    ? "Studio Director (LLM)"
                    : "Studio Director (local)"
                  : "Provider unavailable";
            return (
              <div
                key={entry.id}
                className={isUser ? "ml-auto w-[86%] rounded-[9px] bg-user px-4 py-4" : "w-[92%] rounded-[9px] bg-card px-4 py-4"}
              >
                <p className="m-0 text-xs font-bold tracking-wide text-muted">{label}</p>
                <p className="mt-2 mb-0 whitespace-pre-wrap">{entry.text}</p>
              </div>
            );
          })}
        </div>

        <label className="block rounded-[9px] bg-user px-4 py-4 text-ink">
          <span className="sr-only">Direction prompt</span>
          <textarea
            className="min-h-16 w-full resize-y bg-transparent text-base outline-none placeholder:text-muted"
            placeholder="Tone, cast (any creatures), camera language, pacing…"
            value={draft}
            data-testid="director-note"
            disabled={sending}
            onChange={(event) => {
              setDraft(event.target.value);
              studio.setDirectorNote(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendDirection();
              }
            }}
          />
        </label>
        <p className="m-0 text-xs text-muted">Enter to send · Shift+Enter for a new line. Approve the plan in the inspector when ready.</p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="h-9 rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent disabled:opacity-50"
            data-testid="save-direction"
            disabled={sending}
            onClick={() => void sendDirection()}
          >
            {sending ? "Applying…" : "Send direction"}
          </button>
          <Link
            href="/characters"
            className="inline-flex h-9 items-center rounded-[7px] bg-inset px-4 text-[13px] font-bold text-ink"
            data-testid="director-to-characters"
            onClick={() => studio.setAssetCategory("characters")}
          >
            Continue to Characters
          </Link>
          {studio.characters.length > 0 ? (
            <Link
              href="/capture"
              className="inline-flex h-9 items-center rounded-[7px] bg-inset px-4 text-[13px] font-bold text-ink"
              onClick={() => studio.setAssetCategory("characters")}
            >
              Record on Capture
            </Link>
          ) : null}
          <Link href="/projects" className="inline-flex h-9 items-center rounded-[7px] bg-inset px-4 text-[13px] text-muted">
            Back to Projects
          </Link>
        </div>
        {message ? (
          <p className="m-0 text-[13px] text-muted" data-testid="director-message">
            {message}
          </p>
        ) : null}
      </article>
      <Pipeline />
    </section>
  );
}
