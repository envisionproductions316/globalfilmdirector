# Phase 5B — Security review (unified auth)

**Date:** 2026-10-23  
**Scope:** GFD web BFF + Electron desktop RP against Envision Cloud OIDC  
**Related:** [`PHASE5B_VERIFICATION.md`](PHASE5B_VERIFICATION.md) · [`PHASE5_SECURITY_REVIEW.md`](PHASE5_SECURITY_REVIEW.md)

## Controls

| Control | Status |
|---------|--------|
| No GFD password database | Pass |
| PKCE S256 web + desktop | Pass |
| ID token iss/aud/exp/nonce + RS256 JWKS verify | Pass (web BFF + desktop) |
| Web tokens HttpOnly; desktop `safeStorage` | Pass |
| Desktop public client (no embedded secret) | Pass |
| Refresh revoke on sign-out | Pass (best-effort `/oauth/revoke`) |
| Backups scrub auth-like fields | Pass |
| Auth ≠ cloud sync labels | Pass |
| Explicit legacy project linking | Pass |

## Residual

| Item | Notes |
|------|-------|
| Device trust | Offline / forensic access to unowned local media remains possible |
| SMTP | Recovery/verification delivery not proven without configured mail |
| Multi-replica IdP | File adapter is single-process |
| Manual §6 matrix | Required before production “same account everywhere” claims |

## Recommendation

Ship for **local verification** with Envision on loopback. Block public IdP exposure and installer publish until HTTPS secrets, SMTP, shared adapter, and the manual matrix are done.
