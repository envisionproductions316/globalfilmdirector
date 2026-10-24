# Phase 5 — Security review (auth gate)

**Date:** 2026-10-23  
**Scope:** GFD auth scaffold + Envision Cloud OIDC AS  
**Related:** [`PHASE5_IDP_VERIFICATION.md`](PHASE5_IDP_VERIFICATION.md) · [`AUTH_UNIFIED.md`](AUTH_UNIFIED.md)

## Summary

Envision Cloud exposes an OAuth/OIDC AS via `oidc-provider`. GFD may set `AUTH_ISSUER` for local testing. Production claims still require the AUTH_UNIFIED §6 manual matrix.

## Findings

| ID | Severity | Finding | Mitigation / status |
|----|----------|---------|---------------------|
| P5-01 | **Resolved** | Missing OIDC AS on Envision | Implemented `server/oidc-provider.mjs` + file adapter + tests |
| P5-02 | Medium | Claiming “same account” without manual matrix | Docs require §6 before production claims |
| P5-03 | Medium | Web session cookie stores user JSON; token cookie is httpOnly | Acceptable for scaffold; rotate/short TTL when live |
| P5-04 | Low | Desktop `safeStorage` insecure fallback | Mitigated: set `AUTH_REQUIRE_SAFE_STORAGE=1` to refuse login |
| P5-05 | Low | Studio backups include project metadata (`ownerUserId`) but not OS/cookie tokens | Keep tokens out of `gfd-backup-v1`; scrub on export |
| P5-06 | Info | Capture/export APIs remain device-local (no cloud owner ACL yet) | Expected until Cloud sync; ownership is client-local |
| P5-07 | **Resolved** | Desktop/web access expiry without refresh | Desktop vault refresh + web `/api/auth/session` refresh |

## Controls already in GFD

- No password hashing or password DB in GFD  
- PKCE S256 for authorization-code flow  
- Desktop: system browser + loopback redirect; no Node in renderer  
- Sign-out keeps local media; linked projects hidden when signed out  
- Explicit link action (no silent assign-all on first login)  
- Sync labels never imply Envision Cloud upload  

## Residual risk until IdP ships publicly

Anyone with physical access to the machine can still access **unowned** local projects. Account-linked projects are hidden without that owner’s session, but offline filesystem/IndexedDB forensic access remains a device-trust model (honest for local studio software).

## Recommendation

1. Point GFD at a running Envision OIDC origin for local verification.  
2. Re-run verification matrix before enabling `AUTH_*` in production GFD builds.  
3. Do not publish a public desktop installer until that matrix passes.
