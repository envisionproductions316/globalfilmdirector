"use client";

import { useEffect, useRef, useState } from "react";
import { Pipeline } from "@/components/ui/Pipeline";
import { Timeline } from "@/components/ui/Timeline";
import { useStudio } from "@/lib/studio";

const OPTION_COLORS = ["#66517a", "#395f84", "#58766d", "#825a64"];

export function CaptureWorkspace() {
  const studio = useStudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraMessage, setCameraMessage] = useState("Camera / pose tracking");
  const [cameraLive, setCameraLive] = useState(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("This browser has no camera API.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraLive(true);
      setCameraMessage("Camera is live. Motion is not being retargeted.");
    } catch {
      setCameraMessage("Camera permission was not granted.");
    }
  }

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold">04 · Character Mirror Capture</h1>
      <p className="mt-2 text-[15px] text-muted">Camera performance and live character imitation</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="rounded-[10px] bg-card px-4 py-4">
          <h2 className="m-0 text-base font-bold">Your Camera Performance</h2>
          <div className="relative mt-3 grid min-h-[220px] place-items-center overflow-hidden rounded-[9px] bg-[#30455f]">
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" autoPlay playsInline muted />
            {cameraLive ? null : <p className="relative px-4 text-center text-[#f1f6ff]">{cameraMessage}</p>}
          </div>
          <button type="button" className="mt-3 h-9 rounded-[7px] bg-accent px-4 text-[13px] font-bold text-on-accent" onClick={startCamera}>
            Start camera
          </button>
          {cameraLive ? <p className="mt-2 text-sm text-muted">{cameraMessage}</p> : null}
        </article>
        <article className="rounded-[10px] bg-card px-4 py-4">
          <h2 className="m-0 text-base font-bold">Choose a Character</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {studio.characters.slice(0, 4).map((character, index) => (
              <button
                key={character.id}
                type="button"
                className={`min-h-[112px] rounded-[9px] p-3 text-left font-bold text-[#f1f6ff] ${
                  character.id === studio.selectedCharacterId ? "outline-2 outline-offset-2 outline-ink" : ""
                }`}
                style={{ background: OPTION_COLORS[index] }}
                onClick={() => studio.selectCharacter(character.id)}
              >
                {character.name}
              </button>
            ))}
          </div>
        </article>
        <article className="rounded-[10px] bg-card px-4 py-4">
          <h2 className="m-0 text-base font-bold">Live Character Preview</h2>
          <div className="mt-3 grid min-h-[220px] place-items-end rounded-[9px] bg-[#374a77] p-4 text-[#f1f6ff]">
            Preview only. The character does not mirror the camera.
          </div>
        </article>
      </div>
      <Timeline
        tracks={[
          { name: "Camera", color: "#3478f6" },
          { name: "Max performance", color: "#23b7a5" },
          { name: "Bella performance", color: "#7258b0" },
          { name: "Dialogue", color: "#9b7741" },
          { name: "Music", color: "#4386b1" },
        ]}
      />
      <Pipeline />
    </section>
  );
}
