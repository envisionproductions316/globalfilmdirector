"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type SessionInfo = {
  code: string;
  characterName: string;
  expiresAt: number;
};

function MobileCaptureInner() {
  const params = useSearchParams();
  const code = (params.get("s") || params.get("code") || "").toUpperCase();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"boot" | "ready" | "recording" | "uploading" | "done">("boot");
  const [message, setMessage] = useState("Connecting session…");
  const [elapsed, setElapsed] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    if (!code) {
      setError("Open this page from the QR or link on Capture.");
      setPhase("boot");
      return;
    }
    let cancelled = false;
    void fetch(`/api/capture/session?code=${encodeURIComponent(code)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Session not found or expired.");
        const body = (await response.json()) as { session: SessionInfo };
        if (cancelled) return;
        setSession(body.session);
        setPhase("ready");
        setMessage(`Portray ${body.session.characterName}. Start camera, act, then send the take.`);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open session.");
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [code]);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  async function startCamera(withMic = micOn) {
    setError("");
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" } },
        audio: withMic,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setMicOn(withMic);
      setCameraOn(true);
      setMessage(withMic ? "Camera live with microphone. Record, then send." : "Camera live. Record your action, then send to desktop.");
    } catch {
      setCameraOn(false);
      setError("Camera permission was denied or unavailable.");
    }
  }

  function beginRecording() {
    const stream = streamRef.current;
    if (!stream) {
      setError("Start the camera first.");
      return;
    }
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      void uploadTake(new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" }));
    };
    startedAt.current = Date.now();
    setElapsed(0);
    setPhase("recording");
    recorder.start(250);
    setMessage("Recording… stop when the action is done.");
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function uploadTake(blob: Blob) {
    if (!session) return;
    setPhase("uploading");
    setMessage("Sending take to desktop…");
    const form = new FormData();
    form.set("code", session.code);
    form.set("file", blob, "phone-take.webm");
    form.set("durationMs", String(Date.now() - startedAt.current));
    form.set("hasAudio", String(micOn));
    form.set("hasVideo", "true");
    form.set("name", `${session.characterName} phone take`);
    form.set("notes", "Recorded on phone capture session");
    try {
      const response = await fetch("/api/capture/session", { method: "PUT", body: form });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Upload failed");
      }
      setPhase("done");
      setMessage("Take sent. Keep this tab open until desktop imports it, or record another.");
    } catch (err) {
      setPhase("ready");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  const minutes = String(Math.floor(elapsed / 60000)).padStart(2, "0");
  const seconds = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-canvas px-4 py-5 text-ink">
      <header>
        <p className="m-0 text-xs font-bold tracking-wide text-muted">GLOBAL FILM DIRECTOR</p>
        <h1 className="m-0 mt-1 text-2xl font-bold">Mobile Camera Capture</h1>
        <p className="mt-2 text-sm text-muted">Phone action portraying · same Wi‑Fi as the studio desktop</p>
      </header>

      {error ? <p className="m-0 rounded-[9px] bg-inset px-3 py-3 text-sm text-muted">{error}</p> : null}
      {session ? (
        <p className="m-0 text-sm">
          Session <span className="font-bold">{session.code}</span> · {session.characterName}
        </p>
      ) : null}

      <div className="relative overflow-hidden rounded-[12px] bg-card">
        <video ref={videoRef} className="aspect-[9/16] w-full bg-black object-cover" playsInline muted autoPlay />
        {phase === "recording" ? (
          <p className="absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-xs font-bold text-white">
            REC {minutes}:{seconds}
          </p>
        ) : null}
      </div>

      <p className="m-0 text-sm text-muted">{message}</p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={micOn}
          disabled={phase === "recording" || phase === "uploading"}
          onChange={(event) => {
            const next = event.target.checked;
            setMicOn(next);
            if (cameraOn && phase !== "recording") {
              setMessage(next ? "Restarting camera with microphone…" : "Restarting camera without microphone…");
              void startCamera(next);
            }
          }}
        />
        Include microphone {cameraOn ? "(restarts camera)" : ""}
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="h-11 flex-1 rounded-[9px] bg-inset px-3 text-sm font-bold"
          disabled={phase === "recording" || phase === "uploading"}
          onClick={() => void startCamera()}
        >
          Start camera
        </button>
        {phase === "recording" ? (
          <button type="button" className="h-11 flex-1 rounded-[9px] bg-accent px-3 text-sm font-bold text-on-accent" onClick={stopRecording}>
            Stop & send
          </button>
        ) : (
          <button
            type="button"
            className="h-11 flex-1 rounded-[9px] bg-accent px-3 text-sm font-bold text-on-accent disabled:opacity-50"
            disabled={phase === "boot" || phase === "uploading" || !cameraOn}
            onClick={beginRecording}
          >
            Record action
          </button>
        )}
      </div>
      {phase === "done" ? (
        <button
          type="button"
          className="h-11 rounded-[9px] bg-inset px-3 text-sm font-bold"
          onClick={() => {
            setPhase("ready");
            setMessage("Ready for another take.");
          }}
        >
          Record another
        </button>
      ) : null}
    </div>
  );
}

export default function MobileCapturePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted">Loading phone capture…</p>}>
      <MobileCaptureInner />
    </Suspense>
  );
}
