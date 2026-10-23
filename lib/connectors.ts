import { CONNECTORS, type ConnectorProbeResult } from "@/lib/connectors-catalog";
import { probeFfmpeg } from "@/lib/export-jobs";

export type { ConnectorProbeResult } from "@/lib/connectors-catalog";
export { CONNECTORS } from "@/lib/connectors-catalog";

/** Server probe for tools this app really uses. */
export async function probeConnectors(): Promise<ConnectorProbeResult[]> {
  const ffmpeg = await probeFfmpeg();
  return CONNECTORS.map((connector) => {
    if (connector.id === "ffmpeg") {
      const connected = Boolean(ffmpeg.available && ffmpeg.h264 && ffmpeg.aac);
      return {
        id: connector.id,
        detected: Boolean(ffmpeg.available),
        connected,
        detail: ffmpeg.available
          ? connected
            ? `Ready · ${ffmpeg.version || "FFmpeg"} (H.264 + AAC). Export can encode on this computer.`
            : `Found ${ffmpeg.version || "FFmpeg"} but H.264/AAC is incomplete for Export.`
          : "Not on PATH. Install FFmpeg + ffprobe, then reopen Export.",
      };
    }
    if (connector.id === "browser-av") {
      return {
        id: connector.id,
        detected: true,
        connected: true,
        detail: "Uses getUserMedia in this browser. Permissions are requested on Capture when you start the camera.",
      };
    }
    if (connector.id === "local-storage") {
      return {
        id: connector.id,
        detected: true,
        connected: true,
        detail: "Studio state key gfd.studio.v1 and IndexedDB gfd-media. Nothing is synced to a cloud account.",
      };
    }
    return {
      id: connector.id,
      detected: true,
      connected: true,
      detail: "Clips, mix, and playhead live in this browser project. Export reads the same timeline.",
    };
  });
}
