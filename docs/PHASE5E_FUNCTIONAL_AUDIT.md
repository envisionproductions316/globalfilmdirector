# Phase 5E — Functional application audit

**Date:** 2026-10-24  
**GFD baseline (start):** `76ed651`  
**Envision Cloud baseline (start):** `afffdc5`  
**Method:** Browser automation against `http://127.0.0.1:5180`, code inspection, local API probes. UI presence alone was never counted as WORKING.

Classification: **WORKING** / **PARTIAL** / **PLACEHOLDER** / **BLOCKED** / **NOT TESTED**

## Feature matrix

| Workspace / capability | Status | Evidence |
|------------------------|--------|----------|
| Projects — create / open / switch / save | WORKING | Created “Phase5E dock chase…”; title persisted; rail switcher; Save on this device |
| Projects — delete | WORKING | Confirm/cancel delete UI exercised previously; ownership-scoped list |
| Projects — empty / next-step guidance | WORKING | Next-step links update from cast/takes/clips counts |
| Director — local brief apply | WORKING | Local Studio Director; film brief panel shows user instructions separately |
| Director — LLM suggestions | PARTIAL | Works only when LLM env configured; otherwise local apply |
| Characters — create / edit / project association | WORKING | Created Mira on Phase5E project; inspector shows project-local profile |
| Locations | PARTIAL | UI + local records; not deep E2E this phase |
| Capture — webcam record | PARTIAL | Start camera / Record controls present; automation could not obtain camera permission (stayed idle). Pose model loaded (“Pose landmarks — ready”) |
| Capture — phone QR upload | PARTIAL | Session start UI present; honesty copy states not live viewfinder. Not exercised end-to-end this phase |
| Capture — motion retarget / AI tools | PLACEHOLDER | Disabled tools + capability banner; prefs do not drive a retargeter |
| Storyboard / scenes / shots | WORKING | Continuity scenes/shots on project; Add scene/shot on Edit |
| Edit — timeline UI | WORKING | Multitrack timeline, snap, zoom, import control, clip inspector empty-state |
| Edit — import media → timeline | WORKING (code + UI) | File import control on Edit; full import→export path proven via API probe with sample media |
| Audio — mix mute/solo/volume | WORKING (unit + UI) | Timeline mix controls; unit tests pass |
| Export — FFmpeg H.264/AAC MP4 | WORKING | `scripts/phase5e-export-probe.mjs` + manual probe: `docs/phase5e-screenshots/phase5e-export-output.mp4` (h264+aac, 1.0s, 20755 bytes) |
| Backup / restore | PARTIAL | Controls on Projects; unit tests for `gfd-backup-v1`. Full UI file picker restore NOT TESTED in automation |
| Connectors | PARTIAL | Probe UI; FFmpeg connector real; others stubbed honestly |
| Browser OIDC sign-in / session / logout | WORKING | Prior Phase 5D + this phase `npm run test:phase5d` PASS; Account chip flips Account · local device ↔ Local only |
| Account ownership isolation | WORKING | Signed-out view drops owner-linked projects; unit visibility tests PASS |
| Desktop packaged auth matrix | BLOCKED / PARTIAL | Exe launches (`Global Film Director.exe`); smoke PASS; full GUI system-browser login matrix not completed |
| Cloud project/media sync | PLACEHOLDER | Explicitly local-only / linked-local labels; not implemented |

## End-to-end filmmaking path (honest)

Exercised path:

1. Create project (Phase5E dock chase) → **PASS**
2. Add character Mira → **PASS**
3. Director brief / plan continuity shown → **PASS** (approve plan UI present)
4. Capture record → **PARTIAL** (camera permission blocked in automation)
5. Edit timeline → **PASS** (workspace functional; empty until media)
6. Export MP4 → **PASS** via API probe with synthetic sample (not browser-recorded take)
7. Backup → **PARTIAL** (control present; download dialog not automated)
8. Restore → **NOT TESTED** in browser automation

## Screenshots

- `docs/phase5e-screenshots/projects-after.png` — Projects shell after UI improvements
- `docs/phase5e-screenshots/director-after.png` — Director film brief separation
- `docs/phase5e-screenshots/edit-workspace.png` — Edit / media library
- `docs/phase5e-screenshots/phase5e-export-output.mp4` — playable export artifact

## Major changes this phase (functionality)

| Change | Purpose | Evidence |
|--------|---------|----------|
| Destination labels always visible + focus rings | Clear active workspace / keyboard focus | Header snapshot shows Projects/Chat/… labels |
| Active project chip + offline wording | Persistent project + account/offline honesty | `header-active-project`, `Local only · offline OK` |
| Recent project cards (stage + save status) | Professional project list without fake thumbnails from cloud | ContextPanel cards |
| Director film brief panel | Separate user instructions from generated suggestions | `data-testid="film-brief"` |
| Capture capability banner | No decorative claim of retargeting | `data-testid="capture-capability-note"` |
| Design tokens (success/warning/danger/focus/radius) | Consistency without redesign | `app/globals.css` |
| Export probe script | Prove FFmpeg path beyond unit tests | `scripts/phase5e-export-probe.mjs` |
