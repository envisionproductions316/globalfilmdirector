"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ContextPanel } from "@/components/ContextPanel";
import { GlobalHeader } from "@/components/GlobalHeader";
import { NavigationRail } from "@/components/NavigationRail";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/mobile-capture")) {
    return <div className="min-h-screen bg-canvas text-ink">{children}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <GlobalHeader />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <NavigationRail />
        <main className="flex min-w-0 flex-1 flex-col px-4 py-4 lg:px-5 lg:py-5">{children}</main>
        <ContextPanel />
      </div>
    </div>
  );
}
