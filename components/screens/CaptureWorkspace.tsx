"use client";

import { useEffect, useRef, useState } from "react";
import { Pipeline } from "@/components/ui/Pipeline";
import { INTEGRATIONS } from "@/lib/integrations";
import { trackingStatus } from "@/lib/tracking";
import { useStudio } from "@/lib/studio";

const OPTION_COLORS = ["#66517a", "#395f84", "#58766d", "#825a64"];
const buttonClass = "h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent disabled:opacity-50";

type Phase = "idle" | "live" | "recording" | "preview";

function deviceError(error: unknown, kind: "camera" | "microphone") {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return `${kind === "camera" ? "Camera" : "Microphone"} permission was not granted.`;
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return kind === "camera" ? "No camera was found." : "No microphone was found.";
  if (name === "NotReadableError" || name === "TrackStartError") return `The ${kind} is busy or unavailable.`;
  if (name === "AbortError") return `The ${kind} request was interrupted.`;
  if (name === "NotSupportedError" || name === "SecurityError") return `This browser cannot use the ${kind} on this page.`;
  if (name === "OverconstrainedError") return `That ${kind} is not available. Choose another device.`;
  return `The ${kind} could not be started.`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function CaptureWorkspace() {
  const studio = useStudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("Camera and microphone are off until you start them.");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [micOn, setMicOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{ blob: Blob; url: string; mime: string; durationMs: number } | null>(null);
  const [takeName, setTakeName] = useState("");
  const [dialogue, setDialogue] = useState("");
  const [notes, setNotes] = useState("");
  const [sceneId, setSceneId] = useState(studio.selectedSceneId);
  const [shotId, setShotId] = useState(studio.selectedShotId);
  const [saving, setSaving] = useState(false);
  const tracking = trackingStatus();
  const character = studio.selectedCharacter;

  useEffect(() => {
    return () => {
      recorderRef.current?.state === "recording" && recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    function interrupted() {
      if (recorderRef.current?.state === "recording") {
        setMessage("Recording was interrupted. The partial take is ready to preview.");
        recorderRef.current.stop();
      }
    }
    window.addEventListener("pagehide", interrupted);
    return () => window.removeEventListener("pagehide", interrupted);
  }, []);

  function attachLive(stream: MediaStream) {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.src = "";
    video.muted = true;
    video.controls = false;
    void video.play().catch(() => undefined);
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setMicOn(false);
  }

  async function listDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    setCameras(devices.filter((device) => device.kind === "videoinput"));
    setMics(devices.filter((device) => device.kind === "audioinput"));
  }

  async function startCamera(nextCameraId = cameraId, nextFacing = facing) {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("This browser cannot record camera video.");
      return;
    }
    if (phase === "recording") return;
    try {
      const video = nextCameraId ? { deviceId: { exact: nextCameraId } } : { facingMode: nextFacing };
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      stopStream();
      streamRef.current = stream;
      attachLive(stream);
      setPhase("live");
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return null;
      });
      setMessage("Camera is live. Motion is not being retargeted.");
      await listDevices();
    } catch (error) {
      setMessage(deviceError(error, "camera"));
      setPhase("idle");
    }
  }

  async function enableMicrophone(nextMicId = micId) {
    if (!streamRef.current || phase === "recording") {
      setMessage("Start the camera before the microphone.");
      return;
    }
    try {
      const audio = nextMicId ? { deviceId: { exact: nextMicId } } : true;
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
      streamRef.current.getAudioTracks().forEach((track) => track.stop());
      const mixed = new MediaStream([...streamRef.current.getVideoTracks(), ...audioStream.getAudioTracks()]);
      streamRef.current = mixed;
      attachLive(mixed);
      setMicOn(true);
      setMessage("Microphone is on. The recording will include voice. No speech service is connected.");
      await listDevices();
    } catch (error) {
      setMessage(deviceError(error, "microphone"));
    }
  }

  function disableMicrophone() {
    if (phase === "recording") return;
    streamRef.current?.getAudioTracks().forEach((track) => track.stop());
    if (streamRef.current) {
      const videoOnly = new MediaStream(streamRef.current.getVideoTracks());
      streamRef.current = videoOnly;
      attachLive(videoOnly);
    }
    setMicOn(false);
    setMessage("Microphone is off.");
  }

  function beginRecording() {
    const stream = streamRef.current;
    if (!stream || !character) {
      setMessage(character ? "Start the camera before recording." : "Select a character before recording.");
      return;
    }
    chunksRef.current = [];
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      setMessage("Recording could not start with this camera.");
      return;
    }
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => setMessage("Recording was interrupted. Any captured media is in the preview.");
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        const url = URL.createObjectURL(blob);
        const video = videoRef.current;
        if (video) {
          video.srcObject = null;
          video.src = url;
          video.muted = false;
          video.controls = true;
        }
        return { blob, url, mime: blob.type, durationMs: Date.now() - startedAt.current };
      });
      setPhase("preview");
      setElapsed(Date.now() - startedAt.current);
      setMessage("Preview ready. Save the take or retake. This recording is not character animation.");
    };
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (recorder.state === "recording") {
          setMessage("A camera or microphone track ended. The partial recording is ready to preview.");
          recorder.stop();
        }
      };
    });
    startedAt.current = Date.now();
    setElapsed(0);
    recorder.start(250);
    recorderRef.current = recorder;
    setPhase("recording");
    setMessage(`Recording ${character.name}. This stores the camera image${micOn ? " and voice" : ""}. It does not animate the character.`);
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  function retake() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    if (streamRef.current) {
      attachLive(streamRef.current);
      setPhase("live");
      setMessage("Preview discarded. The camera is still live.");
    } else {
      setPhase("idle");
      setMessage("Preview discarded. Start the camera to record again.");
    }
  }

  async function saveTake() {
    if (!character || !preview) return;
    setSaving(true);
    const error = await studio.saveTake({
      characterId: character.id,
      sceneId,
      shotId,
      name: takeName,
      notes,
      dialogue,
      durationMs: preview.durationMs,
      blob: preview.blob,
      mime: preview.mime,
      hasAudio: micOn,
      hasVideo: true,
      cameraLabel: cameras.find((device) => device.deviceId === cameraId)?.label || (facing === "environment" ? "Rear camera" : "Front camera"),
      microphoneLabel: micOn ? mics.find((device) => device.deviceId === micId)?.label || "Microphone" : "No microphone",
    });
    setSaving(false);
    setMessage(error || `Saved for ${character.name}. Raw recording only. Tracking and retargeting were not applied.`);
    if (!error) {
      setTakeName("");
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return null;
      });
      if (streamRef.current) {
        attachLive(streamRef.current);
        setPhase("live");
      }
    }
  }

  const step = !character ? "Select character" : phase === "idle" ? "Start camera" : phase === "live" ? "Record" : phase === "recording" ? "Stop" : sceneId ? "Saved take" : "Assign to scene";

  return (
    <section>
      <h1 className="m-0 text-[26px] font-bold lg:hidden">10 · Mobile Camera Capture</h1>
      <p className="mt-2 text-[15px] text-muted lg:hidden">Select a character, record, preview, and save the take on this phone.</p>
      <h1 className="m-0 hidden text-[26px] font-bold lg:block">04 · Character Mirror Capture</h1>
      <p className="mt-2 hidden text-[15px] text-muted lg:block">Select character, start camera, record, preview, save the take, then assign it to a scene.</p>
      <ol className="mt-4 flex list-none flex-wrap gap-2 p-0 text-xs text-muted">
        {["Select character", "Start camera", "Record", "Preview", "Save take", "Assign to scene"].map((item) => (
          <li key={item} className={`rounded-md px-2 py-1 ${item === step ? "bg-active text-ink" : "bg-inset"}`}>{item}</li>
        ))}
      </ol>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <article className="rounded-[10px] bg-card px-4 py-4">
          <h2 className="m-0 text-base font-bold">Your Camera Performance</h2>
          <div className="relative mt-3 grid min-h-[220px] place-items-center overflow-hidden rounded-[9px] bg-[#30455f]">
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" autoPlay playsInline muted />
            {phase === "idle" ? <p className="relative px-4 text-center text-[#f1f6ff]">{message}</p> : null}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Camera
              <select
                className="mt-1 h-9 w-full rounded-md bg-inset px-2 text-sm text-ink"
                value={cameraId}
                disabled={phase === "recording"}
                onChange={(event) => {
                  setCameraId(event.target.value);
                  if (phase === "live" || phase === "preview") void startCamera(event.target.value, facing);
                }}
              >
                <option value="">Default camera</option>
                {cameras.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Facing
              <select
                className="mt-1 h-9 w-full rounded-md bg-inset px-2 text-sm text-ink"
                value={facing}
                disabled={phase === "recording" || Boolean(cameraId)}
                onChange={(event) => {
                  const next = event.target.value === "environment" ? "environment" : "user";
                  setFacing(next);
                  if (!cameraId && (phase === "live" || phase === "preview")) void startCamera("", next);
                }}
              >
                <option value="user">Front</option>
                <option value="environment">Rear</option>
              </select>
            </label>
            <label className="text-xs text-muted">
              Microphone
              <select
                className="mt-1 h-9 w-full rounded-md bg-inset px-2 text-sm text-ink"
                value={micId}
                disabled={phase === "recording"}
                onChange={(event) => setMicId(event.target.value)}
              >
                <option value="">Default microphone</option>
                {mics.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>
                ))}
              </select>
            </label>
            <p className="m-0 self-end text-sm">{phase === "recording" ? `Recording ${formatDuration(elapsed)}` : phase === "preview" ? `Preview ${formatDuration(preview?.durationMs ?? elapsed)}` : micOn ? "Microphone on" : "Microphone off"}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={phase === "recording"} onClick={() => void startCamera()}>Start camera</button>
            {micOn ? (
              <button type="button" className={buttonClass} disabled={phase === "recording"} onClick={disableMicrophone}>Stop microphone</button>
            ) : (
              <button type="button" className={buttonClass} disabled={phase === "recording"} onClick={() => void enableMicrophone()}>Use microphone</button>
            )}
            {phase === "recording" ? (
              <button type="button" className={buttonClass} onClick={stopRecording}>Stop</button>
            ) : (
              <button type="button" className={buttonClass} disabled={phase === "idle" || phase === "preview"} onClick={beginRecording}>Record</button>
            )}
            <button type="button" className={buttonClass} disabled={!preview} onClick={retake}>Retake</button>
            <button type="button" className={buttonClass} disabled={!preview || !character || saving} onClick={() => void saveTake()}>{saving ? "Saving" : "Save take"}</button>
          </div>
          <p className="mt-3 text-sm text-muted">{message}</p>
          <p className="mt-2 text-xs text-muted">Recordings on this device: {formatBytes(studio.storageBytes)}. Video stays in browser storage, not in the project notes.</p>
        </article>
        <article className="rounded-[10px] bg-card px-4 py-4">
          <h2 className="m-0 text-base font-bold">Choose a Character</h2>
          <label className="mt-3 block text-xs text-muted lg:hidden">
            Character
            <select className="mt-1 h-9 w-full rounded-md bg-inset px-2 text-sm text-ink" value={character?.id ?? ""} onChange={(event) => studio.selectCharacter(event.target.value)}>
              {studio.characters.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <div className="mt-3 hidden grid-cols-2 gap-3 lg:grid">
            {studio.characters.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`min-h-[96px] rounded-[9px] p-3 text-left font-bold text-[#f1f6ff] ${item.id === character?.id ? "outline-2 outline-offset-2 outline-ink" : ""}`}
                style={{ background: item.color || OPTION_COLORS[index % OPTION_COLORS.length] }}
                onClick={() => studio.selectCharacter(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          {studio.characters.length === 0 ? <p className="mt-3 text-sm text-muted">Create a character before recording.</p> : null}
          <label className="mt-3 block text-xs text-muted">
            Take name
            <input className="mt-1 h-9 w-full rounded-md bg-inset px-2 text-sm text-ink" value={takeName} onChange={(event) => setTakeName(event.target.value)} placeholder={character ? `${character.name} take` : "Take"} />
          </label>
          <label className="mt-3 block text-xs text-muted">
            Assign to scene
            <select className="mt-1 h-9 w-full rounded-md bg-inset px-2 text-sm text-ink" value={sceneId} onChange={(event) => setSceneId(event.target.value)}>
              <option value="">Unassigned</option>
              {studio.scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>{scene.title}</option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs text-muted">
            Assign to shot
            <select className="mt-1 h-9 w-full rounded-md bg-inset px-2 text-sm text-ink" value={shotId} onChange={(event) => setShotId(event.target.value)}>
              <option value="">Unassigned</option>
              {studio.shots.map((shot) => (
                <option key={shot.id} value={shot.id}>{shot.label}</option>
              ))}
            </select>
          </label>
        </article>
        <article className="rounded-[10px] bg-card px-4 py-4">
          <h2 className="m-0 text-base font-bold">Live Character Preview</h2>
          <div className="mt-3 grid min-h-[180px] place-items-end rounded-[9px] p-4 text-[#f1f6ff]" style={{ background: character?.color || "#374a77" }}>
            {character ? character.name : "No character"}
          </div>
          <ul className="mt-3 list-none space-y-2 p-0 text-sm">
            <li>Raw recording: {preview ? "Ready to save" : phase === "recording" ? "Capturing" : "None in this take"}</li>
            <li>Tracking data: {tracking.detail}</li>
            <li>Motion retargeting: Not available.</li>
            <li>Rendered character animation: Not created.</li>
          </ul>
          <label className="mt-3 block text-xs text-muted">
            Dialogue notes
            <textarea className="mt-1 min-h-16 w-full rounded-md bg-inset px-2 py-2 text-sm text-ink" value={dialogue} onChange={(event) => setDialogue(event.target.value)} />
          </label>
          <label className="mt-3 block text-xs text-muted">
            Performance notes
            <textarea className="mt-1 min-h-16 w-full rounded-md bg-inset px-2 py-2 text-sm text-ink" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </article>
      </div>
      <article className="mt-4 rounded-[10px] bg-card px-4 py-4">
        <h2 className="m-0 text-base font-bold">Services</h2>
        <ul className="mt-3 list-none space-y-2 p-0 text-sm">
          {INTEGRATIONS.map((service) => (
            <li key={service.id}>{service.name}: not connected. {service.purpose}.</li>
          ))}
        </ul>
      </article>
      <Pipeline />
    </section>
  );
}
