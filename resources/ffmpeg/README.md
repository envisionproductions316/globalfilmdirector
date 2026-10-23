# Bundled FFmpeg (optional)

Place `ffmpeg.exe` / `ffprobe.exe` (Windows) or `ffmpeg` / `ffprobe` (macOS/Linux) in this folder for packaged desktop builds.

These binaries are **not** committed to Git. Desktop resolves:

1. `GFD_FFMPEG_PATH` / `GFD_FFPROBE_PATH`
2. `resources/ffmpeg/` (this folder, or Electron `extraResources`)
3. System PATH

Copy from a trusted FFmpeg full build (e.g. Gyan builds on Windows) when preparing a local test installer.
