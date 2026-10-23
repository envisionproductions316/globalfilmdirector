"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStudio } from "@/lib/studio";

export function LocationsWorkspace() {
  const studio = useStudio();
  const router = useRouter();
  const locations = useMemo(() => {
    const map = new Map<string, { name: string; sceneIds: string[]; scenes: string[]; times: Set<string> }>();
    for (const scene of studio.scenes) {
      const name = (scene.location || scene.world || "Unspecified").trim() || "Unspecified";
      const entry = map.get(name) ?? { name, sceneIds: [], scenes: [], times: new Set<string>() };
      entry.sceneIds.push(scene.id);
      entry.scenes.push(scene.title);
      if (scene.timeOfDay) entry.times.add(scene.timeOfDay);
      map.set(name, entry);
    }
    for (const shot of studio.shots) {
      const name = (shot.location || "Unspecified").trim() || "Unspecified";
      if (!map.has(name)) map.set(name, { name, sceneIds: [], scenes: [], times: new Set() });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [studio.scenes, studio.shots]);

  function openLocation(location: { sceneIds: string[] }) {
    const sceneId = location.sceneIds[0];
    if (sceneId) studio.selectScene(sceneId);
    studio.setAssetCategory("scenes");
    router.push("/storyboard");
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[26px] font-bold">Locations</h1>
          <p className="mt-2 text-[15px] text-muted">Places used by scenes and shots in this project. This is a production list, not a world builder.</p>
        </div>
        <Link
          href="/storyboard"
          className="inline-flex h-9 items-center rounded-[7px] bg-accent px-3 text-sm font-bold text-on-accent"
          data-testid="locations-to-storyboard"
          onClick={() => studio.setAssetCategory("scenes")}
        >
          Edit in Storyboard
        </Link>
      </div>
      <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
        {locations.map((location) => (
          <li key={location.name} className="rounded-[10px] bg-card px-4 py-4">
            <button type="button" className="w-full text-left" onClick={() => openLocation(location)} data-testid={`location-${location.name}`}>
              <h2 className="m-0 text-base font-bold">{location.name}</h2>
              <p className="mt-2 text-sm text-muted">
                {location.times.size > 0 ? [...location.times].join(" · ") : "Time of day unset"}
              </p>
              <p className="mt-2 text-sm">{location.scenes.length} scene{location.scenes.length === 1 ? "" : "s"}</p>
            </button>
            <ul className="mt-2 list-none space-y-1 p-0 text-xs text-muted">
              {location.scenes.slice(0, 4).map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
            {location.sceneIds[0] ? (
              <Link
                href="/storyboard"
                className="mt-3 inline-block text-xs text-accent"
                onClick={() => {
                  studio.selectScene(location.sceneIds[0]);
                  studio.setAssetCategory("scenes");
                }}
              >
                Open in Storyboard
              </Link>
            ) : (
              <p className="mt-3 text-xs text-muted">Shot-only location. Assign it to a scene in Storyboard.</p>
            )}
          </li>
        ))}
      </ul>
      {locations.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          No locations yet.{" "}
          <Link href="/storyboard" className="text-accent" onClick={() => studio.setAssetCategory("scenes")}>
            Open Storyboard
          </Link>{" "}
          and set a location on a scene or shot.
        </p>
      ) : null}
    </section>
  );
}
