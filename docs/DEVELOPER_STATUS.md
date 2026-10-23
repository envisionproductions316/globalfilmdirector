# Developer status — Global Film Director

Handoff for engineers picking up [envisionproductions316/globalfilmdirector](https://github.com/envisionproductions316/globalfilmdirector).

Design source: [Figma `ybDQ62Q6oBo1W8HkDJyJV4`](https://www.figma.com/design/ybDQ62Q6oBo1W8HkDJyJV4). Shell layout rules live in [`AGENTS.md`](../AGENTS.md).

## Verdict

Local studio is usable end-to-end on this machine: create a project, capture a raw take, place it on the shared timeline, edit/mix, and export an MP4 when FFmpeg is on PATH. Cloud AI, retargeting, and related connectors stay honestly unavailable.

Default URL: **http://127.0.0.1:5180**

## How to run

Requirements: **Node.js 20+**, **FFmpeg + ffprobe on PATH** (export only), Chromium-based browser for Capture.

```bash
npm install
npm run build
npm start
```

Open http://127.0.0.1:5180

Development:

```bash
npm run dev
```

LAN bind (optional):

```bash
# Windows PowerShell
$env:HOST="0.0.0.0"; npm start

# macOS / Linux
HOST=0.0.0.0 npm start
```

### Readiness gate

```bash
npm run ready
```

Runs typecheck, unit tests, production build, and `npm run check` (Node + build artifact + FFmpeg).

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server (default `127.0.0.1:5180`) |
| `npm run build` | Production build (`output: "standalone"`) |
| `npm start` | Standalone production server ([`scripts/start-production.mjs`](../scripts/start-production.mjs)) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Timeline / continuity unit tests |
| `npm run check` | Build + FFmpeg presence |

### Docker (self-host)

Export needs a Node process that can spawn FFmpeg. Not a static or serverless-only deploy.

```bash
docker build -t global-film-director .
docker run --rm -p 5180:5180 global-film-director
```

## Architecture (short)

- Next.js 15 App Router + React 19 + Tailwind v4
- Studio state: `localStorage` key `gfd.studio.v1` (schema v3) via [`lib/studio.tsx`](../lib/studio.tsx)
- Media blobs: IndexedDB `gfd-media` via [`lib/media-db.ts`](../lib/media-db.ts)
- Shell: header destinations + asset rail + context inspector ([`components/AppShell.tsx`](../components/AppShell.tsx))
- Shared timeline across Edit and Audio; Export encodes that timeline through [`app/api/export/route.ts`](../app/api/export/route.ts) + [`lib/export-jobs.ts`](../lib/export-jobs.ts)

```mermaid
flowchart LR
  Projects --> Director
  Director --> Characters
  Characters --> Capture
  Capture --> Timeline
  Storyboard --> Timeline
  Timeline --> Edit
  Timeline --> Audio
  Timeline --> Export
  Export --> FFmpeg[Local FFmpeg]
```

## Subsystem status

| Area | Status | Notes |
|------|--------|-------|
| Projects | Done | Create / switch / delete / local save |
| Director | Done (local + optional LLM) | Smooth chat; local apply always; `POST /api/director` when `OPENAI_API_KEY` / `DIRECTOR_API_KEY` set; create project → `/director` |
| Characters + Visual Styles | Done | `kind` + `species` for humans/animals/creatures; passport + Face/Body/Voice/Wardrobe |
| Locations | Done | Derived from scenes/shots; opens Storyboard |
| Capture | Done (raw + phone upload + pose) | Webcam record; phone QR session → take upload; MediaPipe pose overlay when model loads; Live Sync = 2D silhouette preview only (not retarget) |
| Storyboard | Done | Shots / Sequence / Scene / Continuity / Graph |
| Edit | Done | Multitrack timeline, import, captions, SequencePlayer |
| Audio | Done | Same timeline; mix; narration; Music/SFX preferred import track |
| Export | Done (local FFmpeg) | Probe + encode H.264/AAC MP4; sample queue rows labeled |
| Connectors | Real local tools only | FFmpeg, browser AV, this-device storage, shared timeline; `/api/connectors/probe`; no cloud marketplace stubs |
| Machine tools (PC) | Installed, not wired | Blender, Kdenlive, OpenToonz, Whisper, Rhubarb on this Windows machine — see [`MACHINE_TOOLS.md`](MACHINE_TOOLS.md). Not Connect cards. |

## Intentionally not live

Do not implement UI that pretends these work until they are integrated and tested:

- APG / GCIE as Director providers (optional OpenAI-compatible LLM via env is the cloud path for now)
- Envision Cloud
- Motion retargeting / mesh Live Sync (2D silhouette preview is not retargeting)
- Live wireless phone viewfinder (phone records & uploads takes; not a live remote camera feed)
- AI lip-sync / expression / regenerate-motion tools (Rhubarb is on the PC; app does not call it yet)
- Blender / ComfyUI workers (Blender is installed; ComfyUI is not; neither is a studio worker yet)

## Recent handoff highlights

- Capture studio shell aligned with design regions (header destinations, asset rail, inspector tools)
- Take selection scoped to the active character before timeline placement
- Standalone production start (do not use `next start` with `output: "standalone"`)
- README rewritten for install / run / Docker (was Figma-only stub)

## Verify before merge or demo

- [ ] `npm run ready` passes
- [ ] `/projects`, `/capture`, `/edit`, `/export`, `/api/export`, `/icon.svg` return 200
- [ ] Capture: Tools → Add to Timeline shows an on-screen message (`data-testid=capture-message`)
- [ ] Export page shows FFmpeg status when FFmpeg is installed
- [ ] Connectors / Capture still say unavailable systems are not connected
