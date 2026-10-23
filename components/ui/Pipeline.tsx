"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStudio } from "@/lib/studio";

const STEPS = [
  { href: "/projects", label: "PROJECT", category: null },
  { href: "/director", label: "DIRECTOR", category: null },
  { href: "/characters", label: "CHARACTERS", category: "characters" as const },
  { href: "/storyboard", label: "SCENES", category: "scenes" as const },
  { href: "/audio", label: "AUDIO", category: "music" as const },
  { href: "/edit", label: "EDIT", category: "media" as const },
  { href: "/export", label: "EXPORT", category: null },
] as const;

export function Pipeline() {
  const pathname = usePathname();
  const studio = useStudio();

  return (
    <nav aria-label="Production pipeline" className="flex flex-wrap items-center gap-x-1 gap-y-2 pt-6 text-[11px] tracking-wide text-pipeline">
      {STEPS.map((step, index) => {
        const active = pathname === step.href;
        return (
          <span key={step.href} className="inline-flex items-center gap-x-1">
            {index > 0 ? <span aria-hidden className="text-muted">→</span> : null}
            <Link
              href={step.href}
              className={active ? "font-bold text-ink underline-offset-2" : "hover:text-ink"}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (step.category) studio.setAssetCategory(step.category);
                if (step.href === "/audio") studio.setSelectedAudioTrack(studio.assetCategory === "sfx" ? "sfx" : "music");
              }}
            >
              {step.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
