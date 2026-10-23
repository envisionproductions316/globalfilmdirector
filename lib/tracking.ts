export type TrackingStatus = {
  installed: false;
  retarget: false;
  rendered: false;
  detail: string;
};

export function trackingStatus(): TrackingStatus {
  return {
    installed: false,
    retarget: false,
    rendered: false,
    detail: "MediaPipe is not installed. Face, pose, and hand landmarks are not extracted. The raw recording is kept for later processing.",
  };
}
