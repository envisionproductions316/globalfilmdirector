"use client";

import { useMemo, useState } from "react";
import { ReadinessBoard, RoutingBoard, WorkerBoard } from "@/components/production/Boards";
import { Pipeline } from "@/components/ui/Pipeline";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
import { CONNECTORS, useStudio } from "@/lib/studio";

const FILTERS = ["All", "Open Source", "Local", "Cloud"];
const VIEWS = ["Marketplace", "Detail", "Routing", "Workers", "Readiness"];

export function ConnectorsWorkspace() {
  const studio = useStudio();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("Marketplace");
  const visible = useMemo(
    () =>
      CONNECTORS.filter((connector) => {
        const matchesFilter = studio.connectorFilter === "All" || connector.kind === studio.connectorFilter;
        return matchesFilter && connector.name.toLowerCase().includes(query.trim().toLowerCase());
      }),
    [query, studio.connectorFilter],
  );
  const connector = studio.selectedConnector;

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">
        {view === "Detail" ? "14 · Connector Detail & Permissions" : view === "Routing" ? "15 · AI Provider Routing & Fallback" : view === "Workers" ? "16 · Worker & Render Diagnostics" : view === "Readiness" ? "17 · Feature Readiness & Recovery" : "13 · Connectors & Open Source Hub"}
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        {view === "Routing" ? "Choose a policy to keep on this device. No provider is being routed." : view === "Workers" ? "Waiting jobs stay local. No worker is online." : view === "Readiness" ? "Unavailable tools stay listed until a service is actually connected." : "Browse compatible production tools. Installation is not available from this screen."}
      </p>
      <ViewSwitch views={VIEWS} value={view} onChange={setView} />
      {view === "Marketplace" ? (
        <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
          <h2 className="m-0 text-base font-bold">Connector Marketplace</h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label>
              <span className="sr-only">Search tools</span>
              <input className="h-9 rounded-md bg-inset px-3 text-sm text-ink" placeholder="Search tools" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            {FILTERS.map((filter) => (
              <button key={filter} type="button" className={`h-9 rounded-md px-3 text-sm ${filter === studio.connectorFilter ? "bg-active text-ink" : "text-muted"}`} onClick={() => studio.setConnectorFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {visible.map((item) => (
              <article key={item.id} className={`flex min-h-[205px] flex-col gap-2 rounded-[9px] bg-inset p-4 ${item.id === studio.selectedConnectorId ? "outline-2 outline-offset-2 outline-ink" : ""}`}>
                <div className="h-12 w-12 rounded-[9px] bg-accent" aria-hidden="true" />
                <h3 className="m-0 text-base font-bold text-ink">{item.name}</h3>
                <p className="m-0 flex-1 text-xs text-muted">{item.detail}</p>
                <button type="button" className="h-9 rounded-[7px] bg-accent text-xs font-bold text-on-accent" onClick={() => { studio.selectConnector(item.id); setView("Detail"); }}>
                  View & connect
                </button>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Provider licensing and compatibility are verified during installation. None of these tools are connected.</p>
          <div className="mt-4 lg:hidden">
            <h3 className="m-0 text-sm font-bold">Jobs on this device</h3>
            <ul className="mt-2 list-none space-y-2 p-0 text-sm">
              {studio.jobs.map((job) => (
                <li key={job.id} className="rounded-[9px] bg-inset px-3 py-2">{job.label} · {job.state}{job.sample ? " · sample" : ""}</li>
              ))}
            </ul>
          </div>
        </article>
      ) : null}
      {view === "Detail" ? (
        <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
          <h2 className="m-0 text-base font-bold">{connector.name}</h2>
          <p className="mt-3 text-sm">Status: Not connected</p>
          <p className="mt-2 text-sm text-muted">{connector.kind} · {connector.detail}</p>
          <h3 className="mt-4 text-sm font-bold">Permissions</h3>
          <ul className="mt-2 list-none space-y-2 p-0 text-sm">
            {connector.permissions.map((permission) => (
              <li key={permission} className="rounded-[9px] bg-inset px-3 py-2">{permission} · not granted</li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-muted">Opening this detail does not install the tool or send credentials.</p>
        </article>
      ) : null}
      {view === "Routing" ? <RoutingBoard /> : null}
      {view === "Workers" ? <WorkerBoard /> : null}
      {view === "Readiness" ? <ReadinessBoard /> : null}
      <Pipeline />
    </section>
  );
}
