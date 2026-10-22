"use client";

import { useMemo, useState } from "react";
import { Pipeline } from "@/components/ui/Pipeline";
import { CONNECTORS, useStudio } from "@/lib/studio";

const FILTERS = ["All", "Open Source", "Local", "Cloud"];

export function ConnectorsWorkspace() {
  const studio = useStudio();
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () =>
      CONNECTORS.filter((connector) => {
        const matchesFilter = studio.connectorFilter === "All" || connector.kind === studio.connectorFilter;
        return matchesFilter && connector.name.toLowerCase().includes(query.trim().toLowerCase());
      }),
    [query, studio.connectorFilter],
  );

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">13 · Connectors & Open Source Hub</h1>
      <p className="mt-2 text-[15px] text-muted">Browse, install, configure and test compatible production tools</p>
      <article className="mt-5 rounded-[10px] bg-card px-5 py-4">
        <h2 className="m-0 text-base font-bold">Connector Marketplace</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label>
            <span className="sr-only">Search tools</span>
            <input
              className="h-9 rounded-md bg-inset px-3 text-sm text-ink"
              placeholder="Search tools"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`h-9 rounded-md px-3 text-sm ${filter === studio.connectorFilter ? "bg-active text-ink" : "text-muted"}`}
              onClick={() => studio.setConnectorFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {visible.map((connector) => (
            <article
              key={connector.id}
              className={`flex min-h-[205px] flex-col gap-2 rounded-[9px] bg-inset p-4 ${
                connector.id === studio.selectedConnectorId ? "outline-2 outline-offset-2 outline-ink" : ""
              }`}
            >
              <div className="h-12 w-12 rounded-[9px] bg-accent" aria-hidden="true" />
              <h3 className="m-0 text-base font-bold text-ink">{connector.name}</h3>
              <p className="m-0 flex-1 text-xs text-muted">{connector.detail}</p>
              <button
                type="button"
                className="h-9 rounded-[7px] bg-accent text-xs font-bold text-on-accent"
                onClick={() => studio.selectConnector(connector.id)}
              >
                View & connect
              </button>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">Provider licensing and compatibility are verified during installation. None of these tools are connected.</p>
      </article>
      <Pipeline />
    </section>
  );
}
