export function Timeline({ tracks }: { tracks: { name: string; color: string }[] }) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {tracks.map((track) => (
        <div key={track.name} className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-3">
          <span className="text-xs text-muted">{track.name}</span>
          <div className="grid grid-cols-4 gap-1 rounded bg-inset p-1" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <span key={index} className="block h-[22px] rounded-sm" style={{ background: track.color }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
