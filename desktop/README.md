# Electron shell — Global Film Director

Main process: `main.mjs`  
Preload bridge: `preload.cjs`  
FFmpeg resolve: `ffmpeg-path.mjs`

See [`docs/DESKTOP.md`](../docs/DESKTOP.md) for architecture, security, packaging, and limitations.

## Quick start (Windows)

```bash
npm run build
npm run desktop
```

Or after packing:

```text
release\win-unpacked\Global Film Director.exe
```

Do not distribute a public installer without further approval.
