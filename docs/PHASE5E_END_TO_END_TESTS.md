# Phase 5E — End-to-end and quality tests

## Automated (Node 22.23.4)

| Suite | Result |
|-------|--------|
| GFD `npm test` | PASS 21/21 |
| GFD `npm run typecheck` | PASS |
| GFD `npm run test:phase5d` | PASS (session retained; logout clears) |
| GFD `npm run desktop:smoke` | PASS (exe + auth source checks; GUI login not launched by script) |
| Envision `npm test` | PASS 215/215 |
| Envision OIDC-focused (`oidc-*.test.mjs` set) | PASS 25/25 |

## Export probe (real file)

```text
node scripts/phase5e-export-probe.mjs
```

Requires GFD on `http://127.0.0.1:5180`.

| Artifact | Result |
|----------|--------|
| `docs/phase5e-screenshots/phase5e-sample.mp4` | Input sample (lavfi → h264/aac) |
| `docs/phase5e-screenshots/phase5e-export-output.mp4` | Exported timeline MP4 |
| ffprobe | `h264` + `aac`, duration `1.000000`, size `20755` |

## Browser workflow checklist

| Step | Result |
|------|--------|
| Create project | PASS |
| Add character | PASS (Mira) |
| Director brief / continuity | PASS |
| Capture Start camera | PARTIAL — permission/device not granted in automation; controls remain idle |
| Edit import control visible | PASS |
| Timeline empty-state honesty | PASS |
| Backup control visible | PASS |
| Restore with media | NOT TESTED (file picker) |
| Keyboard focus rings on destinations | PASS (CSS focus-visible) |
| Console errors | NOT fully scraped; Next.js issues badge observed occasionally (dev overlay) — not treated as production PASS |
| Offline / local-only chip | PASS |
| Desktop GUI errors | NOT TESTED beyond process launch |

## Regression notes

- Auth identity flaps in the embedded browser can change which projects are visible (ownership). Treat as expected isolation, not data loss.
- `createProduction` sometimes remained on `/projects` instead of navigating to `/director` under automation; project still created. Manual/navigation links work.
