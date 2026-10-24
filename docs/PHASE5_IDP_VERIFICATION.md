# Phase 5 — Envision Cloud identity verification

**Date:** 2026-10-23 (updated after OAuth AS + gap close)  
**Authority:** Phase 5 authorization (Envision Cloud preferred IdP; no new Supabase project; no GFD password DB)  
**Sources:** `envision-cloud` (`server/oidc-provider.mjs`, file adapter, tests) · GFD RP scaffold  

## Verdict (current)

| Question | Answer |
|----------|--------|
| Preferred IdP | **Envision Cloud** (approved) |
| OAuth/OIDC AS for GFD? | **Phase 5A:** `oidc-provider` in `envision-cloud` (see that repo’s `docs/PHASE5A_READINESS.md`) |
| Live production login? | Configure locally only after Envision is running; no public IdP / no GFD installer |
| Cloud project sync? | **Still out of scope** |

Session-only APIs were never treated as OIDC. The AS was added as the smallest secure extension.

---

## Capability matrix (after AS)

| Requirement | Status |
|-------------|--------|
| `/.well-known/openid-configuration` | Yes |
| `/oauth/authorize` + PKCE S256 | Yes |
| `/oauth/token` (code + refresh) | Yes |
| `/oauth/userinfo` | Yes |
| `/oauth/revoke` | Yes |
| Clients `gfd-web` / `gfd-desktop` | Yes (desktop = public + loopback; web = public on HTTP loopback, confidential when secret/HTTPS) |
| Registration / password recover | Via existing Envision `/api/auth/*` + authorize login HTML |
| Shared identity across GFD web + desktop | Yes (same Envision user `sub`) |
| Separate password DB in GFD | No |
| Desktop token refresh on expiry | Yes (`desktop/auth.mjs` + `safeStorage`) |
| Web BFF token refresh on expiry | Yes (`/api/auth/session` + httpOnly refresh cookie) |
| Local OIDC durability (single process) | Yes (file adapter + `accounts.json`) |

Automated coverage: `envision-cloud` `tests/oidc-provider.test.mjs` (+ full suite).

---

## Configure local end-to-end

1. In **envision-cloud**: enable identity (`ENVISION_LOCAL_MODE=true` on loopback, or Supabase), `npm start`.  
2. Confirm `GET http://127.0.0.1:8000/.well-known/openid-configuration` returns authorize/token URLs and `oidc=true` on `/api/health`.  
3. In **GFD** `.env`:  
   - `AUTH_ISSUER=http://127.0.0.1:8000`  
   - `NEXT_PUBLIC_AUTH_ISSUER=http://127.0.0.1:8000`  
   - `AUTH_CLIENT_ID=gfd-web` / `NEXT_PUBLIC_AUTH_CLIENT_ID=gfd-web`  
   - `AUTH_DESKTOP_CLIENT_ID=gfd-desktop`  
   - Local HTTP: omit `AUTH_CLIENT_SECRET` (Envision treats `gfd-web` as public + PKCE)  
   - HTTPS: set matching `ENVISION_GFD_WEB_CLIENT_SECRET` and GFD `AUTH_CLIENT_SECRET`  
4. Add production GFD HTTPS callback URLs via `ENVISION_GFD_WEB_REDIRECTS` when deploying.  
5. Run AUTH_UNIFIED §6 manual matrix before claiming “same account everywhere.”

---

## Remaining gaps (not closed by this phase)

| Gap | Notes |
|-----|-------|
| Manual matrix on real SMTP / email verify | Needs configured identity SMTP; GFD opens IdP UI for verify/resend |
| Live multi-replica Postgres OIDC | Phase 5C added Postgres + shared-file adapters; live HA still ops |
| IndexedDB → filesystem media | Future desktop work |
| Cloud media sync | Separate phase |
| Public installer | Not authorized |
| Shell `PORT` vs `.env` | Envision: set `PORT=8000` in the process env so it matches `ENVISION_PUBLIC_ORIGIN` |

---

## Security notes

- GFD never handles passwords; authorize login posts to Envision `/api/auth/login`.  
- Desktop redirects restricted to loopback `/callback`.  
- `AUTH_REQUIRE_SAFE_STORAGE=1` refuses desktop sign-in when OS encryption is unavailable.  
- Backups scrub token-like fields (`scrubAuthFromStudioSnapshot`).  
- See [`PHASE5_SECURITY_REVIEW.md`](PHASE5_SECURITY_REVIEW.md).
