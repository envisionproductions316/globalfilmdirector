import { poseStatus } from "@/lib/pose-tracker";

export type TrackingStatus = {
  installed: boolean;
  retarget: false;
  rendered: false;
  detail: string;
};

export function trackingStatus(): TrackingStatus {
  const pose = poseStatus();
  return {
    installed: pose.ready,
    retarget: false,
    rendered: false,
    detail: pose.ready
      ? "Pose landmarks available. Face/hand landmarkers are not wired. Motion retargeting is not applied."
      : pose.detail || "Pose model is not loaded yet. Face and hand landmarkers are not wired.",
  };
}
