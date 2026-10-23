/**
 * Only tools this build actually uses or can honestly report.
 * No marketplace stubs for Runway, ElevenLabs, Blender bridges, APG, GCIE, etc.
 */

export type ConnectorKind = "Local";

export type ConnectorRecord = {
  id: string;
  name: string;
  detail: string;
  kind: ConnectorKind;
  permissions: string[];
  /** Where this capability is used in the app. */
  usedBy: string;
  /** How status is determined. */
  probe: "ffmpeg" | "browser" | "storage" | "timeline";
};

export type ConnectorProbeResult = {
  id: string;
  detected: boolean;
  connected: boolean;
  detail: string;
};

export const CONNECTORS: ConnectorRecord[] = [
  {
    id: "ffmpeg",
    name: "FFmpeg",
    detail: "Local H.264 / AAC encode for Export",
    kind: "Local",
    permissions: ["Read timeline media", "Write MP4 on this computer"],
    usedBy: "/export",
    probe: "ffmpeg",
  },
  {
    id: "browser-av",
    name: "Browser camera & microphone",
    detail: "Device capture in this browser tab",
    kind: "Local",
    permissions: ["Camera", "Microphone"],
    usedBy: "/capture",
    probe: "browser",
  },
  {
    id: "local-storage",
    name: "This-device storage",
    detail: "Projects in localStorage · media blobs in IndexedDB",
    kind: "Local",
    permissions: ["Read/write project JSON", "Read/write media files"],
    usedBy: "All screens",
    probe: "storage",
  },
  {
    id: "timeline",
    name: "Shared film timeline",
    detail: "Edit and Audio share one clip list on this device",
    kind: "Local",
    permissions: ["Read/write clips", "Playback"],
    usedBy: "/edit · /audio · /export",
    probe: "timeline",
  },
];
