# Phase 5E — Authentication verification (Phase 5D blocker closure)

Companion to Envision Cloud `docs/PHASE5D_*` / production posture docs.  
**Verdict:** **Not production-ready.** Local/dev verification advanced; four operational blockers updated below.

## Environment

| Item | Result |
|------|--------|
| GFD Node for this pass | **v22.23.4** via `fnm` (host default remains v25.6.1) |
| Envision Node for this pass | **v22.23.4** |
| Envision `.env` | `PORT`, public origin, bind, local mode flags only — **no** `SUPABASE_DB_URL`, **no** SMTP credentials |
| Packaged desktop | `release/win-unpacked/Global Film Director.exe` present |

## Four Phase 5D blockers

| # | Blocker | Classification | Evidence |
|---|---------|----------------|----------|
| 1 | Windows desktop GUI auth matrix (sign-in, restart, account switch, offline, local project preserve) | **BLOCKED** (partial launch only) | Exe process starts; `npm run desktop:smoke` PASS (modules + packaged exe + FFmpeg). Full system-browser OIDC GUI matrix **not** completed in this agent session (no Electron UI automation / operator matrix). |
| 2 | Node 22 LTS test suites | **PASS** | GFD: `npm test` 21/21, `typecheck`, `test:phase5d` session retain+logout. Envision: `npm test` **215/215**; OIDC files **25/25** (`oidc-phase5c/5d/provider/multi-instance-http`). |
| 3 | Live Postgres multi-instance / migrations / token concurrency | **BLOCKED** | No approved `SUPABASE_DB_URL` in local `.env`. Did **not** touch production DBs. Shared-file / HTTP dual-listener coverage remains in Envision automated tests only. |
| 4 | External SMTP delivery (registration + password recovery) | **BLOCKED** | No SMTP host/user/pass configured; no approved external test inbox used. Outbox path remains the local fallback when SMTP unset (not exercised as external delivery this phase). |

## Browser auth (regression)

| Check | Status |
|-------|--------|
| Sign-in → Account · local device | WORKING (observed during session; also Phase 5D script) |
| Sign-out / Local only · offline OK | WORKING (chip wording updated this phase) |
| Session retain + logout script | PASS (`npm run test:phase5d`) |
| Owner project isolation when signed out | WORKING (owner projects hide; seed Untitled remains) |

## Production readiness

Do **not** declare production ready: HTTPS staging issuer secrets, live Postgres, real SMTP, and packaged GUI auth matrix remain outstanding.
