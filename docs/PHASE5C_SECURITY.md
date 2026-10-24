# Phase 5C — GFD production authentication review

**Date:** 2026-10-23  
**Scope:** Inspect website BFF + desktop PKCE clients; fix only demonstrated defects.  
**IdP hardening:** Envision Cloud Phase 5C (`docs/PHASE5C_SECURITY.md` in envision-cloud).

## Review results

| Area | Verdict |
|------|---------|
| Website BFF session (HttpOnly cookies, server-side token exchange) | OK — no change |
| Desktop PKCE + system browser + loopback `/callback` | OK — no change |
| Loopback redirect protection | OK — Envision allowlist + GFD listener |
| Windows `safeStorage` / `AUTH_REQUIRE_SAFE_STORAGE` | OK — no change |
| Token refresh + revoke | OK — covered by `test:phase5b` |
| Account switching + project isolation (`ownerUserId`) | OK — no change |
| Offline access policy | OK — local projects remain device-local; auth ≠ sync |
| Tokens excluded from project backups | OK — scrub retained |

**Defects fixed in GFD this phase:** none required.

## Residual (IdP / ops)

Production blockers live on Envision: HTTPS issuer, Postgres OIDC adapter, persistent JWKS, SMTP. See Envision `docs/PRODUCTION_AUTH_DEPLOYMENT.md`.
