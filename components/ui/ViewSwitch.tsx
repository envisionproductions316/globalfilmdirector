"use client";

export function ViewSwitch({ views, value, onChange }: { views: string[]; value: string; onChange: (view: string) => void }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {views.map((view) => (
        <button
          key={view}
          type="button"
          className={`h-9 rounded-md px-3 text-sm ${view === value ? "bg-active text-ink" : "text-muted"}`}
          onClick={() => onChange(view)}
        >
          {view}
        </button>
      ))}
    </div>
  );
}
