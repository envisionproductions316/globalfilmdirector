"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { DESTINATIONS, useStudio, type ProductionStatus } from "@/lib/studio";

const STATUSES: ProductionStatus[] = ["Draft", "In review", "Approved"];

export function GlobalHeader() {
  const studio = useStudio();
  const pathname = usePathname();
  const router = useRouter();
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  function setMode(mode: "director" | "studio") {
    studio.setStudioMode(mode);
    if (mode === "director") {
      studio.setAssetCategory("characters");
      if (pathname === "/edit" || pathname === "/audio" || pathname === "/export") router.push("/capture");
    } else {
      studio.setAssetCategory("media");
      if (pathname === "/capture" || pathname === "/characters" || pathname === "/director") router.push("/edit");
    }
  }

  return (
    <header className="flex min-h-[72px] flex-wrap items-center gap-3 border-b border-[var(--line)] bg-header px-4 py-2 text-ink lg:px-5">
      <div className="flex min-w-[12rem] items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-sm font-bold text-on-accent" aria-hidden>
          G
        </span>
        <div>
          <p className="m-0 text-[15px] font-bold tracking-tight whitespace-nowrap">GLOBAL FILM DIRECTOR</p>
          <p className="m-0 text-[11px] text-muted">Your vision. Your virtual studio.</p>
        </div>
      </div>

      <nav aria-label="Destinations" className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1" data-testid="destination-rail">
        {DESTINATIONS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={item.label}
              data-testid={`dest-${item.href.replace("/", "") || "home"}`}
              onClick={() => {
                if (item.href === "/characters") studio.setAssetCategory("characters");
                if (item.href === "/locations") studio.setAssetCategory("locations");
                if (item.href === "/storyboard") studio.setAssetCategory("scenes");
                if (item.href === "/edit") studio.setAssetCategory("media");
                if (item.href === "/audio") studio.setAssetCategory(studio.selectedAudioTrack === "sfx" ? "sfx" : "music");
                if (item.href === "/capture") studio.setAssetCategory("characters");
                if (item.href === "/export") studio.setAssetCategory("media");
              }}
              className={`flex h-10 min-w-10 flex-col items-center justify-center rounded-md px-2 text-[10px] ${
                active ? "bg-active text-ink" : "text-muted hover:bg-inset hover:text-ink"
              }`}
            >
              <span className="text-[12px] font-bold leading-none">{item.icon}</span>
              <span className="mt-0.5 hidden max-w-[4.5rem] truncate sm:block">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="flex rounded-md bg-inset p-1 text-[12px]">
          <button
            type="button"
            className={`rounded-sm px-2 py-1.5 ${studio.studioMode === "director" ? "bg-accent font-bold text-on-accent" : "text-muted"}`}
            onClick={() => setMode("director")}
          >
            Director Mode
          </button>
          <button
            type="button"
            className={`rounded-sm px-2 py-1.5 ${studio.studioMode === "studio" ? "bg-accent font-bold text-on-accent" : "text-muted"}`}
            onClick={() => setMode("studio")}
          >
            Studio Mode
          </button>
        </div>

        <label className="hidden flex-col gap-0.5 text-[10px] text-muted xl:flex">
          Status
          <select
            className="min-h-8 rounded-md border border-[var(--line)] bg-canvas/40 px-2 text-xs text-ink"
            value={studio.status}
            onChange={(event) => studio.setStatus(event.target.value as ProductionStatus)}
          >
            {STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>

        <button type="button" className="min-h-9 rounded-md bg-inset px-3 text-xs text-muted" title="Projects and media stay on this device. No cloud account is linked.">
          Local only
        </button>

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
            <div className="absolute right-0 z-20 mt-2 w-72 rounded-[10px] bg-card p-3 text-sm shadow-xl" role="region" aria-label="Notifications">
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
            className="grid h-9 w-9 place-items-center rounded-full bg-active text-xs font-bold"
            onClick={() => {
              setAccountOpen((open) => !open);
              setNoticesOpen(false);
            }}
            aria-label="Account"
          >
            {studio.accountName.slice(0, 1).toUpperCase()}
          </button>
          {accountOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-72 rounded-[10px] bg-card p-3 shadow-xl" role="region" aria-label="Account">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Display name
                <input
                  className="rounded-md border border-[var(--line)] bg-inset px-2 py-1.5 text-sm text-ink"
                  value={studio.accountName}
                  onChange={(event) => studio.setAccountName(event.target.value)}
                />
              </label>
              <p className="mt-2 text-xs text-muted">Local profile on this device. No account provider is connected.</p>
              <Link href="/connectors" className="mt-3 block text-sm text-accent" onClick={() => setAccountOpen(false)}>
                Open connectors
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
