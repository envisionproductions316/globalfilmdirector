/** Capabilities this build actually ships. */
export const INTEGRATIONS = [
  { id: "ffmpeg", name: "FFmpeg", purpose: "Local MP4 export encode", connected: true },
  { id: "browser-av", name: "Browser camera & microphone", purpose: "Capture takes in this tab", connected: true },
  { id: "local-storage", name: "This-device storage", purpose: "localStorage + IndexedDB media", connected: true },
  { id: "timeline", name: "Shared film timeline", purpose: "Edit / Audio / Export", connected: true },
] as const;
