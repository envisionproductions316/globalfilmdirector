# Machine tools (this Windows PC)

Local applications installed for Global Film Director work. **Installed on the PC ≠ wired into the studio UI.** Only FFmpeg (export), browser camera/mic, this-device storage, and the shared timeline are used by the app today. See Connectors → Local studio tools.

## Installed and verified

| Tool | Version / location | On PATH | Used by GFD |
|------|--------------------|---------|-------------|
| FFmpeg | 8.1.1 (winget `Gyan.FFmpeg`) | Yes | Yes — `/export` encode |
| Blender | 5.2.3 LTS (`C:\Program Files\Blender Foundation\Blender 5.2\`) | Yes (`blender`) | No — not a Connect worker yet |
| Kdenlive | 26.08.2 (`%LOCALAPPDATA%\Programs\Kdenlive\bin\`) | Yes (user PATH) | No — external NLE |
| OpenToonz | 1.8.0 (`C:\Program Files\OpenToonz\OpenToonz.exe`) | Yes (`opentoonz`) | No — external 2D |
| openai-whisper | pip package `20250625` (`python -m whisper` / `whisper`) | Yes | No — not called from the app |
| Rhubarb Lip Sync | 1.14.0 (`%LOCALAPPDATA%\gfd-tools\rhubarb\Rhubarb-Lip-Sync-1.14.0-Windows\`) | Yes (user PATH) | No — AI lip-sync UI stays unavailable until integrated |

## Not installed here

| Tool | Why |
|------|-----|
| ComfyUI | Large git + model download; install only when wiring a local image worker |
| Runway / ElevenLabs / APG / GCIE | Cloud APIs — need clients + keys, not winget packages. No fake Connect cards. |

## Director LLM (optional)

Copy `.env.example` → `.env.local` and set `OPENAI_API_KEY` or `DIRECTOR_API_KEY` (+ optional `DIRECTOR_BASE_URL`, `DIRECTOR_MODEL`). Without a key, Director uses local Studio Director apply (plan + creature seeds).

## Phone capture

On Capture, **Start phone session** shows a QR/link to `/mobile-capture?s=CODE`. The link prefers `window.location.origin` from the desktop, or `CAPTURE_PUBLIC_ORIGIN` (e.g. `http://192.168.x.x:5180`). Phone and desktop must reach the same Next server (use `HOST=0.0.0.0` for LAN). Takes upload to the server memory store and are imported for the **session character** — not a live wireless viewfinder.

## Pose / Live Sync

`@mediapipe/tasks-vision` loads the lite pose model in the browser. Overlay landmarks are real when the model loads. Live Sync drives a 2D silhouette only — still not mesh retargeting.

## Smoke checks (PowerShell)

```powershell
ffmpeg -version
blender -b --version
kdenlive --version
opentoonz  # launches GUI; or Test-Path 'C:\Program Files\OpenToonz\OpenToonz.exe'
python -c "import whisper; print('whisper ok')"
rhubarb --version
```

New terminals pick up the user PATH update for Kdenlive and Rhubarb. Already-open shells may need a restart.
