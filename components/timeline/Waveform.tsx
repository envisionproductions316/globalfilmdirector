"use client";

import { useEffect, useRef } from "react";
import { getMedia } from "@/lib/media-db";

const peakCache = new Map<string, number[]>();

export function Waveform({ mediaId }: { mediaId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const pen: CanvasRenderingContext2D = context;
    const width = canvas.width;
    const height = canvas.height;

    function draw(peaks: number[]) {
      pen.clearRect(0, 0, width, height);
      pen.fillStyle = "#f1f6ff";
      peaks.forEach((peak, index) => {
        const bar = Math.max(1, peak * height);
        pen.fillRect(index * 4, (height - bar) / 2, 2, bar);
      });
    }

    const cached = peakCache.get(mediaId);
    if (cached) {
      draw(cached);
      return;
    }

    void (async () => {
      const record = await getMedia(mediaId);
      if (!record || cancelled) return;
      const audio = new AudioContext();
      try {
        const decoded = await audio.decodeAudioData(await record.blob.arrayBuffer());
        const channel = decoded.getChannelData(0);
        const peaks = Array.from({ length: 48 }, (_, index) => {
          const start = Math.floor((index / 48) * channel.length);
          const end = Math.floor(((index + 1) / 48) * channel.length);
          let max = 0;
          for (let sample = start; sample < end; sample += 16) max = Math.max(max, Math.abs(channel[sample] || 0));
          return max;
        });
        peakCache.set(mediaId, peaks);
        if (!cancelled) draw(peaks);
      } finally {
        await audio.close();
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  return <canvas ref={ref} width={192} height={32} className="mt-2 rounded bg-inset" data-testid="waveform" />;
}
