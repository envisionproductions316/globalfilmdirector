"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PerformanceEditor } from "@/components/characters/PerformanceEditor";
import { Waveform } from "@/components/timeline/Waveform";
import { trackingStatus } from "@/lib/tracking";
import { useStudio } from "@/lib/studio";
import { formatTimecode } from "@/lib/timeline";

const OPTION_COLORS = ["#66517a", "#395f84", "#58766d", "#825a64", "#405d84"];
const buttonClass = "h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent disabled:opacity-50";
const quietClass = "h-9 rounded-[7px] bg-inset px-3 text-[13px] text-ink disabled:opacity-50";

type Phase = "idle" | "live" | "recording" | "preview";

const STEPS = [
  { id: 1, title: "Connect Camera", detail: "Use your phone or webcam" },
  { id: 2, title: "Choose a Character", detail: "Select who you want to be" },
  { id: 3, title: "Perform", detail: "Move, speak, and act" },
  { id: 4, title: "Refine & Edit", detail: "Adjust, retake, or enhance" },
  { id: 5, title: "Add to Scene", detail: "Place in timeline and continue" },
] as const;

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
  const [showPoseGuide, setShowPoseGuide] = useState(false);
  const tracking = trackingStatus();
  const character = studio.selectedCharacter;
  const prefs = studio.capturePrefs;
  const scene = studio.scenes.find((item) => item.id === sceneId) ?? studio.selectedScene;
  const characterTakeId = studio.takes.find((take) => take.id === studio.selectedTakeId && take.characterId === character?.id)?.id
    || studio.takes.find((take) => take.characterId === character?.id)?.id
    || "";

  useEffect(() => {
    setSceneId(studio.selectedSceneId);
  }, [studio.selectedSceneId]);

  useEffect(() => {
    setShotId(studio.selectedShotId);
  }, [studio.selectedShotId]);

  const activeStep = !character ? 2 : phase === "idle" ? 1 : phase === "live" || phase === "recording" ? 3 : phase === "preview" ? 4 : 5;

  const sceneCharacters = useMemo(() => {
    const ids = scene?.characterIds?.length ? scene.characterIds : studio.characters.map((item) => item.id);
    return ids.map((id) => studio.characters.find((item) => item.id === id)).filter(Boolean);
  }, [scene, studio.characters]);

  const sceneTakes = useMemo(
    () => studio.takes.filter((take) => (sceneId ? take.sceneId === sceneId : true)).slice(0, 12),
    [studio.takes, sceneId],
  );

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
    const result = await studio.saveTake({
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
    setMessage(result.error || `Saved for ${character.name}. Raw recording only. Tracking and retargeting were not applied.`);
    if (!result.error) {
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

  async function saveAndPlace() {
    if (!character || !preview) {
      if (characterTakeId) {
        const placed = studio.placeTake(characterTakeId);
        setMessage(placed || "Take placed on the shared timeline.");
      } else {
        setMessage(character ? "Record and save a take for this character before placing it." : "Select a character before placing a take.");
      }
      return;
    }
    setSaving(true);
    const result = await studio.saveTake({
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
    if (result.error) {
      setMessage(result.error);
      return;
    }
    const placed = studio.placeTake(result.takeId);
    setMessage(placed || "Saved and placed on the shared timeline. No retargeting ran.");
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

  useEffect(() => {
    if (!studio.captureAction) return;
    const action = studio.captureAction;
    studio.clearCaptureAction();
    if (action === "retake") retake();
    if (action === "add-to-timeline") void saveAndPlace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.captureAction]);

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-bold lg:text-[26px]">04 · Character Mirror Capture</h1>
          <p className="mt-1 text-sm text-muted">Record a performance for a character, then place the raw take on the shared timeline.</p>
        </div>
        <p className="m-0 text-xs text-muted lg:hidden">{message}</p>
      </div>

      <ol className="mt-4 grid list-none gap-2 p-0 sm:grid-cols-5">
        {STEPS.map((step) => (
          <li
            key={step.id}
            className={`rounded-[9px] px-3 py-2 ${activeStep === step.id ? "bg-active text-ink" : "bg-inset text-muted"}`}
          >
            <span className="block text-[11px] font-bold">{step.id}. {step.title}</span>
            <span className="mt-1 block text-[11px] opacity-80">{step.detail}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <article className="rounded-[10px] bg-card px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-base font-bold">Camera Input</h2>
            {phase === "recording" ? <span className="rounded bg-[#c23b3b] px-2 py-0.5 text-[11px] font-bold text-white">REC {formatDuration(elapsed)}</span> : null}
          </div>
          <div className="relative mt-3 grid min-h-[220px] place-items-center overflow-hidden rounded-[9px] bg-[#30455f]">
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" autoPlay playsInline muted={phase !== "preview"} data-testid="capture-video" />
            {showPoseGuide ? (
              <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 100 100" aria-hidden>
                <circle cx="50" cy="22" r="6" fill="none" stroke="#7dffb0" strokeWidth="1.5" />
                <path d="M50 28 V55 M50 36 L35 48 M50 36 L65 48 M50 55 L38 78 M50 55 L62 78" fill="none" stroke="#7dffb0" strokeWidth="1.5" />
              </svg>
            ) : null}
            {phase === "idle" ? <p className="relative px-4 text-center text-sm text-[#f1f6ff]">{message}</p> : null}
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
              <select className="mt-1 h-9 w-full rounded-md bg-inset px-2 text-sm text-ink" value={micId} disabled={phase === "recording"} onChange={(event) => setMicId(event.target.value)}>
                <option value="">Default microphone</option>
                {mics.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>
                ))}
              </select>
            </label>
            <p className="m-0 self-end text-sm">{micOn ? "Microphone on" : "Microphone off"} · {phase === "preview" ? `Preview ${formatDuration(preview?.durationMs ?? elapsed)}` : phase}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={phase === "recording"} onClick={() => void startCamera()} data-testid="start-camera">Start camera</button>
            {micOn ? (
              <button type="button" className={quietClass} disabled={phase === "recording"} onClick={disableMicrophone}>Mic off</button>
            ) : (
              <button type="button" className={quietClass} disabled={phase === "recording"} onClick={() => void enableMicrophone()}>Mic on</button>
            )}
            <button type="button" className={quietClass} onClick={() => setShowPoseGuide((open) => !open)}>{showPoseGuide ? "Hide pose guide" : "Show pose guide"}</button>
            <button type="button" className={quietClass} disabled title="Calibration needs MediaPipe, which is not installed">Calibrate</button>
            {phase === "recording" ? (
              <button type="button" className={buttonClass} onClick={stopRecording} data-testid="stop-record">Stop</button>
            ) : (
              <button type="button" className={buttonClass} disabled={phase === "idle" || phase === "preview"} onClick={beginRecording} data-testid="record-take">Record</button>
            )}
          </div>
          <aside className="mt-4 rounded-[9px] bg-inset px-3 py-3">
            <h3 className="m-0 text-sm font-bold">Phone as wireless camera</h3>
            <p className="mt-2 text-xs text-muted">Not connected. Wi‑Fi and USB remote capture are not available in this build. Use the browser camera on this device.</p>
            <ul className="mt-2 list-none space-y-1 p-0 text-xs text-muted">
              <li>Real-time preview — local webcam only</li>
              <li>Full body tracking — not installed</li>
              <li>Face and hand capture — not installed</li>
              <li>Remote control — not connected</li>
            </ul>
          </aside>
        </article>

        <article className="rounded-[10px] bg-card px-4 py-4">
          <h2 className="m-0 text-base font-bold">Choose a Character</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {studio.characters.map((item, index) => (
              <button
                key={item.id}
                type="button"
                data-testid={`pick-character-${item.id}`}
                className={`min-h-[88px] rounded-[9px] p-3 text-left text-sm font-bold text-[#f1f6ff] ${item.id === character?.id ? "outline outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
                style={{ background: item.color || OPTION_COLORS[index % OPTION_COLORS.length] }}
                onClick={() => studio.selectCharacter(item.id)}
              >
                {item.name}
                <span className="mt-1 block text-[11px] font-normal opacity-80">{item.look} · {item.animationStyle}</span>
              </button>
            ))}
            <Link href="/characters" className="grid min-h-[88px] place-items-center rounded-[9px] border border-dashed border-[var(--line)] bg-inset text-sm font-bold text-muted">
              + Create New Character
            </Link>
          </div>
          {studio.characters.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Create a character before recording.{" "}
              <Link href="/characters" className="text-accent" onClick={() => studio.setAssetCategory("characters")}>
                Open Characters
              </Link>
            </p>
          ) : null}
          <label className="mt-4 block text-xs text-muted">
            Take name
            <input className="mt-1 h-9 w-full rounded-md bg-inset px-2 text-sm text-ink" value={takeName} onChange={(event) => setTakeName(event.target.value)} placeholder={character ? `${character.name} take` : "Take"} />
          </label>
          <label className="mt-3 block text-xs text-muted">
            Dialogue notes
            <textarea className="mt-1 min-h-16 w-full rounded-md bg-inset px-2 py-2 text-sm text-ink" value={dialogue} onChange={(event) => setDialogue(event.target.value)} />
          </label>
        </article>

        <article className="rounded-[10px] bg-card px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-base font-bold">Live Character Preview</h2>
            <button type="button" className={quietClass} disabled title="Live Sync needs motion retargeting">Live Sync · Off</button>
          </div>
          <div className="mt-3 grid min-h-[200px] place-items-end rounded-[9px] p-4 text-[#f1f6ff]" style={{ background: character?.color || "#374a77" }} data-testid="character-preview">
            <div>
              <p className="m-0 text-lg font-bold">{character ? character.name : "No character"}</p>
              <p className="m-0 mt-1 text-xs opacity-80">Static passport. Not mirroring your pose.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-inset px-2 py-1 text-muted">Facial Tracking · Not installed</span>
            <span className="rounded-md bg-inset px-2 py-1 text-muted">Voice · {micOn ? "Mic recording" : "Off"}</span>
            <span className="rounded-md bg-inset px-2 py-1 text-muted">Mirrored Movement · Not available</span>
          </div>
          <ul className="mt-3 list-none space-y-2 p-0 text-sm">
            <li>Raw recording: {preview ? "Ready to save" : phase === "recording" ? "Capturing" : "None in this take"}</li>
            <li>Tracking data: {tracking.detail}</li>
            <li>Motion retargeting: Not available.</li>
            <li>Rendered character animation: Not created.</li>
          </ul>
          <label className="mt-3 block text-xs text-muted">
            Performance notes
            <textarea className="mt-1 min-h-16 w-full rounded-md bg-inset px-2 py-2 text-sm text-ink" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="mt-4 rounded-[9px] bg-inset px-3 py-3">
            <h3 className="m-0 text-sm font-bold">Performance blending</h3>
            <label className="mt-2 block text-xs text-muted">
              My Capture {prefs.captureBlend}% · AI Animation {100 - prefs.captureBlend}%
              <input
                className="mt-1 w-full"
                type="range"
                min={0}
                max={100}
                value={prefs.captureBlend}
                onChange={(event) => studio.setCapturePrefs({ captureBlend: Number(event.target.value) })}
              />
            </label>
            <p className="mt-2 text-xs text-muted">AI enhancement is not connected. The slider is stored as a preference only.</p>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={prefs.keepFacialExpressions} onChange={(event) => studio.setCapturePrefs({ keepFacialExpressions: event.target.checked })} />
              Keep my facial expressions (preference only)
            </label>
          </div>
        </article>
      </div>

      <article className="mt-4 rounded-[10px] bg-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-base font-bold">Multiple Characters in This Scene</h2>
          <select
            className="h-9 rounded-md bg-inset px-2 text-sm"
            value={sceneId}
            onChange={(event) => {
              const nextScene = event.target.value;
              setSceneId(nextScene);
              if (nextScene) studio.selectScene(nextScene);
              const linked = studio.shots.find((shot) => shot.sceneId === nextScene);
              if (linked) {
                setShotId(linked.id);
                studio.selectShot(linked.id);
              } else {
                setShotId("");
              }
            }}
          >
            <option value="">Unassigned scene</option>
            {studio.scenes.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
        </div>
        <ul className="mt-3 flex list-none gap-3 overflow-x-auto p-0">
          {sceneCharacters.map((item) => {
            if (!item) return null;
            const takes = studio.takes.filter((take) => take.characterId === item.id && (!sceneId || take.sceneId === sceneId));
            const latest = takes[0];
            return (
              <li key={item.id} className="min-w-[140px] rounded-[9px] bg-inset px-3 py-3">
                <button type="button" className="font-bold" onClick={() => studio.selectCharacter(item.id)}>{item.name}</button>
                <p className="mt-1 text-xs text-muted">{takes.length} take{takes.length === 1 ? "" : "s"}</p>
                {latest?.mediaId ? (
                  <div className="mt-2 h-8 overflow-hidden rounded bg-card/60">
                    <Waveform mediaId={latest.mediaId} compact />
                  </div>
                ) : (
                  <div className="mt-2 h-8 rounded bg-card/60" aria-hidden />
                )}
              </li>
            );
          })}
          {sceneCharacters.length === 0 ? <li className="text-sm text-muted">No characters on this scene yet.</li> : null}
        </ul>
      </article>

      <article className="mt-4 rounded-[10px] bg-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-base font-bold">Scene performance strip</h2>
          <div className="flex flex-wrap gap-2">
            <label className="text-xs text-muted">
              Shot
              <select
                className="ml-2 h-9 rounded-md bg-inset px-2 text-sm text-ink"
                value={shotId}
                onChange={(event) => {
                  setShotId(event.target.value);
                  if (event.target.value) studio.selectShot(event.target.value);
                }}
              >
                <option value="">Unassigned</option>
                {studio.shots
                  .filter((shot) => !sceneId || shot.sceneId === sceneId)
                  .map((shot) => (
                    <option key={shot.id} value={shot.id}>{shot.label}</option>
                  ))}
              </select>
            </label>
            <button type="button" className={quietClass} disabled={!preview} onClick={retake} data-testid="retake">Retake</button>
            <button type="button" className={buttonClass} disabled={!preview || !character || saving} onClick={() => void saveTake()} data-testid="save-take">{saving ? "Saving" : "Save take"}</button>
            <button type="button" className={buttonClass} disabled={saving || (!preview && !characterTakeId)} onClick={() => void saveAndPlace()} data-testid="add-to-timeline">Add to Timeline</button>
            <Link
              href="/edit"
              className={`${studio.clips.length ? buttonClass : quietClass} inline-flex items-center`}
              data-testid="continue-edit"
              onClick={() => studio.setAssetCategory("media")}
            >
              {studio.clips.length ? `Continue to Edit (${studio.clips.length})` : "Open in Edit"}
            </Link>
            {studio.clips.length > 0 ? (
              <Link href="/export" className={`${quietClass} inline-flex items-center`}>
                Export
              </Link>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-sm text-muted" data-testid="capture-message">{message}</p>
        <div className="mt-3 space-y-2 overflow-x-auto">
          {["Video (Camera)", ...sceneCharacters.map((item) => item?.name || "Character"), "Dialogue / Vocals", "Music", "Sound Effects", "Captions"].map((label) => (
            <div key={label} className="flex min-w-[640px] items-center gap-3">
              <span className="w-36 shrink-0 text-xs text-muted">{label}</span>
              <div className="flex h-8 flex-1 gap-1 rounded bg-inset px-1 py-1">
                {label.startsWith("Video") || sceneCharacters.some((item) => item?.name === label)
                  ? sceneTakes
                      .filter((take) => label.startsWith("Video") || take.characterId === studio.characters.find((item) => item.name === label)?.id)
                      .map((take) => (
                        <button
                          key={take.id}
                          type="button"
                          className="h-full min-w-[72px] rounded-sm px-2 text-left text-[10px] text-[#f1f6ff]"
                          style={{ background: studio.characters.find((item) => item.id === take.characterId)?.color || "#3478f6" }}
                          onClick={() => studio.selectTake(take.id)}
                        >
                          {take.name || "Take"} · {formatTimecode(take.durationMs)}
                        </button>
                      ))
                  : studio.clips
                      .filter((clip) => {
                        if (label.startsWith("Dialogue") && clip.track === "dialogue") return !sceneId || clip.sceneId === sceneId;
                        if (label === "Music" && clip.track === "music") return !sceneId || clip.sceneId === sceneId;
                        if (label.startsWith("Sound") && clip.track === "sfx") return !sceneId || clip.sceneId === sceneId;
                        if (label === "Captions" && clip.track === "captions") return !sceneId || clip.sceneId === sceneId;
                        return false;
                      })
                      .map((clip) => (
                        <span key={clip.id} className="inline-flex h-full min-w-[72px] items-center rounded-sm bg-[#4386b1] px-2 text-[10px] text-[#f1f6ff]">
                          {clip.text || clip.name}
                        </span>
                      ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">This strip lists takes and shared-timeline clips for the scene. It is not a second renderer. Edit and Audio own multitrack timing.</p>
      </article>

      {character && studio.takes.some((take) => take.characterId === character.id) ? (
        <article className="mt-4 rounded-[10px] bg-card px-4 py-4">
          <h2 className="m-0 text-base font-bold">Refine & Edit · {character.name}</h2>
          <p className="mt-2 text-sm text-muted">Review saved takes for this character. Retargeting and AI enhancement are not connected.</p>
          <div className="mt-3">
            <PerformanceEditor />
          </div>
        </article>
      ) : null}
    </section>
  );
}
