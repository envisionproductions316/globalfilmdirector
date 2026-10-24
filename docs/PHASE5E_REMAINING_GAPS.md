# Phase 5E — Remaining gaps

## Not production-ready

Phase 5E closes incremental studio quality + verification documentation. It does **not** clear production deployment.

## Open gaps

1. **Packaged Windows GUI OIDC matrix** — sign-in, restart persistence, account switch, offline, local project preserve (operator or Electron automation).
2. **Approved live Postgres** — migrations, two-instance token concurrency against shared DB (no production writes without approval).
3. **Approved external SMTP inbox** — registration + password-recovery delivery (not outbox-only).
4. **Staging HTTPS issuer + matching client secrets** — fail-closed production posture (carried from 5C/5D).
5. **Webcam capture E2E in CI/automation** — needs granted camera/mic; phone QR take upload not fully exercised.
6. **Backup/restore UI file round-trip** — control exists; full media restore not automated this phase.
7. **Auth session stability across soft navigations** — occasional chip flip Local only ↔ Account during long automation; investigate hydration/session refresh race if reproducible outside automation.
8. **Figma MCP screenshot parity** — MCP session timed out; no pixel-perfect claim vs Figma.
9. **LLM Director path** — only when configured; default is local apply.
10. **Cloud project/media sync** — intentionally unimplemented.

## Explicitly out of scope (still)

- Public deployment / DNS / paid infra without approval  
- Base44 / new auth system / rewrite  
- Claiming AI video generation or mesh retargeting  

## Suggested next phase focus

Operator-run desktop GUI auth matrix + approved Postgres/SMTP staging credentials, then Capture permissioned media → Edit → Export → Backup/Restore on one signed-in profile without identity flap.
