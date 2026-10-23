export type ContinuityScene = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  characterIds: string[];
  description: string;
  location: string;
  timeOfDay: string;
  dialogue: string;
  action: string;
  camera: string;
  movement: string;
  music: string;
  duration: string;
  approvedFingerprint: string;
};

export type ContinuityShot = {
  id: string;
  projectId: string;
  label: string;
  sceneId: string;
};

export type ContinuityTake = {
  id: string;
  projectId: string;
  name: string;
  characterId: string;
  sceneId: string;
  mediaId: string;
};

export type ContinuityClip = {
  id: string;
  projectId: string;
  name: string;
  track: string;
  mediaId: string;
  takeId: string;
  sceneId: string;
  shotId: string;
  startMs: number;
  inMs: number;
  outMs: number;
};

export type ContinuityWarning = {
  id: string;
  kind:
    | "missing-character"
    | "take-character"
    | "take-scene"
    | "take-cast"
    | "shot-scene"
    | "approved-modified"
    | "missing-media"
    | "clip-media"
    | "clip-take"
    | "unapproved-scene"
    | "audio-overrun"
    | "export-unsupported";
  message: string;
  sceneId: string;
  shotId: string;
  takeId: string;
  characterId: string;
  clipId: string;
};

export function sceneFingerprint(scene: Pick<ContinuityScene, "title" | "description" | "location" | "timeOfDay" | "characterIds" | "dialogue" | "action" | "camera" | "movement" | "music" | "duration">) {
  return [
    scene.title,
    scene.description,
    scene.location,
    scene.timeOfDay,
    [...scene.characterIds].sort().join(","),
    scene.dialogue,
    scene.action,
    scene.camera,
    scene.movement,
    scene.music,
    scene.duration,
  ].join("\u001f");
}

const AUDIO_TRACKS = new Set(["dialogue", "voice", "music", "sfx"]);

export function continuityWarnings(input: {
  projectId: string;
  projectTitle?: string;
  characters: { id: string; name: string }[];
  scenes: ContinuityScene[];
  shots: ContinuityShot[];
  takes: ContinuityTake[];
  mediaIds: Set<string>;
  mediaReady: boolean;
  clips?: ContinuityClip[];
}): ContinuityWarning[] {
  const names = new Map(input.characters.map((character) => [character.id, character.name]));
  const scenes = new Map(input.scenes.filter((scene) => scene.projectId === input.projectId).map((scene) => [scene.id, scene]));
  const takes = new Map(input.takes.filter((take) => take.projectId === input.projectId).map((take) => [take.id, take]));
  const project = input.projectTitle || "This project";
  const warnings: ContinuityWarning[] = [];
  const blank = { sceneId: "", shotId: "", takeId: "", characterId: "", clipId: "" };

  for (const scene of scenes.values()) {
    for (const characterId of scene.characterIds) {
      if (!names.has(characterId)) {
        warnings.push({
          ...blank,
          id: `scene-character-${scene.id}-${characterId}`,
          kind: "missing-character",
          message: `${project}: ${scene.title} lists a character that is no longer in this project.`,
          sceneId: scene.id,
          characterId,
        });
      }
    }
    if (scene.status === "Approved" && scene.approvedFingerprint && scene.approvedFingerprint !== sceneFingerprint(scene)) {
      warnings.push({
        ...blank,
        id: `approved-${scene.id}`,
        kind: "approved-modified",
        message: `${project}: ${scene.title} was approved, then edited. Approval was left as you set it.`,
        sceneId: scene.id,
      });
    }
  }

  for (const shot of input.shots.filter((shot) => shot.projectId === input.projectId)) {
    if (!shot.sceneId || !scenes.has(shot.sceneId)) {
      warnings.push({
        ...blank,
        id: `shot-${shot.id}`,
        kind: "shot-scene",
        message: `${project}: ${shot.label} is not assigned to a scene in this project.`,
        shotId: shot.id,
      });
    }
  }

  for (const take of input.takes.filter((take) => take.projectId === input.projectId)) {
    if (!names.has(take.characterId)) {
      warnings.push({
        ...blank,
        id: `take-character-${take.id}`,
        kind: "take-character",
        message: `${project}: ${take.name} points at a character that is not in this project.`,
        sceneId: take.sceneId,
        takeId: take.id,
        characterId: take.characterId,
      });
    }
    if (take.sceneId && !scenes.has(take.sceneId)) {
      warnings.push({
        ...blank,
        id: `take-scene-${take.id}`,
        kind: "take-scene",
        message: `${project}: ${take.name} points at a scene that is not in this project.`,
        takeId: take.id,
        characterId: take.characterId,
      });
    }
    const scene = take.sceneId ? scenes.get(take.sceneId) : undefined;
    if (scene && scene.characterIds.length > 0 && names.has(take.characterId) && !scene.characterIds.includes(take.characterId)) {
      const name = names.get(take.characterId) ?? "This character";
      warnings.push({
        ...blank,
        id: `take-cast-${take.id}`,
        kind: "take-cast",
        message: `${project}: ${take.name} belongs to ${name}, who is not listed in ${scene.title}.`,
        sceneId: scene.id,
        takeId: take.id,
        characterId: take.characterId,
      });
    }
    if (input.mediaReady && take.mediaId && !input.mediaIds.has(take.mediaId)) {
      warnings.push({
        ...blank,
        id: `media-${take.id}`,
        kind: "missing-media",
        message: `${project}: ${take.name} has no recording file on this device.`,
        sceneId: take.sceneId,
        takeId: take.id,
        characterId: take.characterId,
      });
    }
  }

  const clips = (input.clips ?? []).filter((clip) => clip.projectId === input.projectId);
  const pictureEnd = clips.filter((clip) => clip.track === "video").reduce((max, clip) => Math.max(max, clip.startMs + Math.max(0, clip.outMs - clip.inMs)), 0);
  const flaggedScenes = new Set<string>();
  if (clips.length > 0 && !clips.some((clip) => clip.track === "video")) {
    warnings.push({
      ...blank,
      id: `export-${input.projectId}`,
      kind: "export-unsupported",
      message: `${project}: the timeline has no video clips, so an MP4 export is not available.`,
    });
  }
  for (const clip of clips) {
    const scene = clip.sceneId ? scenes.get(clip.sceneId) : undefined;
    if (input.mediaReady && clip.mediaId && !input.mediaIds.has(clip.mediaId)) {
      warnings.push({
        ...blank,
        id: `clip-media-${clip.id}`,
        kind: "clip-media",
        message: `${project}: timeline clip “${clip.name}” is missing its media file.`,
        sceneId: clip.sceneId,
        shotId: clip.shotId,
        takeId: clip.takeId,
        clipId: clip.id,
      });
    }
    if (clip.takeId && !takes.has(clip.takeId)) {
      warnings.push({
        ...blank,
        id: `clip-take-${clip.id}`,
        kind: "clip-take",
        message: `${project}: “${clip.name}” points at a take that was deleted.`,
        sceneId: clip.sceneId,
        shotId: clip.shotId,
        takeId: clip.takeId,
        clipId: clip.id,
      });
    }
    if (scene && scene.status !== "Approved" && !flaggedScenes.has(scene.id)) {
      flaggedScenes.add(scene.id);
      warnings.push({
        ...blank,
        id: `unapproved-${scene.id}`,
        kind: "unapproved-scene",
        message: `${project}: ${scene.title} is in the timeline and is not approved.`,
        sceneId: scene.id,
        shotId: clip.shotId,
        clipId: clip.id,
      });
    }
    const clipEnd = clip.startMs + Math.max(0, clip.outMs - clip.inMs);
    if (AUDIO_TRACKS.has(clip.track) && pictureEnd > 0 && clipEnd > pictureEnd + 250) {
      warnings.push({
        ...blank,
        id: `overrun-${clip.id}`,
        kind: "audio-overrun",
        message: `${project}: “${clip.name}” continues past the video timeline.`,
        sceneId: clip.sceneId,
        shotId: clip.shotId,
        takeId: clip.takeId,
        clipId: clip.id,
      });
    }
  }

  return warnings;
}
