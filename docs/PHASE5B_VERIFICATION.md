# Phase 5B — Unified website ↔ desktop authentication (verification)

**Date:** 2026-10-23  
**IdP:** Envision Cloud `oidc-provider` at local `AUTH_ISSUER`  
**Envision commit (OIDC on operational core):** `b549116` (+ interaction resume hardening in follow-up)

## Verdict

| Question | Answer |
|----------|--------|
| One Envision account for GFD web + desktop? | **Yes** — same `sub` proven by automated code+PKCE flow |
| Working BFF web auth (HttpOnly cookies)? | **Yes** — `/api/auth/callback`, `/session` refresh, `/logout` revoke |
| Working desktop system-browser PKCE? | **Yes** — `gfd-desktop`, loopback callback, `safeStorage` vault |
| Cloud project sync? | **Not activated** — labels stay local / linked-local |
| Public IdP / installer? | **Not authorized** |

## Automated results

| Suite | Result |
|-------|--------|
| Envision `npm test` | **197 pass** (includes OIDC) |
| GFD `npm test` | Unit suite (see run log) |
| GFD `npm run desktop:smoke` | Packaged shell / FFmpeg probe |
| `npm run test:phase5b` | Register → `gfd-web` + `gfd-desktop` code flow → **same `sub`** |

Example Phase 5B proof output:

```json
{ "ok": true, "issuer": "http://127.0.0.1:8000", "sameSub": true }
```

## Browser / Electron matrix

| Test | Status |
|------|--------|
| Register online → desktop login (same account) | Automated shared-sub proof; full UI matrix: **operator** |
| Desktop registration → website login | Automated shared-sub proof; full UI matrix: **operator** |
| Desktop restart restores session | Code path: `getDesktopAuthSnapshot` + refresh |
| Website refresh retains session | Code path: `/api/auth/session` + refresh cookie |
| Sign out keeps local projects | Explicit messages + no delete on logout |
| Two accounts ownership isolation | `ownerUserId` + `ProjectVisibilityGuard` |
| Legacy linking consent | Account panel Keep / Link selected / Link all |
| Invalid auth response rejected | State/nonce/ID-token signature checks |
| Backup excludes credentials | `scrubAuthFromStudioSnapshot` |
| Offline local projects | Unowned + same-owner linked remain usable offline |

Do **not** mark untested UI clicks as verified. Run AUTH_UNIFIED §6 against live SMTP when available.

## Local bring-up

1. Envision: `ENVISION_LOCAL_MODE=true`, `PORT=8000`, matching `ENVISION_PUBLIC_ORIGIN`, `npm start`  
2. Confirm `/.well-known/openid-configuration` and `/api/health` `oidc=true`  
3. GFD `.env.local`: `AUTH_ISSUER` / `NEXT_PUBLIC_AUTH_ISSUER=http://127.0.0.1:8000`, clients `gfd-web` / `gfd-desktop`  
4. `npm run dev` (web) and/or `npm run desktop`  
5. `npm run test:phase5b`

## Production blockers (unchanged)

- Shared multi-replica OIDC adapter  
- HTTPS + `ENVISION_GFD_WEB_CLIENT_SECRET` / GFD `AUTH_CLIENT_SECRET`  
- SMTP for recovery / verification delivery  
- Node LTS for oidc-provider  
- Public DNS / installer approval  
- AUTH_UNIFIED §6 manual device matrix  
