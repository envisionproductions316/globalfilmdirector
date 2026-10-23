"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ASSET_CATEGORIES, useStudio, type AssetCategory } from "@/lib/studio";
import { formatTimecode, timelineDuration } from "@/lib/timeline";

const DIRECTOR_FOCUS: AssetCategory[] = ["characters", "locations", "scenes", "styles"];
const STUDIO_FOCUS: AssetCategory[] = ["media", "music", "sfx", "assets"];

export function NavigationRail() {
  const studio = useStudio();
  const router = useRouter();
  const duration = timelineDuration(studio.clips);
  const focus = studio.studioMode === "director" ? DIRECTOR_FOCUS : STUDIO_FOCUS;

  function openCategory(category: AssetCategory, href: string) {
    studio.setAssetCategory(category);
    if (category === "music") studio.setSelectedAudioTrack("music");
    if (category === "sfx") studio.setSelectedAudioTrack("sfx");
    router.push(href);
  }

  return (
    <nav aria-label="Project assets" className="flex gap-2 overflow-x-auto bg-rail p-3 lg:sticky lg:top-0 lg:h-[calc(100vh-72px)] lg:w-[220px] lg:flex-col lg:overflow-y-auto lg:px-3 lg:pt-4">
      <div className="hidden shrink-0 rounded-[10px] bg-card p-3 lg:block">
        <label className="block text-[10px] uppercase tracking-wide text-muted">
          Project
          <select
            className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm text-ink"
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
        <p className="mt-2 text-xs text-muted">
          {formatTimecode(studio.playheadMs)} / {formatTimecode(duration || 90_000)}
        </p>
        <p className="mt-1 text-[11px] text-muted">{studio.activeProject.kind} · {studio.status}</p>
      </div>

      <div className="flex gap-2 lg:mt-3 lg:flex-col lg:gap-1">
        {ASSET_CATEGORIES.map((item) => {
          // Category is the source of truth so Media Library and My Assets (both /edit)
          // or Characters and Visual Styles (both /characters) never light up together.
          const active = studio.assetCategory === item.id;
          const emphasized = focus.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => openCategory(item.id, item.href)}
              className={`flex h-10 shrink-0 items-center rounded-md px-3 text-left text-[14px] whitespace-nowrap ${
                active ? "bg-active text-ink" : emphasized ? "text-ink" : "text-muted"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {studio.studioMode === "studio" ? (
        <Link href="/connectors" className="mt-auto hidden rounded-md px-3 py-2 text-sm text-muted lg:block">
          Connectors
        </Link>
      ) : null}
    </nav>
  );
}
