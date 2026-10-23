"use client";

import { useEffect, useRef, useState } from "react";
import { getMedia } from "@/lib/media-db";

export function TakePlayer({ mediaId, caption }: { mediaId: string; caption: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let url = "";
    let cancelled = false;
    setMissing(false);
    void getMedia(mediaId)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setMissing(true);
          return;
        }
        url = URL.createObjectURL(record.blob);
        if (videoRef.current) videoRef.current.src = url;
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaId]);

  return (
    <div>
      <video ref={videoRef} className="max-h-72 w-full rounded-[9px] bg-[#34436d]" controls playsInline />
      <p className="mt-2 text-sm text-muted">{missing ? "The recording file is missing from this device." : caption}</p>
    </div>
  );
}
