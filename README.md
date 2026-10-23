# Global Film Director

Local film studio for projects, direction, characters, capture, storyboard, edit, audio, and export. Media and project state stay on the device. Cloud AI / retargeting connectors are listed but not connected.

Design source: [Figma file](https://www.figma.com/design/ybDQ62Q6oBo1W8HkDJyJV4) · Repo: [envisionproductions316/globalfilmdirector](https://github.com/envisionproductions316/globalfilmdirector)

## Requirements

- **Node.js 20+**
- **FFmpeg + ffprobe on PATH** (needed to export MP4). Without them the app still runs; Export will say encoding is unavailable.
- Modern Chromium-based browser with camera/microphone permission for Capture

## Install and run (usage)

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5180**

Default bind is localhost only. To expose on a LAN:

```bash
# Windows PowerShell
$env:HOST="0.0.0.0"; npm run dev

# macOS / Linux
HOST=0.0.0.0 npm run dev
```

Port defaults to `5180`. Override with `PORT=…`.

### Typical workflow

1. **Projects** — create a production  
2. **Characters** — add cast  
3. **Capture** — record a raw take (not retargeted animation)  
4. **Add to Timeline** — places the take on the shared Edit/Audio timeline  
5. **Edit / Audio** — trim, mix, import media or captions  
6. **Export** — encode a local H.264/AAC MP4 when FFmpeg is available  

## Production build (deployment on this machine)

```bash
npm run build
npm start
```

`npm start` runs the **standalone** Node server (required for Export and Docker). Then open http://127.0.0.1:5180

LAN / bind-all example:

```bash
# Windows PowerShell
$env:HOST="0.0.0.0"; npm start

# macOS / Linux
HOST=0.0.0.0 npm start
```

### One-shot readiness gate

```bash
npm run ready
```

Runs typecheck, unit tests, production build, and a Node/FFmpeg/build check (`npm run check`).

### Useful scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests |
| `npm run check` | Verify build + FFmpeg for usage |

## Docker (self-host)

Export needs a **Node server with FFmpeg**. This is not a static site and is not meant for serverless hosts that cannot spawn `ffmpeg`.

```bash
docker build -t global-film-director .
docker run --rm -p 5180:5180 global-film-director
```

Open http://127.0.0.1:5180

## What is intentionally not connected

APG, GCIE, Envision Cloud, MediaPipe tracking, motion retargeting, Live Sync, wireless phone camera, Blender/ComfyUI workers. UI labels those as unavailable.

## Agent / design notes

See `AGENTS.md` and `figma-manifest.json` for shell layout and Figma frame IDs.
