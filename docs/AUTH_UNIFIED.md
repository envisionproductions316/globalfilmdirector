# Global Film Director — Unified account authentication

**Status:** Phase 5B **unified web + desktop auth** against Envision Cloud OIDC. Configure `AUTH_ISSUER` for local login. Auth ≠ cloud sync. See [`PHASE5B_VERIFICATION.md`](PHASE5B_VERIFICATION.md).
**Date:** 2026-10-23  
**Related:** [`PHASE5_IDP_VERIFICATION.md`](PHASE5_IDP_VERIFICATION.md) · [`PHASE5_SECURITY_REVIEW.md`](PHASE5_SECURITY_REVIEW.md) · [`DESKTOP.md`](DESKTOP.md) · [`DESKTOP_REAUDIT.md`](DESKTOP_REAUDIT.md)

## Critical distinction

| Concept | Meaning |
|---------|---------|
| **Unified authentication** | One Envision / GFD **user identity** works on the **website** and the **Windows desktop** app (register once, sign in everywhere). |
| **Cloud project / media sync** | Uploading or mirroring productions across devices via **Envision Cloud**. |

**A shared account does not mean projects are synchronized.** UI and docs must never imply local data was uploaded until a tested sync path exists.

---

## 1. Inspection of existing infrastructure

### In this repository (`globalfilmdirector`)

| Area | Finding |
|------|---------|
| Auth libraries | **OIDC/PKCE scaffold** in-repo (`lib/auth/*`, `/api/auth/*`, `desktop/auth.mjs`) — **no** custom password store |
| Account UI | `AccountPanel` + `/auth` — sign-in/out/register/reset; cloud chip says account ≠ sync |
| Project data | Device-local `localStorage` (`gfd.studio.v1` schema v4 + `ownerUserId` / `syncStatus`) + IndexedDB (`gfd-media`) — **not** cloud records |
| Desktop | Electron PKCE via system browser; tokens in `safeStorage` vault under userData |
| Env | `.env.example` documents `AUTH_*` / `NEXT_PUBLIC_AUTH_*` — **values required for live IdP** |

### In the Envision org (external)

| System | Finding |
|--------|---------|
| **Envision Cloud** | First-party cookie sessions + **thin OAuth/OIDC AS** (`/.well-known/openid-configuration`, `/oauth/*`) reusing the same user store. **Do not invent a second password database in GFD.** |
| **Supabase (Productions LLC)** | MCP org exists; **zero projects** today. Viable **fallback IdP** (Auth + free-tier limits) only after **explicit cost approval** if a new project would bill. |
| **GFD itself** | Must **not** implement custom password hashing or a home-grown auth API. |

### Constraints (locked)

1. Do **not** invent a custom authentication backend or password store in GFD.  
2. Do **not** introduce **paid** authentication services without approval.  
3. Prefer one **central** identity provider shared by web + desktop.  
4. Preserve existing local projects/recordings; linking to an account is a controlled migration, not a wipe.  
5. Offline editing of local projects remains allowed; sync status must stay honest.

---

## 2. Target architecture

```text
                    ┌──────────────────────────────┐
                    │  Central identity provider   │
                    │  (preferred: Envision Cloud  │
                    │   identity / OIDC; fallback: │
                    │   approved Supabase Auth)    │
                    │  register · sign-in · reset  │
                    │  email verify · sessions     │
                    └─────────────┬────────────────┘
                                  │
              OIDC / OAuth 2 + PKCE (authorization code)
                                  │
           ┌──────────────────────┴──────────────────────┐
           │                                             │
           ▼                                             ▼
   ┌───────────────┐                           ┌─────────────────┐
   │  GFD Website  │                           │  GFD Desktop    │
   │  Next.js      │                           │  Electron       │
   │  session      │                           │  system browser │
   │  cookies /    │                           │  + loopback or  │
   │  provider SDK │                           │  custom URI     │
   └───────┬───────┘                           └────────┬────────┘
           │                                             │
           │  ownerUserId on local project metadata      │
           │  tokens: never in localStorage (desktop)    │
           │  desktop: Electron safeStorage / OS vault   │
           ▼                                             ▼
   Local studio data (device) — isolated by ownerUserId when linked
   Sync to Envision Cloud = SEPARATE future pipeline (not auth)
```

### Desktop auth flow (required shape)

1. User chooses Sign in / Create account in the desktop app.  
2. Electron opens the **system browser** to the IdP authorize URL with **PKCE** (`code_verifier` / `code_challenge`).  
3. After consent, redirect to a **loopback** (`http://127.0.0.1:<port>/callback`) or registered **custom protocol** (`gfd://auth/callback`).  
4. Main process exchanges `code` + `verifier` for tokens **outside** the renderer.  
5. Refresh / access tokens stored only via **`safeStorage`** (or OS credential APIs) — **not** `localStorage`, **not** plaintext files.  
6. Renderer receives a minimal session snapshot (user id, email, display name, expiry) over the existing restricted preload bridge.  
7. Sign-out clears OS-stored credentials and in-memory session; **does not** delete local projects or media.

### Web auth flow

- Same IdP: registration, sign-in, sign-out, password reset, email verification.  
- Session via provider-recommended secure cookies / SDK (HttpOnly where applicable).  
- Same `user.id` (subject) as desktop.

### Data isolation (local-first)

| Rule | Behavior |
|------|----------|
| Linked projects | Carry `ownerUserId` (+ optional `ownerEmail` for display). |
| Active session | UI lists only projects owned by the signed-in user **or** explicitly marked unowned/local pending link. |
| Cross-account | Account A must not open Account B’s private linked projects on the same machine. |
| Unowned legacy | Pre-auth local data remains readable until the user completes **account linking** (see §4). |
| Sign-out | Session ends; local files/IDB remain on disk. |

### Offline & sync honesty

| State | UI label (examples) | Meaning |
|-------|---------------------|---------|
| `local-only` | Local on this device | Not associated with an account |
| `linked-local` | Saved for *you* · on this device | Account-bound; **not** uploaded |
| `cloud-pending` | Waiting for Envision Cloud | Reserved; **do not show** until sync exists |
| `cloud-synced` | Synced (Envision Cloud) | Only after a verified sync implementation |

Offline editing of `local-only` / `linked-local` projects must work without network. Never show “Synced” for local-only data.

---

## 3. Provider decision matrix

| Option | Fit | Gate |
|--------|-----|------|
| **Envision Cloud identity (OIDC)** | **Approved + AS implemented** | Point GFD `AUTH_ISSUER` at Envision; clients `gfd-web` / `gfd-desktop` |
| **Supabase Auth (new GFD project)** | Fallback only | **Not recommended** |
| **Custom password DB in GFD** | **Forbidden** | — |
| **Paid Auth0 / Clerk / etc.** | Only with explicit approval | — |

**Phase 5 progress:** OIDC AS lives in `envision-cloud`. GFD uses `/oauth/authorize` + `/oauth/token`. Complete AUTH_UNIFIED §6 manually before production claims.

---

## 4. Linking existing local projects

Controlled migration (required):

1. On first successful sign-in, detect unowned local studio state / media.  
2. Present a clear dialog: **Keep local only** · **Link all to this account** · **Link selected projects** (if multi-project UX allows).  
3. Linking writes `ownerUserId` into studio metadata; media IDs unchanged.  
4. Never auto-upload media during link.  
5. Backup (`gfd-backup-v1`) remains available before linking.  
6. Sign-out must not reverse ownership metadata or delete media.

---

## 5. Multi-device sessions vs sync

- Multiple devices may hold **valid sessions** for the same account.  
- Each device keeps its **own** local project copies until Envision Cloud sync ships.  
- Auth refresh/expiry is independent of “is this project on another PC.”

---

## 6. Verification checklist (Phase 5 exit)

| # | Test | Pass criteria |
|---|------|---------------|
| 1 | Register on website → sign in on desktop | Same user id / email |
| 2 | Register via desktop browser flow → sign in on website | Same user id / email |
| 3 | Sign out on desktop | Session cleared; local projects still present |
| 4 | Two accounts on one machine | A cannot open B’s linked private projects |
| 5 | Restart desktop | Session restores from OS-secure storage (or re-auth if expired) without plaintext token files |
| 6 | Password reset | Completes via IdP email flow |
| 7 | Email verification | Required by IdP policy before full access (as configured) |
| 8 | Legacy local projects | Accessible via link/keep flow; no silent wipe |
| 9 | Offline edit | Works; UI does **not** claim cloud sync |
| 10 | Honesty | Header/cloud chip distinguishes signed-in vs synced |

---

## 7. Implementation roadmap (Phase 5+)

| Step | Work | Depends on |
|------|------|------------|
| **5.0** | Approve IdP product | **Done** — Envision Cloud preferred |
| **5.0b** | Verify OIDC/OAuth AS capability | **Done** — AS added after gap finding |
| **5.0c** | Envision Cloud: OAuth/OIDC AS + client registry | **Done** (`server/oidc-provider.mjs`) |
| **5.1** | Web: register / sign-in / sign-out / reset / verify against IdP | **Ready** — set `AUTH_ISSUER` |
| **5.2** | Desktop: system-browser PKCE + secure token store + preload session API | **Ready** — client `gfd-desktop` |
| **5.3** | Schema: `ownerUserId` on projects; isolation rules in studio load/save | **Done** (v4 + pickers/guard) |
| **5.4** | Account-linking wizard for legacy local data | **Done** (explicit consent; no auto-link) |
| **5.5** | Sync-status model in UI (`local-only` / `linked-local` only at first) | **Done** |
| **5.6** | Envision Cloud **project/media sync** (separate phase) | Auth stable + Cloud APIs |

Phase 4 desktop packaging remains valid without auth; Phase 5 makes unified auth **mandatory** before claiming multi-surface account readiness.

---

## 8. Out of scope for auth phase

- Implementing Envision Cloud file sync or “upload all projects”  
- Requiring always-online use for local capture/edit/export  
- Public installer / auto-update (still separate approval)  
- Custom credential cryptography in the GFD repo
