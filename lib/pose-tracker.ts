"use client";

export type PoseStatus = {
  ready: boolean;
  detail: string;
};

export type PosePoint = { x: number; y: number; visibility?: number };

type PoseLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { landmarks?: Array<Array<{ x: number; y: number; visibility?: number }>> };
  close?: () => void;
};

let landmarker: PoseLandmarkerLike | null = null;
let loadPromise: Promise<PoseStatus> | null = null;
let lastStatus: PoseStatus = {
  ready: false,
  detail: "MediaPipe pose model is not loaded yet.",
};

const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [0, 11],
  [0, 12],
];

export function poseStatus(): PoseStatus {
  return lastStatus;
}

export async function ensurePoseTracker(): Promise<PoseStatus> {
  if (typeof window === "undefined") {
    lastStatus = { ready: false, detail: "Pose tracking runs in the browser only." };
    return lastStatus;
  }
  if (landmarker) {
    lastStatus = { ready: true, detail: "MediaPipe pose landmarks ready." };
    return lastStatus;
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm",
      );
      const modelAssetPath =
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
      try {
        landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      } catch {
        landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      }
      lastStatus = { ready: true, detail: "MediaPipe pose landmarks ready." };
      return lastStatus;
    } catch (error) {
      landmarker = null;
      lastStatus = {
        ready: false,
        detail: error instanceof Error ? `Pose model failed: ${error.message}` : "Pose model failed to load.",
      };
      return lastStatus;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export function detectPose(video: HTMLVideoElement, timestampMs: number): PosePoint[] | null {
  if (!landmarker || video.readyState < 2) return null;
  try {
    const result = landmarker.detectForVideo(video, timestampMs);
    const first = result.landmarks?.[0];
    if (!first?.length) return null;
    return first.map((point) => ({ x: point.x, y: point.y, visibility: point.visibility }));
  } catch {
    return null;
  }
}

export function drawPoseOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  points: PosePoint[] | null,
  color = "#7dd3fc",
) {
  const width = video.clientWidth || video.videoWidth || canvas.width;
  const height = video.clientHeight || video.videoHeight || canvas.height;
  if (!width || !height) return;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  if (!points?.length) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  for (const [a, b] of POSE_CONNECTIONS) {
    const pa = points[a];
    const pb = points[b];
    if (!pa || !pb) continue;
    if ((pa.visibility ?? 1) < 0.4 || (pb.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * width, pa.y * height);
    ctx.lineTo(pb.x * width, pb.y * height);
    ctx.stroke();
  }
  for (const point of points) {
    if ((point.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function silhouettePath(points: PosePoint[], width: number, height: number): string {
  const idxs = [11, 13, 15, 23, 25, 27, 28, 26, 24, 16, 14, 12];
  const parts: string[] = [];
  idxs.forEach((index, order) => {
    const point = points[index];
    if (!point) return;
    const x = point.x * width;
    const y = point.y * height;
    parts.push(`${order === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  });
  return parts.length ? `${parts.join(" ")} Z` : "";
}
