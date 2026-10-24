# Phase 5D — GFD security notes

Companion to Envision `docs/PHASE5D_SECURITY_REVIEW.md`.

| Finding | Fix |
|---------|-----|
| Client bundle `node:crypto` | Web Crypto PKCE only |
| Session cookies not sticking | `NextResponse.cookies.set` |
| Strict Mode PKCE loss | used-key remount buffer |

Not a penetration test. Packaged Electron IPC/`safeStorage` remain code-reviewed; UI matrix BLOCKED this pass.
