# Desktop preparation (pre-Electron)

**Status:** Preparation only — **Electron is not implemented yet.**  
**Locked decisions (2026-10-23):** see §1.  
**Related:** [`PRE_DESKTOP_AUDIT.md`](PRE_DESKTOP_AUDIT.md), [`DEVELOPER_STATUS.md`](DEVELOPER_STATUS.md), [`MACHINE_TOOLS.md`](MACHINE_TOOLS.md).

---

## 1. Locked product decisions

| Decision | Choice |
|----------|--------|
| Desktop shell v1 | **Electron** (preserve Next.js + FFmpeg pipeline) |
| Tauri | Future alternative only |
| Phone in MVP | **QR record / upload** only |
| Live wireless preview | Future (not MVP) |
| 3D retarget / performance blending | Future (keep as Proposed design target) |
| Figma | Separate **Current** vs **Proposed** frames; do not overwrite approved originals |
| Character Mirror Proposed | Remains the **target experience**; advanced features stay in design even if not shipping |

Do not rewrite GFD, introduce Base44, replace the design language, or remove existing functionality for desktop prep.

---

## 2. Uncommitted change inspection (purpose)

Inspected working tree vs `origin/main` / HEAD before baseline. **Purpose groups:**

### A. Capture / Character Mirror (keep)

| Path | Purpose |
|------|---------|
| `components/screens/CaptureWorkspace.tsx` | Five-step studio, webcam/mic, pose overlay, Live Sync silhouette, phone QR session, honest NI labels |
| `lib/pose-tracker.ts` | MediaPipe pose landmarker + overlay + silhouette |
| `lib/tracking.ts` | Honest facade (`retarget: false`) |
| `app/mobile-capture/page.tsx` | Phone companion recorder |
| `app/api/capture/session/route.ts` | Session create / status / upload / ack |
| `lib/capture-sessions.ts` | In-memory session Map (TTL) — **risk:** not durable |

### B. Timeline / Edit (keep)

| Path | Purpose |
|------|---------|
| `components/timeline/ProductionTimeline.tsx` | Real trim handles, snap, zoom, gap markers, close gaps |
| `lib/timeline.ts` + tests | Gap detect/close, snap, zoom helpers |
| `lib/continuity.ts` + tests | `timeline-gap` warnings |
| `components/ui/Timeline.tsx` | Real character performance take bars |
| `components/ContextPanel.tsx` | Edit inspector adjusters; honest disabled AI tools |

### C. Studio produce path (keep)

| Path | Purpose |
|------|---------|
| `lib/studio.tsx` | Schema v3 state, takes, clips, gaps API |
| `lib/director-apply.ts` + API + tests | Local Director + optional LLM |
| `components/screens/*` | Projects → Export CTAs, Locations, Connectors honesty |
| `lib/connectors*.ts`, `app/api/connectors/probe` | Local-only connectors |
| Docs / `.env.example` | Status, machine tools, audit, env template |

### D. Explicitly excluded from Git

| Pattern | Why |
|---------|-----|
| `.next/`, `node_modules/`, `dist/`, `out/` | Generated |
| `.env.local`, `.env` with secrets | Credentials |
| IndexedDB / browser profile data | Not in repo; see §4 |
| OneDrive / OS temp / `*.log` | Noise |

`.env.example` is safe (commented placeholders only).

### E. Verification at prep time

| Check | Result |
|-------|--------|
| `npm test` | 15/15 pass |
| Secrets in `.env.example` | None (keys commented empty) |
| Live Electron | **Not started** (per instruction) |

---

## 3. Git baseline policy

1. Commit **source + docs** that implement the honest Capture / phone upload / pose / timeline / produce path.  
2. Do **not** commit `.next`, media blobs, or secret env files.  
3. Tag or note the baseline SHA after commit as **desktop-prep baseline** (human label).  
4. Git **does not** back up IndexedDB recordings — see §4.

---

## 4. Project & media backups (Git is not enough)

### What Git stores

- Source code, schemas in TypeScript, docs.  
- **Not** user projects, takes, or MP4s.

### What lives only in the browser today

| Store | Location | Contents |
|-------|----------|----------|
| `localStorage` | Origin `http://127.0.0.1:5180` (or LAN origin) | Key `gfd.studio.v1` — projects, characters, clips metadata (schema v3) |
| IndexedDB | Same origin, DB `gfd-media` | Recording / import **blobs** |

### Backup procedure (manual until export tool ships)

1. **Before desktop work or browser profile wipe:**  
   - DevTools → Application → Local Storage → copy `gfd.studio.v1` to a dated `.json` file.  
   - DevTools → IndexedDB → `gfd-media` → export or save critical takes via in-app Export MP4 + keep source files if imported from disk.  
2. **Prefer:** re-import known media from disk into a fresh project after restore.  
3. **Desktop target:** migrate both stores into Electron `userData` (see §5).  
4. **Never assume** `git commit` or OneDrive sync of the repo folder backs up IndexedDB.

### Blocking gap

There is **no first-class in-app “Backup project + media”** yet. That is a **P0 before trusting desktop migration**. Until then, document manual DevTools backup for any production you care about.

---

## 5. How Electron v1 will preserve data & pipelines

*(Design only — not implemented.)*

| Concern | Approach |
|---------|----------|
| Existing Next routes | Package **Next.js standalone** server; Electron `BrowserWindow` loads `http://127.0.0.1:<port>` |
| FFmpeg export | Keep `/api/export` → `spawn(ffmpeg)`; bundle or discover FFmpeg sidecar on PATH |
| QR phone upload | Keep `/mobile-capture` + `/api/capture/session`; advertise LAN URL; **not** live WebRTC in MVP |
| Project JSON | Read/write `gfd.studio.v1` from Chromium partition first; migrate to `{userData}/gfd/studio.json` |
| Media blobs | Migrate IDB → `{userData}/gfd/media/{id}` with same IDs so clips keep working |
| Pose / MediaPipe | Keep browser path; later vendor WASM/model for offline |
| Proposed Character Mirror features | Remain disabled/honest in UI; design stays Proposed in Figma |

### Proposed Electron file structure (future)

```text
desktop/                          # NEW — not created yet
  package.json                    # electron + electron-builder
  main.mjs                        # start Next standalone, open window
  preload.mjs                     # minimal bridge (optional later)
  entitlements / builder.yml      # Windows NSIS; later macOS
resources/
  ffmpeg/                         # optional sidecar binaries
.next/standalone/                 # produced by `npm run build`
```

Root app stays the Next.js app. Electron is a **wrapper**, not a rewrite.

### Packaging approach (future)

1. `npm run build` → standalone output.  
2. electron-builder packs standalone + `node` runtime usage via Electron’s Node + child process for Next, **or** spawn the standalone `server.js`.  
3. Windows x64 installer first.  
4. Code signing deferred until cert available (note as risk).

### Security configuration (future)

| Topic | Intent |
|-------|--------|
| Bind | Default `127.0.0.1` for UI; LAN bind only when phone capture enabled |
| `webPreferences` | `contextIsolation: true`, `nodeIntegration: false`, minimal preload |
| Permissions | Camera/mic prompts; no remote content by default |
| CSP | Keep Next defaults; avoid `file://` loading of untrusted HTML |
| Updates | Optional later; do not auto-download unsigned builds |
| Secrets | Director keys via env / OS secret store — never bake into installer |

### Acceptance tests (before calling desktop v1 done)

| # | Test |
|---|------|
| 1 | Installer launches app; Projects create works |
| 2 | Webcam record → take in Characters / Capture |
| 3 | QR phone upload on same LAN (optional if no phone; document skip) |
| 4 | Place on timeline → trim → close gaps |
| 5 | Export downloads real H.264/AAC MP4 |
| 6 | Restart app: project JSON + media still present (userData) |
| 7 | No UI claims live viewfinder / mesh retarget / AI blend as working |
| 8 | `npm test` still green in CI/dev |

---

## 6. Figma organization

Approved file: `ybDQ62Q6oBo1W8HkDJyJV4`.

| Label | Source frame (preserved) | Meaning |
|-------|--------------------------|---------|
| **CURRENT** | `50:2` Character Mirror — Studio Layout | Closest to implemented honest Capture |
| **PROPOSED** | `51:2` Live Capture Reference (+ Character Mirror target art) | Future target — live phone, 3D, blend, etc. |
| Edit CURRENT vs decorative bars | `1:251` remains approved; Proposed Edit may be added later | Real NLE exists in code |

**Rule:** Clone / label on a dedicated page; **do not overwrite** `1:90`, `50:2`, `51:2`, Day variants, or specs 24–36.

Manifest updates live in `figma-manifest.json` under section notes for Current/Proposed.

---

## 7. Blocking risks (before Electron authorization)

| Risk | Blocker? | Mitigation |
|------|----------|------------|
| No in-app project+media backup | **Yes for safe migration** | Ship backup/export or mandate manual DevTools backup |
| Capture sessions in memory only | **Yes for multi-restart phone flows** | Persist sessions to disk before Electron |
| Large previously uncommitted tree | Reduced once baseline committed | This prep commit |
| MediaPipe CDN offline | Soft | Vendor assets later |
| FFmpeg not in installer | Soft for dev | Sidecar in packager |
| Unreviewed Electron security | **Yes before public installers** | Harden webPreferences + bind |
| Live phone confusion | Soft | Keep Proposed in Figma; MVP copy = QR upload |

---

## 8. Next authorization gate

Electron implementation may begin only after:

1. This prep doc reviewed.  
2. Git baseline SHA recorded.  
3. Stakeholder confirms backup procedure for any precious IndexedDB takes.  
4. Explicit “authorize Electron implementation” message.

Until then: **do not add `desktop/`, do not add electron dependencies, do not change runtime packaging.**
