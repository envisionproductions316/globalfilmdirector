"use client";

import { useState } from "react";
import { useStudio, type ProductionStatus } from "@/lib/studio";

const STATUSES: ProductionStatus[] = ["Draft", "In review", "Approved"];

export function GlobalHeader() {
  const studio = useStudio();
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header className="flex min-h-[73px] flex-wrap items-center gap-3 bg-header px-5 py-2.5 text-ink">
      <p className="m-0 text-lg font-bold tracking-tight whitespace-nowrap">◈ GLOBAL FILM DIRECTOR</p>

      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Project
        <select
          className="min-h-9 min-w-44 rounded-md border border-[var(--line)] bg-canvas/40 px-2 text-sm text-ink"
          value={studio.activeProjectId}
          onChange={(event) => studio.setActiveProjectId(event.target.value)}
        >
          {studio.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Status
        <select
          className="min-h-9 rounded-md border border-[var(--line)] bg-canvas/40 px-2 text-sm text-ink"
          value={studio.status}
          onChange={(event) => studio.setStatus(event.target.value as ProductionStatus)}
        >
          {STATUSES.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </label>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            className="min-h-9 rounded-md bg-active px-3 text-sm text-ink"
            onClick={() => {
              setNoticesOpen((open) => !open);
              setAccountOpen(false);
            }}
          >
            Notifications
            <span className="ml-2 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ink px-1 text-[11px] text-header">
              {studio.notices.length}
            </span>
          </button>
          {noticesOpen ? (
            <div className="absolute right-0 z-10 mt-2 w-72 rounded-[10px] bg-card p-3 text-sm shadow-xl" role="region" aria-label="Notifications">
              {studio.notices.map((notice) => (
                <p key={notice.id} className="mb-2 last:mb-0">
                  {notice.text}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="min-h-9 rounded-md bg-accent px-3 text-sm font-bold text-on-accent"
          onClick={() => studio.setTheme(studio.theme === "night" ? "day" : "night")}
        >
          {studio.theme === "night" ? "☾ Night" : "☀ Day"}
        </button>

        <div className="relative">
          <button
            type="button"
            className="min-h-9 rounded-md bg-active px-3 text-sm text-ink"
            onClick={() => {
              setAccountOpen((open) => !open);
              setNoticesOpen(false);
            }}
          >
            {studio.accountName}
          </button>
          {accountOpen ? (
            <div className="absolute right-0 z-10 mt-2 w-72 rounded-[10px] bg-card p-3 shadow-xl" role="region" aria-label="Account">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Display name
                <input
                  className="rounded-md border border-[var(--line)] bg-inset px-2 py-1.5 text-sm text-ink"
                  value={studio.accountName}
                  onChange={(event) => studio.setAccountName(event.target.value)}
                />
              </label>
              <p className="mt-2 text-xs text-muted">Local profile on this device. No account provider is connected.</p>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
