"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isProjectVisibleToUser } from "@/lib/auth/types";
import { ASSET_CATEGORIES, useStudio, type AssetCategory } from "@/lib/studio";
import { formatTimecode, timelineDuration } from "@/lib/timeline";

const DIRECTOR_FOCUS: AssetCategory[] = ["characters", "locations", "scenes", "styles"];
const STUDIO_FOCUS: AssetCategory[] = ["media", "music", "sfx", "assets"];

/** Categories that are valid while the user is on a given route. */
function categoriesForPath(pathname: string): AssetCategory[] {
  if (pathname === "/characters" || pathname === "/capture") return ["characters", "styles"];
  if (pathname === "/locations") return ["locations"];
  if (pathname === "/storyboard") return ["scenes"];
  if (pathname === "/edit") return ["media", "assets"];
  if (pathname === "/audio") return ["music", "sfx"];
  return [];
}

function defaultCategoryForPath(pathname: string, selectedAudioTrack: string): AssetCategory | null {
  if (pathname === "/characters" || pathname === "/capture") return "characters";
  if (pathname === "/locations") return "locations";
  if (pathname === "/storyboard") return "scenes";
  if (pathname === "/edit") return "media";
  if (pathname === "/audio") return selectedAudioTrack === "sfx" ? "sfx" : "music";
  return null;
}

export function NavigationRail() {
  const studio = useStudio();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const duration = timelineDuration(studio.clips);
  const focus = studio.studioMode === "director" ? DIRECTOR_FOCUS : STUDIO_FOCUS;
  const visibleProjects = useMemo(
    () => studio.projects.filter((project) => isProjectVisibleToUser(project, auth.user?.id ?? null)),
    [studio.projects, auth.user?.id],
  );

  // Keep the asset rail highlight in sync when the URL changes without a rail click
  // (header destinations, pipeline, deep links).
  useEffect(() => {
    const allowed = categoriesForPath(pathname);
    if (allowed.length === 0) return;
    if (allowed.includes(studio.assetCategory)) return;
    const next = defaultCategoryForPath(pathname, studio.selectedAudioTrack);
    if (next) studio.setAssetCategory(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the route changes
  }, [pathname]);

  function openCategory(category: AssetCategory, href: string) {
    studio.setAssetCategory(category);
    if (category === "music") studio.setSelectedAudioTrack("music");
    if (category === "sfx") studio.setSelectedAudioTrack("sfx");
    router.push(href);
  }

  return (
    <nav aria-label="Project assets" className="flex gap-2 overflow-x-auto bg-rail p-3 lg:sticky lg:top-0 lg:h-[calc(100vh-72px)] lg:w-[220px] lg:flex-col lg:overflow-y-auto lg:px-3 lg:pt-4" data-testid="asset-rail">
      <div className="hidden shrink-0 rounded-[10px] bg-card p-3 lg:block">
        <label className="block text-[10px] uppercase tracking-wide text-muted">
          Project
          <select
            className="mt-1 w-full rounded-md bg-inset px-2 py-2 text-sm text-ink"
            value={studio.activeProjectId}
            data-testid="rail-project"
            onChange={(event) => studio.setActiveProjectId(event.target.value)}
          >
            {visibleProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-muted">
          {formatTimecode(studio.playheadMs)} / {formatTimecode(duration || 90_000)}
        </p>
        <p className="mt-1 text-[11px] text-muted">
          {studio.activeProject.kind} · {studio.status}
        </p>
      </div>

      <div className="flex gap-2 lg:mt-3 lg:flex-col lg:gap-1">
        {ASSET_CATEGORIES.map((item) => {
          const active = studio.assetCategory === item.id;
          const emphasized = focus.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`rail-${item.id}`}
              aria-current={active ? "page" : undefined}
              onClick={() => openCategory(item.id, item.href)}
              className={`flex h-10 shrink-0 items-center rounded-md px-3 text-left text-[14px] whitespace-nowrap ${
                active ? "bg-active text-ink" : emphasized ? "text-ink" : "text-muted"
              }`}
            >
              {item.id === "assets" ? `${item.label} (${studio.assets.length})` : item.label}
            </button>
          );
        })}
      </div>

      <Link
        href="/connectors"
        data-testid="rail-connectors"
        className={`shrink-0 rounded-md px-3 py-2 text-sm lg:mt-auto ${pathname === "/connectors" ? "bg-active text-ink" : "text-muted"}`}
      >
        Connectors
      </Link>
    </nav>
  );
}
