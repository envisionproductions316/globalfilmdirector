# Global Film Director — Desktop re-audit (post Phase 4)

**Date:** 2026-10-23  
**Baseline desktop commit:** `55ce189` (Electron local shell)  
**Auth:** [`AUTH_UNIFIED.md`](AUTH_UNIFIED.md) · Verification: [`PHASE5_IDP_VERIFICATION.md`](PHASE5_IDP_VERIFICATION.md)  
**Prior audit:** [`PRE_DESKTOP_AUDIT.md`](PRE_DESKTOP_AUDIT.md) · Prep: [`DESKTOP_PREP.md`](DESKTOP_PREP.md) · Runtime: [`DESKTOP.md`](DESKTOP.md)

## Verdict

| Question | Answer |
|----------|--------|
| Local Windows desktop shell? | **Yes** — `release/win-unpacked` / `npm run desktop`; Next standalone on `127.0.0.1` |
| Public installer? | **No** — not authorized |
| Envision Cloud preferred IdP? | **Yes (approved)** |
| Envision Cloud OIDC ready for GFD? | **Yes (AS in envision-cloud)** — configure `AUTH_ISSUER`; run §6 matrix before production claims |
| Unified web ↔ desktop accounts? | **Implementable** with Envision running + GFD env |
| Cloud project sync? | **Not yet** — must stay distinct from auth |
| Safe to claim “same account everywhere”? | **No** |

## What Phase 4 delivered

- Electron main + secure preload + restricted IPC  
- Next standalone lifecycle; FFmpeg discovery; backup/restore (`gfd-backup-v1`)  
- Capture sessions on disk; native dialogs for backup/export/import  
- Browser app unchanged  

## Gaps closed (hardening + auth scaffold)

- Runtime materialize of AppData `.next` junction + chunk flatten  
- Native import dialog; open production data folder  
- IPC sender checks; startup recovery; temp cleanup; capture TTL touch  
- OIDC/PKCE web + desktop; Electron `safeStorage` session vault  
- Project `ownerUserId` / `syncStatus`; filtered project pickers + visibility guard  
- Account linking UI; honest “signed in ≠ cloud sync” labels  
- `.env.example` AUTH_* documentation  

## Gaps remaining

| Gap | Severity | Notes |
|-----|----------|-------|
| Manual auth matrix / SMTP verify | **P1** | Run AUTH_UNIFIED §6 against a live Envision identity |
| IndexedDB still primary media store | Medium | Desktop file migration still future |
| Envision Cloud sync | Future | Must not be implied by sign-in |
| Branded icon / NSIS public package | Soft | Separate approval |
| Manual device certification | Soft | Camera / phone QR on hardware |
| Multi-replica OIDC adapter | Soft | Local file adapter + accounts done; shared store before public IdP scale-out |

## Auth architecture (summary)

1. One central IdP for website + desktop (prefer Envision Cloud OIDC; Supabase Auth only with approval if needed).  
2. Desktop: system browser + authorization code + **PKCE**; tokens in **OS-backed** storage (`safeStorage`).  
3. No custom password database in GFD.  
4. Sign-out ≠ delete local projects; signed-out hides **account-linked** projects until that owner signs in again.  
5. Link legacy local projects via explicit Account panel action.  
6. Offline edit allowed; sync labels stay honest (`local-only` / `linked-local` until Cloud sync exists).

Full design, verification matrix, and Phase 5 roadmap: **[`AUTH_UNIFIED.md`](AUTH_UNIFIED.md)**.

## Next implementation order

1. Point GFD `AUTH_ISSUER` at a running Envision Cloud origin (OIDC AS live in envision-cloud).  
2. Run verification matrix (AUTH_UNIFIED §6) on web + desktop.  
3. Later: Envision Cloud project/media sync (explicitly separate).  
4. Later: public installer / auto-update only with further approval.

## Honesty commitments (unchanged)

- Camera capture ≠ motion retargeting  
- QR phone upload ≠ live wireless viewfinder  
- Signed in ≠ projects synced to the cloud  
