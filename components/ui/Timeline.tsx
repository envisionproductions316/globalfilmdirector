"use client";

import Link from "next/link";
import { formatTimecode } from "@/lib/timeline";

export type PerformanceTrack = {
  id: string;
  name: string;
  color: string;
  takes: { id: string; name: string; durationMs: number }[];
};

/**
 * Real per-character performance lanes (not decorative Figma placeholder bars).
 * Bars scale to take duration; click selects; Place sends the take to Edit.
 */
export function Timeline({
  tracks,
  selectedTakeId,
  onSelectTake,
  onPlaceTake,
}: {
  tracks: PerformanceTrack[];
  selectedTakeId?: string;
  onSelectTake?: (takeId: string) => void;
  onPlaceTake?: (takeId: string) => void;
}) {
  const maxMs = Math.max(1000, ...tracks.flatMap((track) => track.takes.map((take) => take.durationMs)));

  if (tracks.length === 0) {
    return <p className="mt-3 text-sm text-muted">No characters in this production yet.</p>;
  }

  return (
    <div className="mt-4 flex flex-col gap-3" data-testid="performance-tracks">
      {tracks.map((track) => (
        <div key={track.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
          <span className="truncate text-xs text-muted" title={track.name}>
            {track.name}
          </span>
          <div className="relative h-9 overflow-hidden rounded-md bg-inset" data-testid={`perf-track-${track.id}`}>
            {track.takes.length === 0 ? (
              <span className="absolute inset-y-0 left-2 flex items-center text-[11px] text-muted">No takes — record on Capture</span>
            ) : (
              track.takes.map((take, index) => {
                const widthPct = Math.max(8, (take.durationMs / maxMs) * 100);
                const leftPct = track.takes.slice(0, index).reduce((sum, item) => sum + Math.max(8, (item.durationMs / maxMs) * 100), 0);
                const selected = take.id === selectedTakeId;
                return (
                  <button
                    key={take.id}
                    type="button"
                    data-testid={`perf-take-${take.id}`}
                    title={`${take.name} · ${formatTimecode(take.durationMs)}`}
                    className={`absolute top-1 flex h-7 items-center overflow-hidden rounded-sm px-2 text-left text-[11px] text-[#f1f6ff] ${
                      selected ? "outline outline-2 outline-[#f1f6ff]" : ""
                    }`}
                    style={{
                      left: `${Math.min(leftPct, 92)}%`,
                      width: `${Math.min(widthPct, 100 - Math.min(leftPct, 92))}%`,
                      background: track.color,
                    }}
                    onClick={() => onSelectTake?.(take.id)}
                  >
                    <span className="truncate">{take.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {selectedTakeId && onPlaceTake ? (
          <button
            type="button"
            className="h-8 rounded-md bg-accent px-3 text-xs font-bold text-on-accent"
            data-testid="perf-place-selected"
            onClick={() => onPlaceTake(selectedTakeId)}
          >
            Place selected on Edit timeline
          </button>
        ) : null}
        <Link href="/edit" className="text-xs text-accent">
          Open Edit
        </Link>
      </div>
    </div>
  );
}
