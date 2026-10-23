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

export type ContinuityWarning = {
  id: string;
  kind: "missing-character" | "take-character" | "take-scene" | "take-cast" | "shot-scene" | "approved-modified" | "missing-media";
  message: string;
  sceneId: string;
  shotId: string;
  takeId: string;
  characterId: string;
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

export function continuityWarnings(input: {
  projectId: string;
  characters: { id: string; name: string }[];
  scenes: ContinuityScene[];
  shots: ContinuityShot[];
  takes: ContinuityTake[];
  mediaIds: Set<string>;
  mediaReady: boolean;
}): ContinuityWarning[] {
  const names = new Map(input.characters.map((character) => [character.id, character.name]));
  const scenes = new Map(input.scenes.filter((scene) => scene.projectId === input.projectId).map((scene) => [scene.id, scene]));
  const warnings: ContinuityWarning[] = [];

  for (const scene of scenes.values()) {
    for (const characterId of scene.characterIds) {
      if (!names.has(characterId)) {
        warnings.push({
          id: `scene-character-${scene.id}-${characterId}`,
          kind: "missing-character",
          message: `${scene.title} lists a character that is no longer in this project.`,
          sceneId: scene.id,
          shotId: "",
          takeId: "",
          characterId,
        });
      }
    }
    if (scene.status === "Approved" && scene.approvedFingerprint && scene.approvedFingerprint !== sceneFingerprint(scene)) {
      warnings.push({
        id: `approved-${scene.id}`,
        kind: "approved-modified",
        message: `${scene.title} was approved, then edited. Approval was left as you set it.`,
        sceneId: scene.id,
        shotId: "",
        takeId: "",
        characterId: "",
      });
    }
  }

  for (const shot of input.shots.filter((shot) => shot.projectId === input.projectId)) {
    if (!shot.sceneId || !scenes.has(shot.sceneId)) {
      warnings.push({
        id: `shot-${shot.id}`,
        kind: "shot-scene",
        message: `${shot.label} is not assigned to a scene in this project.`,
        sceneId: "",
        shotId: shot.id,
        takeId: "",
        characterId: "",
      });
    }
  }

  for (const take of input.takes.filter((take) => take.projectId === input.projectId)) {
    if (!names.has(take.characterId)) {
      warnings.push({
        id: `take-character-${take.id}`,
        kind: "take-character",
        message: `${take.name} points at a character that is not in this project.`,
        sceneId: take.sceneId,
        shotId: "",
        takeId: take.id,
        characterId: take.characterId,
      });
    }
    if (take.sceneId && !scenes.has(take.sceneId)) {
      warnings.push({
        id: `take-scene-${take.id}`,
        kind: "take-scene",
        message: `${take.name} points at a scene that is not in this project.`,
        sceneId: "",
        shotId: "",
        takeId: take.id,
        characterId: take.characterId,
      });
    }
    const scene = take.sceneId ? scenes.get(take.sceneId) : undefined;
    if (scene && scene.characterIds.length > 0 && names.has(take.characterId) && !scene.characterIds.includes(take.characterId)) {
      const name = names.get(take.characterId) ?? "This character";
      warnings.push({
        id: `take-cast-${take.id}`,
        kind: "take-cast",
        message: `${take.name} belongs to ${name}, who is not listed in ${scene.title}.`,
        sceneId: scene.id,
        shotId: "",
        takeId: take.id,
        characterId: take.characterId,
      });
    }
    if (input.mediaReady && take.mediaId && !input.mediaIds.has(take.mediaId)) {
      warnings.push({
        id: `media-${take.id}`,
        kind: "missing-media",
        message: `${take.name} has no recording file on this device.`,
        sceneId: take.sceneId,
        shotId: "",
        takeId: take.id,
        characterId: take.characterId,
      });
    }
  }

  return warnings;
}
