"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { continuityWarnings, sceneFingerprint } from "@/lib/continuity";
import { deleteMedia, listMedia, putMedia, storageError } from "@/lib/media-db";
import {
  clipsForSource,
  completeAsset,
  completeClip,
  completeMix,
  defaultMix,
  fitGroupToPicture,
  moveGroup,
  nudgeGroup,
  resolveTrack,
  splitGroup,
  trimGroup,
  type AssetRecord,
  type TimelineClip,
  type TrackId,
  type TrackMix,
} from "@/lib/timeline";
import type { CaptionCue } from "@/lib/captions";

export type ThemeName = "night" | "day";
export type StudioMode = "director" | "studio";
export type AssetCategory = "media" | "characters" | "locations" | "scenes" | "music" | "sfx" | "styles" | "assets";
export type ProductionStatus = "Draft" | "In review" | "Approved";
export type AnimationStyle = "Unassigned" | "Realistic" | "Stylized" | "Limited" | "Graphic";
export type CapturePrefs = {
  tab: "face" | "body" | "voice" | "style";
  motionStrength: number;
  smoothing: number;
  exaggeration: number;
  captureBlend: number;
  keepFacialExpressions: boolean;
};
export type CaptureAction = "" | "retake" | "add-to-timeline";

export type PlanItem = {
  id: string;
  label: string;
  detail: string;
};

export type DirectorMessage = {
  id: string;
  role: "user" | "unavailable";
  text: string;
};

export type ProjectRecord = {
  id: string;
  title: string;
  kind: string;
  status: ProductionStatus;
  planApproved: boolean;
  directorNote: string;
  messages: DirectorMessage[];
  plan: PlanItem[];
};

export type CharacterRecord = {
  id: string;
  projectId: string;
  name: string;
  color: string;
  look: "2D" | "3D";
  voice: string;
  wardrobe: string;
  dna: string;
  appearance: string;
  animationStyle: AnimationStyle;
  sceneIds: string[];
};

export type Notice = {
  id: string;
  text: string;
};

export type ShotRecord = {
  id: string;
  projectId: string;
  sceneId: string;
  label: string;
  action: string;
  color: string;
  camera: string;
  movement: string;
  location: string;
};

export type SceneRecord = {
  id: string;
  projectId: string;
  number: number;
  title: string;
  description: string;
  status: "Approved" | "Needs review";
  stage: "Draft" | "Continuity review" | "Approved";
  color: string;
  passport: string;
  world: string;
  location: string;
  timeOfDay: string;
  characterIds: string[];
  dialogue: string;
  action: string;
  performance: string;
  voice: string;
  camera: string;
  movement: string;
  music: string;
  soundNotes: string;
  duration: string;
  rights: string;
  approvedFingerprint: string;
};

export type TakeRecord = {
  id: string;
  projectId: string;
  characterId: string;
  sceneId: string;
  shotId: string;
  name: string;
  notes: string;
  dialogue: string;
  durationMs: number;
  createdAt: string;
  approval: ProductionStatus;
  mediaId: string;
  mime: string;
  bytes: number;
  hasAudio: boolean;
  hasVideo: boolean;
  cameraLabel: string;
  microphoneLabel: string;
  tracking: "Raw recording only";
  retarget: "Not available";
};

export type TakeDraft = {
  characterId: string;
  sceneId: string;
  shotId: string;
  name: string;
  notes: string;
  dialogue: string;
  durationMs: number;
  blob: Blob;
  mime: string;
  hasAudio: boolean;
  hasVideo: boolean;
  cameraLabel: string;
  microphoneLabel: string;
};

export type JobRecord = {
  id: string;
  projectId: string;
  label: string;
  state: "Completed" | "Rendering" | "Waiting" | "Recorded locally";
  sample: boolean;
};

export type ConnectorRecord = {
  id: string;
  name: string;
  detail: string;
  kind: "Open Source" | "Local" | "Cloud";
  permissions: string[];
};

type StudioState = {
  schemaVersion: 3;
  theme: ThemeName;
  studioMode: StudioMode;
  assetCategory: AssetCategory;
  capturePrefs: CapturePrefs;
  captureAction: CaptureAction;
  projects: ProjectRecord[];
  activeProjectId: string;
  notices: Notice[];
  accountName: string;
  characters: CharacterRecord[];
  selectedCharacterId: string;
  editorOpen: boolean;
  shots: ShotRecord[];
  selectedShotId: string;
  scenes: SceneRecord[];
  selectedSceneId: string;
  takes: TakeRecord[];
  selectedTakeId: string;
  clips: TimelineClip[];
  assets: AssetRecord[];
  mixes: { projectId: string; tracks: TrackMix[] }[];
  timelineViews: { projectId: string; playheadMs: number; pixelsPerSecond: number }[];
  selectedClipId: string;
  selectedAudioTrack: string;
  jobs: JobRecord[];
  selectedConnectorId: string;
  connectorFilter: string;
};

export const DEFAULT_CAPTURE_PREFS: CapturePrefs = {
  tab: "body",
  motionStrength: 100,
  smoothing: 75,
  exaggeration: 120,
  captureBlend: 70,
  keepFacialExpressions: true,
};

export const ASSET_CATEGORIES: { id: AssetCategory; label: string; href: string }[] = [
  { id: "media", label: "Media Library", href: "/edit" },
  { id: "characters", label: "Characters", href: "/characters" },
  { id: "locations", label: "Locations", href: "/locations" },
  { id: "scenes", label: "Scenes", href: "/storyboard" },
  { id: "music", label: "Music", href: "/audio" },
  { id: "sfx", label: "Sound Effects", href: "/audio" },
  { id: "styles", label: "Visual Styles", href: "/characters" },
  { id: "assets", label: "My Assets", href: "/edit" },
];

type LegacyState = Partial<StudioState> & {
  status?: ProductionStatus;
  directorNote?: string;
  planApproved?: boolean;
};

const STORAGE_KEY = "gfd.studio.v1";
const PLAN_LABELS = ["Cast", "Storyboard", "Camera plan", "Music", "Editable scene timeline"];
const CHARACTER_COLORS = ["#324e78", "#714b65", "#3a6c73", "#685b8b", "#75624b", "#405d84"];
const ANIMATION_STYLES: AnimationStyle[] = ["Unassigned", "Realistic", "Stylized", "Limited", "Graphic"];

const SHOT_TEMPLATES: Omit<ShotRecord, "id" | "projectId" | "sceneId">[] = [
  { label: "Shot 1", action: "Camera / action", color: "#3e547a", camera: "Wide", movement: "", location: "Interior" },
  { label: "Shot 2", action: "Camera / action", color: "#625273", camera: "Medium", movement: "", location: "Interior" },
  { label: "Shot 3", action: "Camera / action", color: "#3a6672", camera: "Close", movement: "", location: "Exterior" },
  { label: "Shot 4", action: "Camera / action", color: "#3e547a", camera: "Tracking", movement: "Tracking", location: "Street" },
  { label: "Shot 5", action: "Camera / action", color: "#625273", camera: "Over shoulder", movement: "", location: "Interior" },
  { label: "Shot 6", action: "Camera / action", color: "#3a6672", camera: "Static", movement: "Static", location: "Exterior" },
];

export const CONNECTORS: ConnectorRecord[] = [
  { id: "blender", name: "Blender", detail: "3D animation • Local", kind: "Local", permissions: ["Read scene files", "Write local cache"] },
  { id: "comfyui", name: "ComfyUI", detail: "AI image/video workflows", kind: "Open Source", permissions: ["Read prompts", "Write local renders"] },
  { id: "ffmpeg", name: "FFmpeg", detail: "Video processing • Local", kind: "Local", permissions: ["Read media", "Write exports"] },
  { id: "kdenlive", name: "Kdenlive", detail: "Timeline editing", kind: "Open Source", permissions: ["Read timeline", "Write project file"] },
  { id: "opentoonz", name: "OpenToonz", detail: "2D animation", kind: "Open Source", permissions: ["Read drawings", "Write frames"] },
  { id: "rhubarb", name: "Rhubarb Lip Sync", detail: "Lip synchronization", kind: "Open Source", permissions: ["Read dialogue audio"] },
  { id: "whisper", name: "Whisper", detail: "Speech recognition", kind: "Open Source", permissions: ["Read dialogue audio"] },
  { id: "gcie", name: "GCIE", detail: "Voice & translation", kind: "Cloud", permissions: ["Read script", "Write captions"] },
  { id: "apg", name: "APG", detail: "AI provider routing", kind: "Cloud", permissions: ["Read prompts", "Route providers"] },
  { id: "envision", name: "Envision Cloud", detail: "Jobs & storage", kind: "Cloud", permissions: ["Read jobs", "Write storage"] },
];

export const DESTINATIONS = [
  { href: "/projects", label: "Projects", icon: "P" },
  { href: "/director", label: "Chat", icon: "C" },
  { href: "/characters", label: "Characters", icon: "A" },
  { href: "/locations", label: "Locations", icon: "L" },
  { href: "/capture", label: "Capture", icon: "V" },
  { href: "/storyboard", label: "Storyboard", icon: "S" },
  { href: "/edit", label: "Edit", icon: "E" },
  { href: "/audio", label: "Audio", icon: "M" },
  { href: "/export", label: "Export", icon: "X" },
] as const;

function defaultPlan(): PlanItem[] {
  return PLAN_LABELS.map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    detail: "",
  }));
}

const SCENE_TEMPLATES: Array<Partial<SceneRecord> & { title: string; status: SceneRecord["status"]; stage: SceneRecord["stage"]; color: string }> = [
  { title: "01 Opening • The city", status: "Approved", stage: "Approved", color: "#375377", passport: "Unassigned", world: "City", performance: "Unassigned", voice: "Unassigned", camera: "Wide", music: "Pending", rights: "Review" },
  { title: "02 Symphony enters", status: "Approved", stage: "Approved", color: "#62517d", passport: "Symphony", world: "Interior", performance: "Take 01", voice: "Linked", camera: "Medium", music: "Music intro 00:16", rights: "Review" },
  { title: "03 Mr. Mean responds", status: "Needs review", stage: "Continuity review", color: "#426c71", passport: "Mr. Mean", world: "Interior", performance: "Take 02", voice: "Linked", camera: "Close", music: "Pending", rights: "Review" },
  { title: "04 Mrs. Amara dances", status: "Needs review", stage: "Draft", color: "#375377", passport: "Mrs. Amara", world: "Concert venue", performance: "Dance 03", voice: "Linked", camera: "Medium tracking", music: "Chorus 00:42", rights: "Review" },
  { title: "05 Ensemble finale", status: "Needs review", stage: "Draft", color: "#62517d", passport: "Ensemble", world: "Concert venue", performance: "Group 01", voice: "Unassigned", camera: "Wide", music: "Pending", rights: "Review" },
];

function scenesFor(projectId: string): SceneRecord[] {
  return SCENE_TEMPLATES.map((template, index) =>
    completeScene(
      {
        ...template,
        id: `${projectId}-scene-${index + 1}`,
        projectId,
        number: index + 1,
        location: template.world,
        timeOfDay: "Unspecified",
      },
      projectId,
    ),
  );
}

function shotsFor(projectId: string): ShotRecord[] {
  return SHOT_TEMPLATES.map((template, index) => ({
    ...template,
    id: `${projectId}-shot-${index + 1}`,
    projectId,
    sceneId: `${projectId}-scene-${(index % 5) + 1}`,
  }));
}

function completeScene(scene: Partial<SceneRecord>, projectId: string): SceneRecord {
  const status = scene.status === "Approved" ? "Approved" : "Needs review";
  const stage = scene.stage === "Approved" || scene.stage === "Continuity review" || scene.stage === "Draft" ? scene.stage : "Draft";
  const next: SceneRecord = {
    id: scene.id || `${projectId}-scene`,
    projectId: scene.projectId || projectId,
    number: typeof scene.number === "number" ? scene.number : 1,
    title: scene.title || "Untitled scene",
    description: scene.description || "",
    status,
    stage,
    color: scene.color || "#375377",
    passport: scene.passport || "Unassigned",
    world: scene.world || scene.location || "Unassigned",
    location: scene.location || scene.world || "Unassigned",
    timeOfDay: scene.timeOfDay || "Unspecified",
    characterIds: Array.isArray(scene.characterIds) ? scene.characterIds.filter((id) => typeof id === "string") : [],
    dialogue: scene.dialogue || "",
    action: scene.action || "",
    performance: scene.performance || "Unassigned",
    voice: scene.voice || "Unassigned",
    camera: scene.camera || "Wide",
    movement: scene.movement || "",
    music: scene.music || "Pending",
    soundNotes: scene.soundNotes || "",
    duration: scene.duration || "",
    rights: scene.rights || "Review",
    approvedFingerprint: scene.approvedFingerprint || "",
  };
  if (next.status === "Approved" && !next.approvedFingerprint) next.approvedFingerprint = sceneFingerprint(next);
  return next;
}

function completeShot(shot: Partial<ShotRecord>, projectId: string, fallbackSceneId: string): ShotRecord {
  return {
    id: shot.id || `${projectId}-shot`,
    projectId: shot.projectId || projectId,
    sceneId: typeof shot.sceneId === "string" ? shot.sceneId : fallbackSceneId,
    label: shot.label || "Shot",
    action: shot.action || "",
    color: shot.color || "#3e547a",
    camera: shot.camera || "Wide",
    movement: shot.movement || "",
    location: shot.location || "",
  };
}

function completeTake(take: Partial<TakeRecord>, projectId: string): TakeRecord | null {
  if (!take.id || !take.characterId || !take.mediaId) return null;
  return {
    id: take.id,
    projectId: take.projectId || projectId,
    characterId: take.characterId,
    sceneId: take.sceneId || "",
    shotId: take.shotId || "",
    name: take.name || "Take",
    notes: take.notes || "",
    dialogue: take.dialogue || "",
    durationMs: typeof take.durationMs === "number" ? take.durationMs : 0,
    createdAt: take.createdAt || "",
    approval: take.approval === "Approved" || take.approval === "In review" ? take.approval : "Draft",
    mediaId: take.mediaId,
    mime: take.mime || "video/webm",
    bytes: typeof take.bytes === "number" ? take.bytes : 0,
    hasAudio: Boolean(take.hasAudio),
    hasVideo: take.hasVideo !== false,
    cameraLabel: take.cameraLabel || "Camera",
    microphoneLabel: take.microphoneLabel || "No microphone",
    tracking: "Raw recording only",
    retarget: "Not available",
  };
}

function sampleJobs(projectId: string): JobRecord[] {
  return [
    { id: `${projectId}-job-1`, projectId, label: "Scene 01", state: "Completed", sample: true },
    { id: `${projectId}-job-2`, projectId, label: "Scene 02", state: "Completed", sample: true },
    { id: `${projectId}-job-3`, projectId, label: "Scene 03", state: "Rendering", sample: true },
    { id: `${projectId}-job-4`, projectId, label: "Audio mix", state: "Waiting", sample: true },
  ];
}

function blankProject(id: string, title: string, kind: string, directorNote = ""): ProjectRecord {
  return {
    id,
    title,
    kind,
    status: "Draft",
    planApproved: false,
    directorNote,
    messages: [],
    plan: defaultPlan(),
  };
}

/** Short project title from a free-form prompt; full text stays in directorNote. */
export function projectTitleFromPrompt(description: string) {
  const cleaned = description.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  const firstSentence = (cleaned.split(/[.!?]/)[0] || cleaned).trim() || cleaned;
  if (firstSentence.length <= 72) return firstSentence;
  return `${firstSentence.slice(0, 69).trimEnd()}…`;
}

const STARTER_CHARACTERS: CharacterRecord[] = [
  { id: "max", projectId: "p1", name: "Max", color: "#324e78", look: "3D", voice: "Unassigned", wardrobe: "Street", dna: "", appearance: "", animationStyle: "Unassigned", sceneIds: [] },
  { id: "bella", projectId: "p1", name: "Bella", color: "#714b65", look: "3D", voice: "Unassigned", wardrobe: "Coat", dna: "", appearance: "", animationStyle: "Unassigned", sceneIds: [] },
  { id: "rocky", projectId: "p1", name: "Rocky", color: "#3a6c73", look: "2D", voice: "Unassigned", wardrobe: "Work", dna: "", appearance: "", animationStyle: "Unassigned", sceneIds: [] },
  { id: "luna", projectId: "p1", name: "Luna", color: "#685b8b", look: "3D", voice: "Unassigned", wardrobe: "Night", dna: "", appearance: "", animationStyle: "Unassigned", sceneIds: [] },
  { id: "sam", projectId: "p1", name: "Sam", color: "#75624b", look: "2D", voice: "Unassigned", wardrobe: "Casual", dna: "", appearance: "", animationStyle: "Unassigned", sceneIds: [] },
];

const INITIAL: StudioState = {
  schemaVersion: 3,
  theme: "night",
  studioMode: "director",
  assetCategory: "characters",
  capturePrefs: DEFAULT_CAPTURE_PREFS,
  captureAction: "",
  projects: [blankProject("p1", "Untitled production", "Feature", "Make the scene more cinematic.")],
  activeProjectId: "p1",
  notices: [{ id: "n1", text: "Saved on this device. No cloud service is connected." }],
  accountName: "Studio account",
  characters: STARTER_CHARACTERS,
  selectedCharacterId: "max",
  editorOpen: false,
  shots: shotsFor("p1"),
  selectedShotId: "p1-shot-1",
  scenes: scenesFor("p1"),
  selectedSceneId: "p1-scene-4",
  takes: [],
  selectedTakeId: "",
  clips: [],
  assets: [],
  mixes: [{ projectId: "p1", tracks: defaultMix() }],
  timelineViews: [{ projectId: "p1", playheadMs: 0, pixelsPerSecond: 48 }],
  selectedClipId: "",
  selectedAudioTrack: "dialogue",
  jobs: sampleJobs("p1"),
  selectedConnectorId: "blender",
  connectorFilter: "All",
};

function isStatus(value: unknown): value is ProductionStatus {
  return value === "Draft" || value === "In review" || value === "Approved";
}

function isAnimationStyle(value: unknown): value is AnimationStyle {
  return ANIMATION_STYLES.includes(value as AnimationStyle);
}

function completeCharacter(character: Partial<CharacterRecord>, projectId: string): CharacterRecord {
  return {
    id: character.id || `${projectId}-character`,
    projectId: character.projectId || projectId,
    name: character.name || "Unnamed",
    color: character.color || "#405d84",
    look: character.look === "2D" ? "2D" : "3D",
    voice: character.voice || "Unassigned",
    wardrobe: character.wardrobe || "Unset",
    dna: character.dna || "",
    appearance: character.appearance || "",
    animationStyle: isAnimationStyle(character.animationStyle) ? character.animationStyle : "Unassigned",
    sceneIds: Array.isArray(character.sceneIds) ? character.sceneIds : [],
  };
}

function normalize(stored: LegacyState, base: StudioState): StudioState {
  const incoming = Array.isArray(stored.projects) && stored.projects.length > 0 ? stored.projects : base.projects;
  const activeProjectId = incoming.some((project) => project.id === stored.activeProjectId)
    ? stored.activeProjectId || base.activeProjectId
    : incoming[0]?.id || base.activeProjectId;

  const projects = incoming.map((project) => {
    const active = project.id === activeProjectId;
    return {
      id: project.id,
      title: project.title || "Untitled production",
      kind: project.kind || "Feature",
      status: isStatus(project.status) ? project.status : active && isStatus(stored.status) ? stored.status : "Draft",
      planApproved: typeof project.planApproved === "boolean" ? project.planApproved : active ? Boolean(stored.planApproved) : false,
      directorNote: typeof project.directorNote === "string" ? project.directorNote : active ? stored.directorNote || "" : "",
      messages: Array.isArray(project.messages) ? project.messages.filter((message) => message.role === "user" || message.role === "unavailable") : [],
      plan: Array.isArray(project.plan) && project.plan.length > 0 ? project.plan : defaultPlan(),
    };
  });

  const projectIds = new Set(projects.map((project) => project.id));
  const characters = (Array.isArray(stored.characters) && stored.characters.length > 0 ? stored.characters : base.characters).map((character) =>
    completeCharacter(
      {
        ...character,
        projectId: character.projectId && projectIds.has(character.projectId) ? character.projectId : activeProjectId,
      },
      activeProjectId,
    ),
  );

  const storedShots = Array.isArray(stored.shots) ? stored.shots : [];
  const looseShots = storedShots.length > 0 ? storedShots.map((shot) => ({ ...shot, projectId: shot.projectId && projectIds.has(shot.projectId) ? shot.projectId : activeProjectId })) : [];
  for (const project of projects) {
    if (!looseShots.some((shot) => shot.projectId === project.id)) looseShots.push(...shotsFor(project.id));
  }

  const storedScenes = Array.isArray(stored.scenes) ? stored.scenes : [];
  const scenes = storedScenes.map((scene) =>
    completeScene(
      {
        ...scene,
        projectId: scene.projectId && projectIds.has(scene.projectId) ? scene.projectId : activeProjectId,
      },
      activeProjectId,
    ),
  );
  for (const project of projects) {
    if (!scenes.some((scene) => scene.projectId === project.id)) scenes.push(...scenesFor(project.id));
  }
  const seenNumbers = new Map<string, number>();
  for (let index = 0; index < scenes.length; index += 1) {
    const sequence = (seenNumbers.get(scenes[index].projectId) ?? 0) + 1;
    seenNumbers.set(scenes[index].projectId, sequence);
    if (scenes[index].number !== sequence) scenes[index] = { ...scenes[index], number: sequence };
  }

  const shots = looseShots.map((shot) => {
    const siblings = looseShots.filter((item) => item.projectId === shot.projectId);
    const index = siblings.indexOf(shot);
    const sceneList = scenes.filter((scene) => scene.projectId === shot.projectId);
    const fallback = sceneList[index % Math.max(sceneList.length, 1)]?.id || "";
    return completeShot(shot, shot.projectId, fallback);
  });

  const storedTakes = Array.isArray(stored.takes) ? stored.takes : [];
  const takes = storedTakes
    .map((take) => completeTake({ ...take, projectId: take.projectId && projectIds.has(take.projectId) ? take.projectId : activeProjectId }, activeProjectId))
    .filter((take): take is TakeRecord => Boolean(take));

  const storedClips = Array.isArray(stored.clips) ? stored.clips : [];
  const clips = storedClips
    .map((clip) => completeClip({ ...clip, projectId: clip.projectId && projectIds.has(clip.projectId) ? clip.projectId : activeProjectId }, activeProjectId))
    .filter((clip): clip is TimelineClip => Boolean(clip));
  const storedAssets = Array.isArray(stored.assets) ? stored.assets : [];
  const assets = storedAssets
    .map((asset) => completeAsset({ ...asset, projectId: asset.projectId && projectIds.has(asset.projectId) ? asset.projectId : activeProjectId }, activeProjectId))
    .filter((asset): asset is AssetRecord => Boolean(asset));
  const mixes = projects.map((project) => {
    const found = Array.isArray(stored.mixes) ? stored.mixes.find((mix) => mix.projectId === project.id) : undefined;
    return { projectId: project.id, tracks: completeMix(found?.tracks) };
  });
  const timelineViews = projects.map((project) => {
    const found = Array.isArray(stored.timelineViews) ? stored.timelineViews.find((view) => view.projectId === project.id) : undefined;
    const pixels = typeof found?.pixelsPerSecond === "number" ? Math.min(160, Math.max(24, found.pixelsPerSecond)) : 48;
    const playhead = typeof found?.playheadMs === "number" && found.playheadMs >= 0 ? found.playheadMs : 0;
    return { projectId: project.id, playheadMs: playhead, pixelsPerSecond: pixels };
  });

  const storedJobs = Array.isArray(stored.jobs) ? stored.jobs : [];
  const jobs = storedJobs.map((job) => ({
    ...job,
    projectId: job.projectId && projectIds.has(job.projectId) ? job.projectId : activeProjectId,
    sample: typeof job.sample === "boolean" ? job.sample : job.state !== "Recorded locally",
  }));
  for (const project of projects) {
    if (!jobs.some((job) => job.projectId === project.id)) jobs.push(...sampleJobs(project.id));
  }

  const theme = stored.theme === "day" || stored.theme === "night" ? stored.theme : base.theme;
  const studioMode = stored.studioMode === "studio" ? "studio" : "director";
  const assetCategory = ASSET_CATEGORIES.some((item) => item.id === stored.assetCategory) ? (stored.assetCategory as AssetCategory) : base.assetCategory;
  const prefs = (stored.capturePrefs || {}) as Partial<CapturePrefs>;
  const capturePrefs: CapturePrefs = {
    tab: prefs.tab === "face" || prefs.tab === "voice" || prefs.tab === "style" || prefs.tab === "body" ? prefs.tab : DEFAULT_CAPTURE_PREFS.tab,
    motionStrength: Math.min(200, Math.max(0, typeof prefs.motionStrength === "number" ? prefs.motionStrength : DEFAULT_CAPTURE_PREFS.motionStrength)),
    smoothing: Math.min(100, Math.max(0, typeof prefs.smoothing === "number" ? prefs.smoothing : DEFAULT_CAPTURE_PREFS.smoothing)),
    exaggeration: Math.min(200, Math.max(0, typeof prefs.exaggeration === "number" ? prefs.exaggeration : DEFAULT_CAPTURE_PREFS.exaggeration)),
    captureBlend: Math.min(100, Math.max(0, typeof prefs.captureBlend === "number" ? prefs.captureBlend : DEFAULT_CAPTURE_PREFS.captureBlend)),
    keepFacialExpressions: typeof prefs.keepFacialExpressions === "boolean" ? prefs.keepFacialExpressions : DEFAULT_CAPTURE_PREFS.keepFacialExpressions,
  };
  return {
    schemaVersion: 3,
    theme,
    studioMode,
    assetCategory,
    capturePrefs,
    captureAction: "",
    projects,
    activeProjectId,
    notices: Array.isArray(stored.notices) && stored.notices.length > 0 ? stored.notices : base.notices,
    accountName: stored.accountName || base.accountName,
    characters,
    selectedCharacterId: stored.selectedCharacterId || base.selectedCharacterId,
    editorOpen: Boolean(stored.editorOpen),
    shots,
    selectedShotId: stored.selectedShotId || shots.find((shot) => shot.projectId === activeProjectId)?.id || "",
    scenes,
    selectedSceneId: stored.selectedSceneId || scenes.find((scene) => scene.projectId === activeProjectId)?.id || "",
    takes,
    selectedTakeId:
      (stored.selectedTakeId && takes.some((take) => take.id === stored.selectedTakeId) ? stored.selectedTakeId : "") ||
      takes.find((take) => take.projectId === activeProjectId && take.characterId === (stored.selectedCharacterId || base.selectedCharacterId))?.id ||
      "",
    clips,
    assets,
    mixes,
    timelineViews,
    selectedClipId: clips.some((clip) => clip.id === stored.selectedClipId) ? stored.selectedClipId || "" : "",
    selectedAudioTrack: resolveTrack(stored.selectedAudioTrack),
    jobs,
    selectedConnectorId: CONNECTORS.some((connector) => connector.id === stored.selectedConnectorId) ? stored.selectedConnectorId || "blender" : "blender",
    connectorFilter: stored.connectorFilter || "All",
  };
}

type StudioContextValue = {
  ready: boolean;
  theme: ThemeName;
  studioMode: StudioMode;
  assetCategory: AssetCategory;
  capturePrefs: CapturePrefs;
  captureAction: CaptureAction;
  projects: ProjectRecord[];
  activeProjectId: string;
  activeProject: ProjectRecord;
  notices: Notice[];
  accountName: string;
  characters: CharacterRecord[];
  selectedCharacterId: string;
  selectedCharacter: CharacterRecord | undefined;
  editorOpen: boolean;
  shots: ShotRecord[];
  selectedShotId: string;
  selectedShot: ShotRecord | undefined;
  scenes: SceneRecord[];
  selectedSceneId: string;
  selectedScene: SceneRecord | undefined;
  takes: TakeRecord[];
  selectedTakeId: string;
  selectedTake: TakeRecord | undefined;
  clips: TimelineClip[];
  assets: AssetRecord[];
  mix: TrackMix[];
  playheadMs: number;
  pixelsPerSecond: number;
  selectedClipId: string;
  selectedClip: TimelineClip | undefined;
  storageBytes: number;
  mediaReady: boolean;
  warnings: ReturnType<typeof continuityWarnings>;
  selectedAudioTrack: string;
  jobs: JobRecord[];
  selectedConnectorId: string;
  connectorFilter: string;
  selectedConnector: ConnectorRecord;
  status: ProductionStatus;
  directorNote: string;
  planApproved: boolean;
  messages: DirectorMessage[];
  plan: PlanItem[];
  setTheme: (theme: ThemeName) => void;
  setStudioMode: (mode: StudioMode) => void;
  setAssetCategory: (category: AssetCategory) => void;
  setCapturePrefs: (patch: Partial<CapturePrefs>) => void;
  requestCaptureAction: (action: CaptureAction) => void;
  clearCaptureAction: () => void;
  setActiveProjectId: (id: string) => void;
  setStatus: (status: ProductionStatus) => void;
  setAccountName: (name: string) => void;
  createProject: (description: string) => string | null;
  updateProject: (id: string, patch: Partial<Pick<ProjectRecord, "title" | "kind">>) => void;
  deleteProject: (id: string) => void;
  saveLocal: () => void;
  setDirectorNote: (note: string) => void;
  saveDirection: () => string | null;
  updatePlan: (itemId: string, detail: string) => void;
  recordNote: (text: string) => void;
  approvePlan: () => void;
  selectCharacter: (id: string) => void;
  openCharacter: (id: string) => void;
  closeEditor: () => void;
  updateCharacter: (id: string, patch: Partial<CharacterRecord>) => void;
  setSceneAssignment: (characterId: string, shotId: string, assigned: boolean) => void;
  addCharacter: (name: string) => string | null;
  deleteCharacter: (id: string) => void;
  selectShot: (id: string) => void;
  addShot: () => void;
  deleteShot: (id: string) => void;
  moveShot: (fromId: string, toId: string) => void;
  selectScene: (id: string) => void;
  addScene: () => void;
  updateScene: (id: string, patch: Partial<SceneRecord>) => void;
  duplicateScene: (id: string) => void;
  deleteScene: (id: string) => void;
  moveScene: (fromId: string, toId: string) => void;
  approveScene: (id: string) => void;
  confirmSceneVersion: (id: string) => void;
  markSceneNeedsReview: (id: string) => void;
  removeSceneCharacter: (sceneId: string, characterId: string) => void;
  selectTake: (id: string) => void;
  saveTake: (draft: TakeDraft) => Promise<{ error: string | null; takeId: string }>;
  updateTake: (id: string, patch: Partial<Pick<TakeRecord, "name" | "notes" | "dialogue" | "sceneId" | "shotId" | "approval" | "characterId">>) => void;
  deleteTake: (id: string, force?: boolean) => Promise<string | null>;
  deleteAsset: (id: string, force?: boolean) => Promise<string | null>;
  placeTake: (takeId: string) => string | null;
  placeScene: (sceneId: string) => string | null;
  placeShot: (shotId: string) => string | null;
  saveImportedMedia: (draft: {
    name: string;
    mime: string;
    blob: Blob;
    durationMs: number;
    hasVideo: boolean;
    hasAudio: boolean;
    kind: "import" | "narration";
    track: TrackId;
  }) => Promise<string | null>;
  selectClip: (id: string) => void;
  updateClip: (id: string, patch: Partial<Pick<TimelineClip, "name" | "volume" | "fadeInMs" | "fadeOutMs" | "sceneId" | "shotId" | "characterId">>) => void;
  moveTimelineClip: (id: string, startMs: number, track: TrackId) => string | null;
  trimTimelineClip: (id: string, edge: "in" | "out", sourceMs: number) => void;
  splitTimelineClip: (id: string, playheadMs: number) => string | null;
  nudgeTimelineClip: (id: string, direction: -1 | 1) => void;
  unlinkClip: (id: string) => void;
  fitClipToPicture: (id: string) => void;
  importCaptions: (name: string, cues: CaptionCue[]) => string | null;
  removeSceneClips: (sceneId: string) => void;
  deleteClip: (id: string) => void;
  setTrackMix: (track: TrackId, patch: Partial<Pick<TrackMix, "muted" | "solo" | "volume">>) => void;
  setPlayhead: (ms: number) => void;
  setTimelineZoom: (pixels: number) => void;
  updateShot: (id: string, patch: Partial<Pick<ShotRecord, "label" | "action" | "camera" | "location" | "sceneId" | "movement">>) => void;
  setSelectedAudioTrack: (track: string) => void;
  recordExport: (label: string) => void;
  selectConnector: (id: string) => void;
  setConnectorFilter: (filter: string) => void;
};

const StudioContext = createContext<StudioContextValue | null>(null);

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
}

function withNotice(notices: Notice[], text: string): Notice[] {
  return [{ id: crypto.randomUUID(), text }, ...notices].slice(0, 8);
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudioState>(INITIAL);
  const [ready, setReady] = useState(false);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [storageBytes, setStorageBytes] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);

  async function refreshMedia() {
    try {
      const listed = await listMedia();
      setMediaIds(listed.ids);
      setStorageBytes(listed.bytes);
    } catch {
      setMediaIds([]);
      setStorageBytes(0);
    } finally {
      setMediaReady(true);
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as LegacyState;
        setState((current) => normalize(stored, current));
        if (stored.theme === "day" || stored.theme === "night") applyTheme(stored.theme);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
    void refreshMedia();
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    applyTheme(state.theme);
  }, [ready, state]);

  const value = useMemo<StudioContextValue>(() => {
    const activeProject = state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0];
    const characters = state.characters.filter((character) => character.projectId === activeProject.id);
    const shots = state.shots.filter((shot) => shot.projectId === activeProject.id);
    const scenes = state.scenes.filter((scene) => scene.projectId === activeProject.id);
    const jobs = state.jobs.filter((job) => job.projectId === activeProject.id);
    const takes = state.takes.filter((take) => take.projectId === activeProject.id);
    const clips = state.clips.filter((clip) => clip.projectId === activeProject.id);
    const assets = state.assets.filter((asset) => asset.projectId === activeProject.id);
    const mix = state.mixes.find((item) => item.projectId === activeProject.id)?.tracks ?? defaultMix();
    const timelineView = state.timelineViews.find((item) => item.projectId === activeProject.id) ?? { playheadMs: 0, pixelsPerSecond: 48 };
    const selectedCharacter = characters.find((character) => character.id === state.selectedCharacterId) ?? characters[0];
    const selectedShot = shots.find((shot) => shot.id === state.selectedShotId) ?? shots[0];
    const selectedScene = scenes.find((scene) => scene.id === state.selectedSceneId) ?? scenes[0];
    const selectedTake =
      takes.find((take) => take.id === state.selectedTakeId && (!selectedCharacter || take.characterId === selectedCharacter.id)) ??
      takes.find((take) => take.characterId === selectedCharacter?.id);
    const selectedClip = clips.find((clip) => clip.id === state.selectedClipId);
    const warnings = continuityWarnings({
      projectId: activeProject.id,
      projectTitle: activeProject.title,
      characters,
      scenes,
      shots,
      takes,
      mediaIds: new Set(mediaIds),
      mediaReady,
      clips,
    });

    function updateActive(patch: Partial<ProjectRecord>) {
      setState((current) => ({
        ...current,
        projects: current.projects.map((project) => (project.id === current.activeProjectId ? { ...project, ...patch } : project)),
      }));
    }

    return {
      ready,
      theme: state.theme,
      studioMode: state.studioMode,
      assetCategory: state.assetCategory,
      capturePrefs: state.capturePrefs,
      captureAction: state.captureAction,
      projects: state.projects,
      activeProjectId: activeProject.id,
      activeProject,
      notices: state.notices,
      accountName: state.accountName,
      characters,
      selectedCharacterId: selectedCharacter?.id ?? "",
      selectedCharacter,
      editorOpen: state.editorOpen && Boolean(selectedCharacter),
      shots,
      selectedShotId: selectedShot?.id ?? "",
      selectedShot,
      scenes,
      selectedSceneId: selectedScene?.id ?? "",
      selectedScene,
      takes,
      selectedTakeId: state.selectedTakeId && takes.some((take) => take.id === state.selectedTakeId) ? state.selectedTakeId : "",
      selectedTake,
      clips,
      assets,
      mix,
      playheadMs: timelineView.playheadMs,
      pixelsPerSecond: timelineView.pixelsPerSecond,
      selectedClipId: selectedClip?.id ?? "",
      selectedClip,
      storageBytes,
      mediaReady,
      warnings,
      selectedAudioTrack: state.selectedAudioTrack,
      jobs,
      selectedConnectorId: state.selectedConnectorId,
      connectorFilter: state.connectorFilter,
      selectedConnector: CONNECTORS.find((connector) => connector.id === state.selectedConnectorId) ?? CONNECTORS[0],
      status: activeProject.status,
      directorNote: activeProject.directorNote,
      planApproved: activeProject.planApproved,
      messages: activeProject.messages,
      plan: activeProject.plan,
      setTheme: (theme) => setState((current) => ({ ...current, theme })),
      setStudioMode: (mode) => setState((current) => ({ ...current, studioMode: mode })),
      setAssetCategory: (category) => setState((current) => ({ ...current, assetCategory: category })),
      setCapturePrefs: (patch) => setState((current) => ({ ...current, capturePrefs: { ...current.capturePrefs, ...patch } })),
      requestCaptureAction: (action) => setState((current) => ({ ...current, captureAction: action })),
      clearCaptureAction: () => setState((current) => ({ ...current, captureAction: "" })),
      setActiveProjectId: (id) => setState((current) => ({ ...current, activeProjectId: id, editorOpen: false })),
      setStatus: (status) => updateActive({ status }),
      setAccountName: (name) => setState((current) => ({ ...current, accountName: name })),
      createProject: (description) => {
        const prompt = description.trim();
        if (!prompt) return "Describe a film before creating a production.";
        const title = projectTitleFromPrompt(prompt) || "Untitled production";
        const id = crypto.randomUUID();
        setState((current) => ({
          ...current,
          projects: [blankProject(id, title, "Draft", prompt), ...current.projects],
          activeProjectId: id,
          selectedCharacterId: "",
          selectedTakeId: "",
          selectedClipId: "",
          assetCategory: "characters",
          studioMode: "director",
          shots: [...shotsFor(id), ...current.shots],
          scenes: [...scenesFor(id), ...current.scenes],
          jobs: [...sampleJobs(id), ...current.jobs],
          mixes: [{ projectId: id, tracks: defaultMix() }, ...current.mixes],
          timelineViews: [{ projectId: id, playheadMs: 0, pixelsPerSecond: 48 }, ...current.timelineViews],
          editorOpen: false,
          notices: withNotice(current.notices, `“${title}” is saved on this device. Add characters next.`),
        }));
        return null;
      },
      updateProject: (id, patch) =>
        setState((current) => ({
          ...current,
          projects: current.projects.map((project) => (project.id === id ? { ...project, ...patch } : project)),
        })),
      deleteProject: (id) => {
        const doomed = [
          ...state.takes.filter((take) => take.projectId === id).map((take) => take.mediaId),
          ...state.assets.filter((asset) => asset.projectId === id).map((asset) => asset.id),
        ];
        setState((current) => {
          const removed = current.projects.find((project) => project.id === id);
          let projects = current.projects.filter((project) => project.id !== id);
          let shotsForState = current.shots.filter((shot) => shot.projectId !== id);
          let jobsForState = current.jobs.filter((job) => job.projectId !== id);
          let scenesForState = current.scenes.filter((scene) => scene.projectId !== id);
          let mixes = current.mixes.filter((mix) => mix.projectId !== id);
          let timelineViews = current.timelineViews.filter((view) => view.projectId !== id);
          if (projects.length === 0) {
            const replacementId = crypto.randomUUID();
            projects = [blankProject(replacementId, "Untitled production", "Feature")];
            shotsForState = shotsFor(replacementId);
            scenesForState = scenesFor(replacementId);
            jobsForState = sampleJobs(replacementId);
            mixes = [{ projectId: replacementId, tracks: defaultMix() }];
            timelineViews = [{ projectId: replacementId, playheadMs: 0, pixelsPerSecond: 48 }];
          }
          const activeProjectId = projects.some((project) => project.id === current.activeProjectId) ? current.activeProjectId : projects[0].id;
          return {
            ...current,
            projects,
            shots: shotsForState,
            scenes: scenesForState,
            jobs: jobsForState,
            characters: current.characters.filter((character) => character.projectId !== id),
            takes: current.takes.filter((take) => take.projectId !== id),
            clips: current.clips.filter((clip) => clip.projectId !== id),
            assets: current.assets.filter((asset) => asset.projectId !== id),
            mixes,
            timelineViews,
            activeProjectId,
            editorOpen: false,
            notices: withNotice(current.notices, `“${removed?.title ?? "Project"}” was deleted from this device.`),
          };
        });
        void Promise.all(doomed.map((mediaId) => deleteMedia(mediaId).catch(() => undefined))).then(() => refreshMedia());
      },
      saveLocal: () => setState((current) => ({ ...current, notices: withNotice(current.notices, "Project saved on this device.") })),
      setDirectorNote: (note) => updateActive({ directorNote: note }),
      saveDirection: () => {
        const text = activeProject.directorNote.trim();
        if (!text) return "Write a direction before review.";
        setState((current) => ({
          ...current,
          projects: current.projects.map((project) =>
            project.id === current.activeProjectId
              ? {
                  ...project,
                  messages: [
                    ...project.messages,
                    { id: crypto.randomUUID(), role: "user", text },
                    {
                      id: crypto.randomUUID(),
                      role: "unavailable",
                      text: "APG is not connected. This direction is saved on this device. No production plan was generated.",
                    },
                  ],
                }
              : project,
          ),
          notices: withNotice(current.notices, "Direction saved on this device. APG is not connected."),
        }));
        return null;
      },
      updatePlan: (itemId, detail) =>
        setState((current) => ({
          ...current,
          projects: current.projects.map((project) =>
            project.id === current.activeProjectId
              ? {
                  ...project,
                  planApproved: false,
                  status: project.status === "Approved" ? "In review" : project.status,
                  plan: project.plan.map((item) => (item.id === itemId ? { ...item, detail } : item)),
                }
              : project,
          ),
        })),
      recordNote: (text) => setState((current) => ({ ...current, notices: withNotice(current.notices, text) })),
      approvePlan: () =>
        setState((current) => ({
          ...current,
          projects: current.projects.map((project) =>
            project.id === current.activeProjectId ? { ...project, planApproved: true, status: "Approved" } : project,
          ),
          notices: withNotice(current.notices, "Production plan approved on this device. No assistant generated it."),
        })),
      selectCharacter: (id) =>
        setState((current) => {
          const keep =
            current.selectedTakeId &&
            current.takes.some((take) => take.id === current.selectedTakeId && take.characterId === id && take.projectId === current.activeProjectId)
              ? current.selectedTakeId
              : "";
          const fallback = current.takes.find((take) => take.characterId === id && take.projectId === current.activeProjectId)?.id || "";
          return { ...current, selectedCharacterId: id, selectedTakeId: keep || fallback };
        }),
      openCharacter: (id) =>
        setState((current) => {
          const keep =
            current.selectedTakeId &&
            current.takes.some((take) => take.id === current.selectedTakeId && take.characterId === id && take.projectId === current.activeProjectId)
              ? current.selectedTakeId
              : "";
          const fallback = current.takes.find((take) => take.characterId === id && take.projectId === current.activeProjectId)?.id || "";
          return { ...current, selectedCharacterId: id, selectedTakeId: keep || fallback, editorOpen: true };
        }),
      closeEditor: () => setState((current) => ({ ...current, editorOpen: false })),
      updateCharacter: (id, patch) =>
        setState((current) => ({
          ...current,
          characters: current.characters.map((character) => (character.id === id ? { ...character, ...patch } : character)),
        })),
      setSceneAssignment: (characterId, shotId, assigned) =>
        setState((current) => ({
          ...current,
          characters: current.characters.map((character) => {
            if (character.id !== characterId) return character;
            const sceneIds = assigned
              ? [...new Set([...character.sceneIds, shotId])]
              : character.sceneIds.filter((sceneId) => sceneId !== shotId);
            return { ...character, sceneIds };
          }),
        })),
      addCharacter: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return "Enter a character name.";
        const id = crypto.randomUUID();
        setState((current) => ({
          ...current,
          characters: [
            ...current.characters,
            completeCharacter(
              {
                id,
                projectId: current.activeProjectId,
                name: trimmed,
                color: CHARACTER_COLORS[current.characters.length % CHARACTER_COLORS.length],
              },
              current.activeProjectId,
            ),
          ],
          selectedCharacterId: id,
          editorOpen: true,
          notices: withNotice(current.notices, `“${trimmed}” is saved in this project on this device.`),
        }));
        return null;
      },
      deleteCharacter: (id) =>
        setState((current) => {
          const characters = current.characters.filter((character) => character.id !== id);
          const nextCharacterId =
            current.selectedCharacterId === id
              ? characters.find((character) => character.projectId === current.activeProjectId)?.id || ""
              : current.selectedCharacterId;
          const keepTake =
            current.selectedTakeId &&
            current.takes.some((take) => take.id === current.selectedTakeId && take.characterId !== id)
              ? current.selectedTakeId
              : "";
          const fallbackTake = current.takes.find((take) => take.characterId === nextCharacterId && take.projectId === current.activeProjectId)?.id || "";
          return {
            ...current,
            characters,
            selectedCharacterId: nextCharacterId,
            selectedTakeId: keepTake || fallbackTake,
            editorOpen: current.selectedCharacterId === id ? false : current.editorOpen,
            notices: withNotice(current.notices, "Character deleted from this project on this device."),
          };
        }),
      selectShot: (id) => setState((current) => ({ ...current, selectedShotId: id })),
      addShot: () =>
        setState((current) => {
          const scene = current.scenes.find((item) => item.id === current.selectedSceneId && item.projectId === current.activeProjectId);
          const count = current.shots.filter((shot) => shot.projectId === current.activeProjectId).length + 1;
          const id = crypto.randomUUID();
          return {
            ...current,
            selectedShotId: id,
            shots: [
              ...current.shots,
              {
                id,
                projectId: current.activeProjectId,
                sceneId: scene?.id || "",
                label: `Shot ${count}`,
                action: "",
                color: ["#3e547a", "#625273", "#3a6672"][count % 3],
                camera: "Wide",
                movement: "",
                location: scene?.location || "",
              },
            ],
            notices: withNotice(current.notices, "Shot added on this device."),
          };
        }),
      deleteShot: (id) =>
        setState((current) => ({
          ...current,
          shots: current.shots.filter((shot) => shot.id !== id),
          notices: withNotice(current.notices, "Shot deleted from this project on this device."),
        })),
      moveShot: (fromId, toId) =>
        setState((current) => {
          const mine = current.shots.filter((shot) => shot.projectId === current.activeProjectId);
          const rest = current.shots.filter((shot) => shot.projectId !== current.activeProjectId);
          const from = mine.findIndex((shot) => shot.id === fromId);
          const to = mine.findIndex((shot) => shot.id === toId);
          if (from < 0 || to < 0 || from === to) return current;
          const next = [...mine];
          const [item] = next.splice(from, 1);
          next.splice(to, 0, item);
          return { ...current, shots: [...rest, ...next] };
        }),
      selectScene: (id) => setState((current) => ({ ...current, selectedSceneId: id })),
      addScene: () =>
        setState((current) => {
          const id = crypto.randomUUID();
          const number = current.scenes.filter((scene) => scene.projectId === current.activeProjectId).length + 1;
          return {
            ...current,
            selectedSceneId: id,
            scenes: [
              ...current.scenes,
              completeScene({ id, projectId: current.activeProjectId, number, title: "New scene", color: "#375377" }, current.activeProjectId),
            ],
            notices: withNotice(current.notices, "Scene added on this device."),
          };
        }),
      updateScene: (id, patch) =>
        setState((current) => ({
          ...current,
          scenes: current.scenes.map((scene) => (scene.id === id ? { ...scene, ...patch, id: scene.id, projectId: scene.projectId } : scene)),
        })),
      duplicateScene: (id) =>
        setState((current) => {
          const source = current.scenes.find((scene) => scene.id === id);
          if (!source) return current;
          const copyId = crypto.randomUUID();
          return {
            ...current,
            selectedSceneId: copyId,
            scenes: [
              ...current.scenes,
              completeScene(
                { ...source, id: copyId, title: `${source.title} copy`, status: "Needs review", stage: "Draft", approvedFingerprint: "", number: source.number + 1 },
                source.projectId,
              ),
            ],
            notices: withNotice(current.notices, "Scene duplicated on this device."),
          };
        }),
      deleteScene: (id) =>
        setState((current) => ({
          ...current,
          scenes: current.scenes.filter((scene) => scene.id !== id),
          shots: current.shots.map((shot) => (shot.sceneId === id ? { ...shot, sceneId: "" } : shot)),
          notices: withNotice(current.notices, "Scene deleted on this device. Linked shots were left unassigned."),
        })),
      moveScene: (fromId, toId) =>
        setState((current) => {
          const mine = current.scenes.filter((scene) => scene.projectId === current.activeProjectId);
          const rest = current.scenes.filter((scene) => scene.projectId !== current.activeProjectId);
          const from = mine.findIndex((scene) => scene.id === fromId);
          const to = mine.findIndex((scene) => scene.id === toId);
          if (from < 0 || to < 0 || from === to) return current;
          const next = [...mine];
          const [item] = next.splice(from, 1);
          next.splice(to, 0, item);
          const numbered = next.map((scene, index) => ({ ...scene, number: index + 1 }));
          return { ...current, scenes: [...rest, ...numbered] };
        }),
      approveScene: (id) =>
        setState((current) => ({
          ...current,
          scenes: current.scenes.map((scene) =>
            scene.id === id ? { ...scene, status: "Approved", stage: "Approved", approvedFingerprint: sceneFingerprint(scene) } : scene,
          ),
          notices: withNotice(current.notices, "Scene approved on this device. Animation and audio tools are not connected."),
        })),
      confirmSceneVersion: (id) =>
        setState((current) => ({
          ...current,
          scenes: current.scenes.map((scene) => (scene.id === id ? { ...scene, approvedFingerprint: sceneFingerprint(scene) } : scene)),
          notices: withNotice(current.notices, "This approved version was confirmed. The scene text was not rewritten."),
        })),
      markSceneNeedsReview: (id) =>
        setState((current) => ({
          ...current,
          scenes: current.scenes.map((scene) => (scene.id === id ? { ...scene, status: "Needs review", stage: "Continuity review" } : scene)),
          notices: withNotice(current.notices, "Scene marked needs review. Earlier text was kept."),
        })),
      removeSceneCharacter: (sceneId, characterId) =>
        setState((current) => ({
          ...current,
          scenes: current.scenes.map((scene) =>
            scene.id === sceneId ? { ...scene, characterIds: scene.characterIds.filter((id) => id !== characterId) } : scene,
          ),
        })),
      selectTake: (id) =>
        setState((current) => {
          const take = current.takes.find((item) => item.id === id);
          if (!take) return { ...current, selectedTakeId: id };
          return {
            ...current,
            selectedTakeId: id,
            selectedCharacterId: take.characterId || current.selectedCharacterId,
            selectedSceneId: take.sceneId || current.selectedSceneId,
            selectedShotId: take.shotId || current.selectedShotId,
          };
        }),
      saveTake: async (draft) => {
        if (!draft.characterId) return { error: "Select a character before saving a take.", takeId: "" };
        if (!draft.blob || draft.blob.size === 0) return { error: "Record a performance before saving.", takeId: "" };
        const id = crypto.randomUUID();
        const mediaId = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        try {
          await putMedia({
            id: mediaId,
            projectId: activeProject.id,
            takeId: id,
            blob: draft.blob,
            mime: draft.mime || "video/webm",
            bytes: draft.blob.size,
            createdAt,
          });
        } catch (error) {
          return { error: storageError(error), takeId: "" };
        }
        setState((current) => {
          const character = current.characters.find((item) => item.id === draft.characterId);
          const count = current.takes.filter((take) => take.characterId === draft.characterId).length + 1;
          return {
            ...current,
            selectedTakeId: id,
            selectedCharacterId: draft.characterId,
            selectedSceneId: draft.sceneId || current.selectedSceneId,
            selectedShotId: draft.shotId || current.selectedShotId,
            takes: [
              {
                id,
                projectId: current.activeProjectId,
                characterId: draft.characterId,
                sceneId: draft.sceneId,
                shotId: draft.shotId,
                name: draft.name.trim() || `${character?.name ?? "Character"} take ${count}`,
                notes: draft.notes,
                dialogue: draft.dialogue,
                durationMs: draft.durationMs,
                createdAt,
                approval: "Draft",
                mediaId,
                mime: draft.mime || "video/webm",
                bytes: draft.blob.size,
                hasAudio: draft.hasAudio,
                hasVideo: draft.hasVideo,
                cameraLabel: draft.cameraLabel,
                microphoneLabel: draft.microphoneLabel,
                tracking: "Raw recording only",
                retarget: "Not available",
              },
              ...current.takes,
            ],
            scenes: current.scenes.map((scene) =>
              scene.id === draft.sceneId && !scene.characterIds.includes(draft.characterId)
                ? { ...scene, characterIds: [...scene.characterIds, draft.characterId] }
                : scene,
            ),
            notices: withNotice(current.notices, `Raw recording saved for ${character?.name ?? "the selected character"}. It was not retargeted.`),
          };
        });
        await refreshMedia();
        return { error: null, takeId: id };
      },
      updateTake: (id, patch) =>
        setState((current) => ({
          ...current,
          takes: current.takes.map((take) => (take.id === id ? { ...take, ...patch, id: take.id, projectId: take.projectId, mediaId: take.mediaId } : take)),
        })),
      deleteTake: async (id, force = false) => {
        const take = state.takes.find((item) => item.id === id);
        const referenced = state.clips.filter((clip) => clip.takeId === id || (take?.mediaId && clip.mediaId === take.mediaId));
        if (referenced.length > 0 && !force) {
          return `This recording is used by ${referenced.length} timeline clip${referenced.length === 1 ? "" : "s"}. It was kept.`;
        }
        const mediaId = take?.mediaId;
        if (mediaId) {
          try {
            await deleteMedia(mediaId);
          } catch {
            setState((current) => ({ ...current, notices: withNotice(current.notices, "The take was removed. The recording file could not be deleted.") }));
          }
        }
        setState((current) => {
          const deleted = current.takes.find((item) => item.id === id);
          const remaining = current.takes.filter((item) => item.id !== id);
          const nextTake =
            current.selectedTakeId === id
              ? remaining.find((item) => item.characterId === deleted?.characterId && item.projectId === current.activeProjectId)?.id || ""
              : current.selectedTakeId;
          return {
            ...current,
            takes: remaining,
            selectedTakeId: nextTake && remaining.some((item) => item.id === nextTake) ? nextTake : "",
            notices: withNotice(current.notices, "Take deleted from this character on this device. Timeline clips were left in place."),
          };
        });
        await refreshMedia();
        return null;
      },
      deleteAsset: async (id, force = false) => {
        const referenced = state.clips.filter((clip) => clip.mediaId === id);
        if (referenced.length > 0 && !force) return `This file is used by ${referenced.length} timeline clip${referenced.length === 1 ? "" : "s"}. It was kept.`;
        try {
          await deleteMedia(id);
        } catch {
          setState((current) => ({ ...current, notices: withNotice(current.notices, "The asset was removed. The file could not be deleted.") }));
        }
        setState((current) => ({
          ...current,
          assets: current.assets.filter((asset) => asset.id !== id),
          notices: withNotice(current.notices, "Imported file deleted from this device. Timeline clips were left in place."),
        }));
        await refreshMedia();
        return null;
      },
      placeTake: (takeId) => {
        let error: string | null = "That take is not in this project.";
        setState((current) => {
          const take = current.takes.find((item) => item.id === takeId && item.projectId === current.activeProjectId);
          if (!take) return current;
          const mine = current.clips.filter((clip) => clip.projectId === current.activeProjectId);
          const placed = clipsForSource(mine, {
            projectId: current.activeProjectId,
            mediaId: take.mediaId,
            takeId: take.id,
            sceneId: take.sceneId,
            shotId: take.shotId,
            characterId: take.characterId,
            name: take.name,
            durationMs: take.durationMs,
            hasVideo: take.hasVideo,
            hasAudio: take.hasAudio,
            newId: () => crypto.randomUUID(),
          });
          error = placed.error || null;
          if (placed.clips.length === 0) return current;
          return {
            ...current,
            clips: [...current.clips, ...placed.clips],
            selectedClipId: placed.clips[0].id,
            notices: withNotice(current.notices, `${take.name} was placed on the timeline. The recording was not re-encoded.`),
          };
        });
        return error;
      },
      placeScene: (sceneId) => {
        const matches = state.takes.filter((take) => take.projectId === activeProject.id && take.sceneId === sceneId);
        if (matches.length === 0) return "This scene has no recording to place.";
        let added = 0;
        setState((current) => {
          let mine = current.clips.filter((clip) => clip.projectId === current.activeProjectId);
          const created: TimelineClip[] = [];
          for (const take of matches) {
            const placed = clipsForSource(mine, {
              projectId: current.activeProjectId,
              mediaId: take.mediaId,
              takeId: take.id,
              sceneId: take.sceneId,
              shotId: take.shotId,
              characterId: take.characterId,
              name: take.name,
              durationMs: take.durationMs,
              hasVideo: take.hasVideo,
              hasAudio: take.hasAudio,
              newId: () => crypto.randomUUID(),
            });
            if (placed.clips.length === 0) continue;
            created.push(...placed.clips);
            mine = [...mine, ...placed.clips];
          }
          added = created.length;
          if (created.length === 0) return current;
          return { ...current, clips: [...current.clips, ...created], selectedClipId: created[0].id };
        });
        return added === 0 ? "Those recordings are already on the timeline." : null;
      },
      placeShot: (shotId) => {
        const matches = state.takes.filter((take) => take.projectId === activeProject.id && take.shotId === shotId);
        if (matches.length === 0) return "This shot has no recording to place.";
        let added = 0;
        setState((current) => {
          let mine = current.clips.filter((clip) => clip.projectId === current.activeProjectId);
          const created: TimelineClip[] = [];
          for (const take of matches) {
            const placed = clipsForSource(mine, {
              projectId: current.activeProjectId,
              mediaId: take.mediaId,
              takeId: take.id,
              sceneId: take.sceneId,
              shotId: take.shotId,
              characterId: take.characterId,
              name: take.name,
              durationMs: take.durationMs,
              hasVideo: take.hasVideo,
              hasAudio: take.hasAudio,
              newId: () => crypto.randomUUID(),
            });
            if (placed.clips.length === 0) continue;
            created.push(...placed.clips);
            mine = [...mine, ...placed.clips];
          }
          added = created.length;
          if (created.length === 0) return current;
          return { ...current, clips: [...current.clips, ...created], selectedClipId: created[0].id };
        });
        return added === 0 ? "Those recordings are already on the timeline." : null;
      },
      saveImportedMedia: async (draft) => {
        if (!draft.blob || draft.blob.size === 0) return "The file was empty and was not imported.";
        if (draft.durationMs < 40) return "This file has no readable duration.";
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        try {
          await putMedia({
            id,
            projectId: activeProject.id,
            takeId: "",
            blob: draft.blob,
            mime: draft.mime || "application/octet-stream",
            bytes: draft.blob.size,
            createdAt,
          });
        } catch (error) {
          return storageError(error);
        }
        let placementError: string | null = null;
        setState((current) => {
          const asset: AssetRecord = {
            id,
            projectId: current.activeProjectId,
            name: draft.name || "Imported media",
            mime: draft.mime,
            bytes: draft.blob.size,
            durationMs: draft.durationMs,
            hasVideo: draft.hasVideo,
            hasAudio: draft.hasAudio,
            kind: draft.kind,
            createdAt,
          };
          const mine = current.clips.filter((clip) => clip.projectId === current.activeProjectId);
          const placed = clipsForSource(mine, {
            projectId: current.activeProjectId,
            mediaId: id,
            takeId: "",
            sceneId: current.selectedSceneId,
            shotId: current.selectedShotId,
            characterId: "",
            name: asset.name,
            durationMs: draft.durationMs,
            hasVideo: draft.hasVideo,
            hasAudio: draft.hasAudio,
            track: draft.track,
            newId: () => crypto.randomUUID(),
          });
          placementError = placed.error || null;
          return {
            ...current,
            assets: [asset, ...current.assets],
            clips: placed.clips.length ? [...current.clips, ...placed.clips] : current.clips,
            selectedClipId: placed.clips[0]?.id || current.selectedClipId,
            notices: withNotice(current.notices, placed.error || `${asset.name} is stored on this device and placed on the timeline.`),
          };
        });
        await refreshMedia();
        return placementError;
      },
      selectClip: (id) => setState((current) => ({ ...current, selectedClipId: id })),
      updateClip: (id, patch) =>
        setState((current) => ({
          ...current,
          clips: current.clips.map((clip) => (clip.id === id ? { ...clip, ...patch, id: clip.id, mediaId: clip.mediaId, projectId: clip.projectId } : clip)),
        })),
      moveTimelineClip: (id, startMs, track) => {
        let error: string | null = "That clip is not on this timeline.";
        setState((current) => {
          const clip = current.clips.find((item) => item.id === id);
          if (!clip) return current;
          const take = current.takes.find((item) => item.mediaId === clip.mediaId);
          const asset = current.assets.find((item) => item.id === clip.mediaId);
          const shape = {
            hasVideo: take ? take.hasVideo : Boolean(asset?.hasVideo),
            hasAudio: take ? take.hasAudio || take.hasVideo : asset ? asset.hasAudio || asset.hasVideo : true,
          };
          const moved = moveGroup(current.clips, id, startMs, track, shape);
          if (moved.error) {
            error = moved.error;
            return current;
          }
          error = null;
          return { ...current, selectedClipId: id, clips: moved.clips };
        });
        return error;
      },
      trimTimelineClip: (id, edge, sourceMs) =>
        setState((current) => {
          const clip = current.clips.find((item) => item.id === id);
          const take = current.takes.find((item) => item.mediaId === clip?.mediaId);
          const asset = current.assets.find((item) => item.id === clip?.mediaId);
          const mediaDuration = take?.durationMs || asset?.durationMs || clip?.outMs || sourceMs;
          return { ...current, clips: trimGroup(current.clips, id, edge, sourceMs, mediaDuration) };
        }),
      splitTimelineClip: (id, playheadMs) => {
        let error: string | null = "The playhead is not inside this clip.";
        setState((current) => {
          const parts = splitGroup(current.clips, id, playheadMs, [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]);
          if (!parts) return current;
          error = null;
          const created = parts.find((clip) => clip.name.endsWith(" split") && clip.groupId);
          return { ...current, selectedClipId: created?.id || id, clips: parts };
        });
        return error;
      },
      nudgeTimelineClip: (id, direction) =>
        setState((current) => ({
          ...current,
          clips: nudgeGroup(current.clips, id, direction),
        })),
      unlinkClip: (id) =>
        setState((current) => ({
          ...current,
          clips: current.clips.map((clip) => (clip.id === id ? { ...clip, groupId: "" } : clip)),
        })),
      fitClipToPicture: (id) =>
        setState((current) => ({
          ...current,
          clips: fitGroupToPicture(current.clips, id),
          notices: withNotice(current.notices, "The clip was trimmed to the picture. The source file was kept."),
        })),
      importCaptions: (name, cues) => {
        if (cues.length === 0) return "That file has no readable captions.";
        setState((current) => ({
          ...current,
          selectedClipId: "",
          clips: [
            ...current.clips,
            ...cues.map((cue) => {
              const id = crypto.randomUUID();
              return completeClip(
                {
                  id,
                  projectId: current.activeProjectId,
                  track: "captions",
                  mediaId: `caption:${id}`,
                  name: name.replace(/\.(srt|vtt)$/i, ""),
                  text: cue.text,
                  startMs: cue.startMs,
                  inMs: 0,
                  outMs: cue.endMs - cue.startMs,
                  sceneId: current.selectedSceneId,
                },
                current.activeProjectId,
              );
            }).filter((clip): clip is TimelineClip => Boolean(clip)),
          ],
          notices: withNotice(current.notices, `${cues.length} caption${cues.length === 1 ? "" : "s"} from ${name} are on the timeline. They were not generated.`),
        }));
        return null;
      },
      removeSceneClips: (sceneId) =>
        setState((current) => ({
          ...current,
          clips: current.clips.filter((clip) => clip.sceneId !== sceneId),
          notices: withNotice(current.notices, "Clips for that scene were removed from the timeline. Source files were kept."),
        })),
      deleteClip: (id) =>
        setState((current) => ({
          ...current,
          clips: current.clips.filter((clip) => clip.id !== id),
          selectedClipId: current.selectedClipId === id ? "" : current.selectedClipId,
          notices: withNotice(current.notices, "Clip removed from the timeline. The source file was kept."),
        })),
      setTrackMix: (track, patch) =>
        setState((current) => ({
          ...current,
          mixes: current.mixes.map((mix) =>
            mix.projectId === current.activeProjectId
              ? { ...mix, tracks: mix.tracks.map((item) => (item.id === track ? { ...item, ...patch } : item)) }
              : mix,
          ),
        })),
      setPlayhead: (ms) =>
        setState((current) => ({
          ...current,
          timelineViews: current.timelineViews.map((view) =>
            view.projectId === current.activeProjectId ? { ...view, playheadMs: Math.max(0, ms) } : view,
          ),
        })),
      setTimelineZoom: (pixels) =>
        setState((current) => ({
          ...current,
          timelineViews: current.timelineViews.map((view) =>
            view.projectId === current.activeProjectId ? { ...view, pixelsPerSecond: Math.min(160, Math.max(24, pixels)) } : view,
          ),
        })),
      updateShot: (id, patch) =>
        setState((current) => ({
          ...current,
          shots: current.shots.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)),
        })),
      setSelectedAudioTrack: (track) => setState((current) => ({ ...current, selectedAudioTrack: track })),
      recordExport: (label) =>
        setState((current) => ({
          ...current,
          jobs: [
            { id: crypto.randomUUID(), projectId: current.activeProjectId, label, state: "Completed", sample: false },
            ...current.jobs,
          ],
          notices: withNotice(current.notices, "The timeline file was encoded on this computer. No cloud render ran."),
        })),
      selectConnector: (id) => setState((current) => ({ ...current, selectedConnectorId: id })),
      setConnectorFilter: (filter) => setState((current) => ({ ...current, connectorFilter: filter })),
    };
  }, [mediaIds, mediaReady, ready, state, storageBytes]);

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio must be used inside StudioProvider");
  return value;
}

export { ANIMATION_STYLES };
