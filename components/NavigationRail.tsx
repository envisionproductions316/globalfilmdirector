"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DESTINATIONS } from "@/lib/studio";

export function NavigationRail() {
  const pathname = usePathname();

  return (
    <nav aria-label="Destinations" className="flex gap-2 overflow-x-auto bg-rail p-3 lg:w-[218px] lg:flex-col lg:overflow-visible lg:px-3 lg:pt-6">
      {DESTINATIONS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center rounded-md px-4 text-[15px] whitespace-nowrap ${
              active ? "bg-active text-ink" : "text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
