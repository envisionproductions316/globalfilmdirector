"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pipeline } from "@/components/ui/Pipeline";
import { CONNECTORS, useStudio } from "@/lib/studio";
import type { ConnectorProbeResult } from "@/lib/connectors-catalog";

function statusLabel(probe?: ConnectorProbeResult) {
  if (!probe) return "Checking…";
  if (probe.connected) return "Ready";
  if (probe.detected) return "Detected · not ready";
  return "Not available";
}

export function ConnectorsWorkspace() {
  const studio = useStudio();
  const [probes, setProbes] = useState<Record<string, ConnectorProbeResult>>({});
  const [probeError, setProbeError] = useState("");
  const [probing, setProbing] = useState(false);
  const selected = studio.selectedConnector;
  const selectedProbe = probes[selected.id];
  const realJobs = studio.jobs.filter((job) => !job.sample && job.projectId === studio.activeProjectId);

  async function runProbe() {
    setProbing(true);
    setProbeError("");
    try {
      const response = await fetch("/api/connectors/probe");
      if (!response.ok) throw new Error("Probe failed");
      const body = (await response.json()) as { results?: ConnectorProbeResult[] };
      const next: Record<string, ConnectorProbeResult> = {};
      for (const result of body.results || []) next[result.id] = result;
      setProbes(next);
    } catch {
      setProbeError("Could not probe this machine. Browser and storage tools still work in this tab.");
    } finally {
      setProbing(false);
    }
  }

  useEffect(() => {
    void runProbe();
  }, []);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[26px] font-bold">Local studio tools</h1>
          <p className="mt-2 text-[15px] text-muted">
            Only capabilities this build actually uses. No cloud marketplace and no pretend Connect buttons.
          </p>
        </div>
        <button
          type="button"
          className="h-9 rounded-[7px] bg-inset px-3 text-sm"
          data-testid="probe-connectors"
          disabled={probing}
          onClick={() => void runProbe()}
        >
          {probing ? "Checking…" : "Refresh status"}
        </button>
      </div>
      {probeError ? <p className="mt-3 text-sm text-muted">{probeError}</p> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CONNECTORS.map((item) => {
          const probe = probes[item.id];
          const active = item.id === studio.selectedConnectorId;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`connector-card-${item.id}`}
              className={`flex min-h-[180px] flex-col gap-2 rounded-[10px] bg-card p-4 text-left ${active ? "outline-2 outline-offset-2 outline-ink" : ""}`}
              onClick={() => studio.selectConnector(item.id)}
            >
              <h2 className="m-0 text-base font-bold">{item.name}</h2>
              <p className="m-0 flex-1 text-sm text-muted">{item.detail}</p>
              <p className="m-0 text-xs text-muted">Used by {item.usedBy}</p>
              <p className="m-0 text-sm font-bold" data-testid={`connector-status-${item.id}`}>
                {statusLabel(probe)}
              </p>
            </button>
          );
        })}
      </div>

      <article className="mt-5 rounded-[10px] bg-card px-5 py-4" data-testid="connector-detail">
        <h2 className="m-0 text-base font-bold">{selected.name}</h2>
        <p className="mt-2 text-sm font-bold" data-testid="connector-detail-status">
          Status: {statusLabel(selectedProbe)}
        </p>
        <p className="mt-2 text-sm text-muted">{selected.detail}</p>
        {selectedProbe ? <p className="mt-2 text-sm">{selectedProbe.detail}</p> : null}
        <h3 className="mt-4 text-sm font-bold">Permissions this tool needs</h3>
        <ul className="mt-2 list-none space-y-2 p-0 text-sm">
          {selected.permissions.map((permission) => (
            <li key={permission} className="rounded-[9px] bg-inset px-3 py-2">
              {permission}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {selected.id === "ffmpeg" ? (
            <Link href="/export" className="inline-flex h-9 items-center rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent">
              Open Export
            </Link>
          ) : null}
          {selected.id === "browser-av" ? (
            <Link
              href="/capture"
              className="inline-flex h-9 items-center rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent"
              onClick={() => studio.setAssetCategory("characters")}
            >
              Open Capture
            </Link>
          ) : null}
          {selected.id === "timeline" ? (
            <>
              <Link href="/edit" className="inline-flex h-9 items-center rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent" onClick={() => studio.setAssetCategory("media")}>
                Open Edit
              </Link>
              <Link href="/audio" className="inline-flex h-9 items-center rounded-[7px] bg-inset px-4 text-[13px]" onClick={() => studio.setAssetCategory("music")}>
                Open Audio
              </Link>
            </>
          ) : null}
          {selected.id === "local-storage" ? (
            <Link href="/projects" className="inline-flex h-9 items-center rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent">
              Open Projects
            </Link>
          ) : null}
        </div>
      </article>

      <article className="mt-5 rounded-[10px] bg-card px-5 py-4" data-testid="machine-tools-note">
        <h2 className="m-0 text-base font-bold">Also on this PC (not wired into the studio)</h2>
        <p className="mt-2 text-sm text-muted">
          These are real installs for offline work. They are not Connect cards and the app does not launch them yet.
          Inventory: docs/MACHINE_TOOLS.md
        </p>
        <ul className="mt-3 list-none space-y-2 p-0 text-sm">
          <li className="rounded-[9px] bg-inset px-3 py-2">Blender 5.2.3 LTS — 3D / offline render</li>
          <li className="rounded-[9px] bg-inset px-3 py-2">Kdenlive 26.08.2 — external timeline edit</li>
          <li className="rounded-[9px] bg-inset px-3 py-2">OpenToonz 1.8.0 — 2D animation</li>
          <li className="rounded-[9px] bg-inset px-3 py-2">openai-whisper — CLI transcription</li>
          <li className="rounded-[9px] bg-inset px-3 py-2">Rhubarb Lip Sync 1.14.0 — CLI lip-sync (UI stays unavailable until integrated)</li>
        </ul>
      </article>

      <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Real export jobs for {studio.activeProject.title}</h2>
        <p className="mt-2 text-sm text-muted">Only encodes that finished or ran on this device. Sample/demo queue rows are not shown.</p>
        <ul className="mt-3 list-none space-y-2 p-0 text-sm">
          {realJobs.map((job) => (
            <li key={job.id} className="rounded-[9px] bg-inset px-3 py-3">
              {job.label} · {job.state}
            </li>
          ))}
        </ul>
        {realJobs.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No exports yet.{" "}
            <Link href="/export" className="text-accent">
              Go to Export
            </Link>{" "}
            when the timeline has clips and FFmpeg is ready.
          </p>
        ) : null}
      </article>

      <Pipeline />
    </section>
  );
}
