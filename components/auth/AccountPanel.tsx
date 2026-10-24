"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { syncStatusLabel } from "@/lib/auth/types";
import { useStudio } from "@/lib/studio";

export function AccountPanel({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const studio = useStudio();
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkDismissed, setLinkDismissed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const unowned = useMemo(() => studio.projects.filter((project) => !project.ownerUserId), [studio.projects]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="absolute right-0 z-20 mt-2 w-80 rounded-[10px] bg-card p-3 shadow-xl" role="region" aria-label="Account">
      <p className="m-0 text-xs text-muted" data-testid="account-sync-chip">
        {auth.statusLabel}
      </p>
      {auth.user ? (
        <>
          <p className="mt-2 text-sm font-bold" data-testid="account-email">
            {auth.user.email || auth.user.name}
          </p>
          {!auth.user.emailVerified ? (
            <div className="mt-1">
              <p className="m-0 text-xs text-muted">Email not verified yet (IdP).</p>
              <button
                type="button"
                className="mt-1 text-left text-[12px] text-accent"
                data-testid="header-verify-email"
                onClick={() => void auth.openEmailVerification()}
              >
                Open IdP to verify / resend
              </button>
            </div>
          ) : null}
          {unowned.length > 0 && !linkDismissed ? (
            <div className="mt-3 rounded-md bg-inset p-2" data-testid="link-local-wizard">
              <p className="m-0 text-xs text-muted">
                {unowned.length} local project{unowned.length === 1 ? "" : "s"} not linked. Linking is optional and stays on this device.
              </p>
              <ul className="mt-2 max-h-28 list-none overflow-y-auto p-0">
                {unowned.map((project) => (
                  <li key={project.id} className="mb-1">
                    <label className="flex items-start gap-2 text-[12px] text-ink">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(project.id)}
                        onChange={() => toggleSelected(project.id)}
                        data-testid={`link-select-${project.id}`}
                      />
                      <span>{project.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="h-8 rounded-[7px] bg-accent px-2 text-[12px] font-bold text-on-accent disabled:opacity-50"
                  data-testid="link-selected-projects"
                  disabled={linkBusy || selectedIds.length === 0}
                  onClick={() => {
                    setLinkBusy(true);
                    studio.linkProjectsToAccount(auth.user!.id, selectedIds);
                    setSelectedIds([]);
                    setLinkBusy(false);
                  }}
                >
                  Link selected
                </button>
                <button
                  type="button"
                  className="h-8 rounded-[7px] bg-inset px-2 text-[12px] disabled:opacity-50"
                  data-testid="link-local-projects"
                  disabled={linkBusy}
                  onClick={() => {
                    setLinkBusy(true);
                    studio.linkProjectsToAccount(auth.user!.id, "all-unowned");
                    setSelectedIds([]);
                    setLinkBusy(false);
                  }}
                >
                  Link all
                </button>
                <button
                  type="button"
                  className="h-8 rounded-[7px] bg-inset px-2 text-[12px]"
                  data-testid="keep-local-projects"
                  onClick={() => setLinkDismissed(true)}
                >
                  Keep local only
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted">Nothing is uploaded to Envision Cloud. Sign-in never auto-assigns projects.</p>
            </div>
          ) : null}
          <button
            type="button"
            className="mt-3 h-9 w-full rounded-[7px] bg-inset text-[13px]"
            data-testid="header-sign-out"
            onClick={() => {
              void auth.signOut().then(onClose);
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <label className="mt-2 flex flex-col gap-1 text-xs text-muted">
            Local display name
            <input
              className="rounded-md border border-[var(--line)] bg-inset px-2 py-1.5 text-sm text-ink"
              value={studio.accountName}
              onChange={(event) => studio.setAccountName(event.target.value)}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="h-8 rounded-[7px] bg-accent px-2 text-[12px] font-bold text-on-accent" data-testid="header-sign-in" onClick={() => void auth.signIn()}>
              Sign in
            </button>
            <button type="button" className="h-8 rounded-[7px] bg-inset px-2 text-[12px]" data-testid="header-register" onClick={() => void auth.register()}>
              Create account
            </button>
          </div>
          <button type="button" className="mt-2 text-left text-[12px] text-accent" onClick={() => void auth.openPasswordReset()}>
            Reset password
          </button>
        </>
      )}
      {auth.message ? (
        <p className="mt-2 text-xs text-muted" data-testid="account-auth-message">
          {auth.message}
        </p>
      ) : null}
      {studio.activeProject ? (
        <p className="mt-3 text-[11px] text-muted">
          Active project: {syncStatusLabel(studio.activeProject.syncStatus || "local-only")}
        </p>
      ) : null}
      <Link href="/auth" className="mt-3 block text-sm text-accent" onClick={onClose}>
        Account page
      </Link>
      <Link href="/connectors" className="mt-2 block text-sm text-accent" onClick={onClose}>
        Open connectors
      </Link>
    </div>
  );
}
