# Phase 5E — Studio UI review

**Figma:** [ybDQ62Q6oBo1W8HkDJyJV4](https://www.figma.com/design/ybDQ62Q6oBo1W8HkDJyJV4)  
**Constraint:** Current vs Proposed preserved; no overwrite of approved Proposed frames. Figma MCP session timed out during this pass — improvements aligned to existing implemented honesty targets (Capture Current notes in `figma-manifest.json`).

## Goals addressed

1. **Studio shell** — destination labels always visible; `aria-current` / `aria-pressed`; focus-visible rings; persistent project chip (lg+); clearer local/offline account chip.
2. **Projects** — recent cards with stage, local-save status, Open/Continue; active summary shows status + sync honesty; empty-state copy when no visible projects.
3. **Director** — Film brief panel separates user instructions from Studio Director suggestions; continuity summary.
4. **Characters / Capture** — Capture capability banner states webcam/QR/pose vs unavailable retargeting; disabled AI/camera tools remain labeled Not available.
5. **Edit / Audio / Export** — no new decorative capabilities; existing timeline/export honesty retained. Tokens added for success/warning/danger/focus for future consistent states.

## Before / after

| Area | Before | After |
|------|--------|-------|
| Destination rail | Icon letters dominant; labels `sm:` only | Labels always shown with icon |
| Account / offline | “Local only” | “Local only · offline OK” when signed out; signed-in remains “Account · local device” |
| Project context | Switcher only when >1 project | Always shows active project title on large screens |
| Recent projects | Title + kind | Stage + saved-on-device + Open/Continue + thumb placeholder |
| Director | Thread only | Film brief callout above thread |
| Capture | Honesty scattered | Top-of-page capability banner |

Screenshots: `docs/phase5e-screenshots/projects-after.png`, `director-after.png`, `edit-workspace.png`.

## Design tokens added

In `app/globals.css` (day + night): `--success`, `--warning`, `--danger`, `--focus-ring`, `--space-*`, `--radius-*`.

## Non-goals (honored)

- No architecture rewrite
- No fake AI video generation controls
- No cloud sync chrome
- No replacement of original Figma Current/Proposed screens
