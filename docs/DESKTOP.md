# Global Film Director — Desktop (Electron v1)

**Status:** Local Windows desktop shell implemented. **Not a public release.**  
**Baseline before desktop work:** `17d3cc6` (pushed to `origin/main`).  
**Prep / decisions:** [`DESKTOP_PREP.md`](DESKTOP_PREP.md) · Audit: [`PRE_DESKTOP_AUDIT.md`](PRE_DESKTOP_AUDIT.md)

## Architecture

Electron main (`desktop/main.mjs`) starts the existing **Next.js standalone** server on `127.0.0.1`, then opens a `BrowserWindow` to that origin. The browser app remains available via `npm run dev` / `npm start`.

```text
Electron main
  → spawn Next standalone (ELECTRON_RUN_AS_NODE)
  → BrowserWindow → http://127.0.0.1:<port>/projects
  → preload.cjs (contextIsolation, no nodeIntegration, sandbox)
  → restricted IPC (dialogs, bounded read/write, openPath)
```

No second frontend. No Base44. Figma **Current** frames remain the implemented UI; **Proposed** stays future-only.

## Commands (Windows)

| Command | Purpose |
|---------|---------|
| `npm run build` | Next production / standalone build |
| `npm run desktop` | Build + launch Electron (no manual `npm run dev`) |
| `npm run desktop:pack` | Local test package → `release/win-unpacked/` |
| `npm run desktop:pack:nsis` | Optional NSIS Setup (very slow if FFmpeg bundled) |
| `npm run desktop:smoke` | Headless desktop module checks |
| `npm run dev` / `npm start` | Browser-only (unchanged) |

Launch unpacked build without rebuilding:

`.\release\win-unpacked\Global Film Director.exe`

## FFmpeg

Resolution order (`desktop/ffmpeg-path.mjs`):

1. `GFD_FFMPEG_PATH` / `GFD_FFPROBE_PATH`
2. Packaged `resources/ffmpeg/` (or repo `resources/ffmpeg/` in dev)
3. System PATH

Export continues through `/api/export` with validated args, `GFD_TMP_DIR` cleanup, and no arbitrary shell. Binaries under `resources/ffmpeg/*.exe` are gitignored — copy a trusted build before packing.

## Backup & restore

Projects page → **Backup projects + media** / **Restore backup**. Format **`gfd-backup-v1`** includes studio JSON (projects, scenes, shots, characters/DNA, timeline, audio refs, settings) plus IndexedDB media blobs. Validation runs before restore; UI confirms replace. **GitHub commits are not media backups.**

## Phone capture

QR record/upload preserved. Sessions persist under `GFD_DATA_DIR/capture-sessions` (desktop `userData`) across local server restarts within TTL. This is **not** a live wireless viewfinder.

## Security review (Phase 4)

| Control | Status |
|---------|--------|
| `contextIsolation: true` | Yes |
| `nodeIntegration: false` | Yes |
| `sandbox: true` | Yes |
| Preload surface | Minimal `window.gfdDesktop` only |
| IPC | Dialogs + path allowlist (dialog-chosen or userData/temp); size caps on read/write |
| Navigation | Locked to local server host/port; external URLs via `shell.openExternal` |
| Next server | Bound `127.0.0.1` only |
| FFmpeg | Env/sidecar/PATH discovery; no renderer shell |
| Auto-updater / public publish | **Not configured** |
| CSP | App served by Next; desktop does not load arbitrary remote UI |

Residual risks: localhost server is reachable by other local processes on that port; large backups are memory-heavy (base64 JSON); camera/mic still OS-permission dependent.

## Test results (automated)

| Check | Result |
|-------|--------|
| Baseline `17d3cc6` on `origin/main` | Verified / pushed before desktop work |
| Unit tests (`npm test`) | **16/16 pass** |
| TypeScript (`npm run typecheck`) | **pass** |
| Production build (`npm run build`) | Required for desktop launch / pack |
| `npm run desktop:smoke` | Standalone + FFmpeg resolve **ok** |
| Packaged `win-unpacked` Next | **HTTP 200** on `/projects` (ELECTRON_RUN_AS_NODE) |
| Electron GUI smoke | **Launch ok** — local server on `127.0.0.1` served `/projects` **200** |
| Real H.264/AAC export | Same `/api/export` + FFmpeg as browser when binaries resolve (manual export still required for certification) |
| Backup unit validation | `lib/backup.test.ts` pass |

### Manual device testing (not claimed complete)

Camera hardware, phone QR on a physical device, full backup of a large media library, and end-to-end installer install on a clean PC require human device runs. Do not treat automated smoke as device certification.

## Packaging notes

`npm run desktop:stage` copies standalone **including `node_modules`**, materializes `standalone/.next` when the project `.next` is an AppData junction (`ensure-next-cache.mjs`), flattens `server/chunks/*.js` beside `webpack-runtime.js`, and strips absolute build-machine paths. FFmpeg binaries under `resources/ffmpeg/` are optional extras (gitignored).

## Known limitations

- NSIS/portable compression with full Gyan FFmpeg (~200MB×2) can take hours; local test package is `release/win-unpacked/`
- Large `gfd-backup-v1` files load media into memory
- Live phone preview / 3D retarget / performance blending remain **Proposed**
- Default Electron icon until branded icons are added under `desktop/build`
- No public installer distribution, auto-update, or GitHub Release without further approval

## Acceptance checkpoint

A working local Windows desktop build that opens GFD without manually starting a development server, with native dialogs, backup/restore, and FFmpeg export when binaries are available. Wider installation awaits explicit approval.
