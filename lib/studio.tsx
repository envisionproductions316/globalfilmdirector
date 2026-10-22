"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeName = "night" | "day";
export type ProductionStatus = "Draft" | "In review" | "Approved";
export type AnimationStyle = "Unassigned" | "Realistic" | "Stylized" | "Limited" | "Graphic";

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
  label: string;
  action: string;
  color: string;
  camera: string;
  location: string;
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
  theme: ThemeName;
  projects: ProjectRecord[];
  activeProjectId: string;
  notices: Notice[];
  accountName: string;
  characters: CharacterRecord[];
  selectedCharacterId: string;
  editorOpen: boolean;
  shots: ShotRecord[];
  selectedShotId: string;
  selectedAudioTrack: string;
  jobs: JobRecord[];
  selectedConnectorId: string;
  connectorFilter: string;
};

type LegacyState = Partial<StudioState> & {
  status?: ProductionStatus;
  directorNote?: string;
  planApproved?: boolean;
};

const STORAGE_KEY = "gfd.studio.v1";
const PLAN_LABELS = ["Cast", "Storyboard", "Camera plan", "Music", "Editable scene timeline"];
const CHARACTER_COLORS = ["#324e78", "#714b65", "#3a6c73", "#685b8b", "#75624b", "#405d84"];
const ANIMATION_STYLES: AnimationStyle[] = ["Unassigned", "Realistic", "Stylized", "Limited", "Graphic"];

const SHOT_TEMPLATES: Omit<ShotRecord, "id" | "projectId">[] = [
  { label: "Shot 1", action: "Camera / action", color: "#3e547a", camera: "Wide", location: "Interior" },
  { label: "Shot 2", action: "Camera / action", color: "#625273", camera: "Medium", location: "Interior" },
  { label: "Shot 3", action: "Camera / action", color: "#3a6672", camera: "Close", location: "Exterior" },
  { label: "Shot 4", action: "Camera / action", color: "#3e547a", camera: "Tracking", location: "Street" },
  { label: "Shot 5", action: "Camera / action", color: "#625273", camera: "Over shoulder", location: "Interior" },
  { label: "Shot 6", action: "Camera / action", color: "#3a6672", camera: "Static", location: "Exterior" },
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
  { href: "/projects", label: "Projects" },
  { href: "/director", label: "Director" },
  { href: "/characters", label: "Characters" },
  { href: "/capture", label: "Capture" },
  { href: "/storyboard", label: "Storyboard" },
  { href: "/edit", label: "Edit" },
  { href: "/audio", label: "Audio" },
  { href: "/export", label: "Export" },
  { href: "/connectors", label: "Connectors" },
] as const;

function defaultPlan(): PlanItem[] {
  return PLAN_LABELS.map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    detail: "",
  }));
}

function shotsFor(projectId: string): ShotRecord[] {
  return SHOT_TEMPLATES.map((template, index) => ({
    ...template,
    id: `${projectId}-shot-${index + 1}`,
    projectId,
  }));
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

const STARTER_CHARACTERS: CharacterRecord[] = [
  { id: "max", projectId: "p1", name: "Max", color: "#324e78", look: "3D", voice: "Unassigned", wardrobe: "Street", dna: "", appearance: "", animationStyle: "Unassigned", sceneIds: [] },
  { id: "bella", projectId: "p1", name: "Bella", color: "#714b65", look: "3D", voice: "Unassigned", wardrobe: "Coat", dna: "", appearance: "", animationStyle: "Unassigned", sceneIds: [] },
  { id: "rocky", projectId: "p1", name: "Rocky", color: "#3a6c73", look: "2D", voice: "Unassigned", wardrobe: "Work", dna: "", appearance: "", animationStyle: "Unassigned", sceneIds: [] },
  { id: "luna", projectId: "p1", name: "Luna", color: "#685b8b", look: "3D", voice: "Unassigned", wardrobe: "Night", dna: "", appearance: "", animationStyle: "Unassigned", sceneIds: [] },
  { id: "sam", projectId: "p1", name: "Sam", color: "#75624b", look: "2D", voice: "Unassigned", wardrobe: "Casual", dna: "", appearance: "", animationStyle: "Unassigned", sceneIds: [] },
];

const INITIAL: StudioState = {
  theme: "night",
  projects: [blankProject("p1", "Untitled production", "Feature", "Make the scene more cinematic.")],
  activeProjectId: "p1",
  notices: [{ id: "n1", text: "Saved on this device. No cloud service is connected." }],
  accountName: "Studio account",
  characters: STARTER_CHARACTERS,
  selectedCharacterId: "max",
  editorOpen: false,
  shots: shotsFor("p1"),
  selectedShotId: "p1-shot-1",
  selectedAudioTrack: "Dialogue",
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
  const shots = storedShots.length > 0 ? storedShots.map((shot) => ({ ...shot, projectId: shot.projectId && projectIds.has(shot.projectId) ? shot.projectId : activeProjectId })) : [];
  for (const project of projects) {
    if (!shots.some((shot) => shot.projectId === project.id)) shots.push(...shotsFor(project.id));
  }

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
  return {
    theme,
    projects,
    activeProjectId,
    notices: Array.isArray(stored.notices) && stored.notices.length > 0 ? stored.notices : base.notices,
    accountName: stored.accountName || base.accountName,
    characters,
    selectedCharacterId: stored.selectedCharacterId || base.selectedCharacterId,
    editorOpen: Boolean(stored.editorOpen),
    shots,
    selectedShotId: stored.selectedShotId || shots.find((shot) => shot.projectId === activeProjectId)?.id || "",
    selectedAudioTrack: stored.selectedAudioTrack || "Dialogue",
    jobs,
    selectedConnectorId: CONNECTORS.some((connector) => connector.id === stored.selectedConnectorId) ? stored.selectedConnectorId || "blender" : "blender",
    connectorFilter: stored.connectorFilter || "All",
  };
}

type StudioContextValue = {
  ready: boolean;
  theme: ThemeName;
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
  updateShot: (id: string, patch: Partial<Pick<ShotRecord, "label" | "action" | "camera" | "location">>) => void;
  setSelectedAudioTrack: (track: string) => void;
  recordLocalExport: () => void;
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
    const jobs = state.jobs.filter((job) => job.projectId === activeProject.id);
    const selectedCharacter = characters.find((character) => character.id === state.selectedCharacterId) ?? characters[0];
    const selectedShot = shots.find((shot) => shot.id === state.selectedShotId) ?? shots[0];

    function updateActive(patch: Partial<ProjectRecord>) {
      setState((current) => ({
        ...current,
        projects: current.projects.map((project) => (project.id === current.activeProjectId ? { ...project, ...patch } : project)),
      }));
    }

    return {
      ready,
      theme: state.theme,
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
      setActiveProjectId: (id) => setState((current) => ({ ...current, activeProjectId: id, editorOpen: false })),
      setStatus: (status) => updateActive({ status }),
      setAccountName: (name) => setState((current) => ({ ...current, accountName: name })),
      createProject: (description) => {
        const title = description.trim();
        if (!title) return "Describe a film before creating a production.";
        const id = crypto.randomUUID();
        setState((current) => ({
          ...current,
          projects: [blankProject(id, title, "Draft", title), ...current.projects],
          activeProjectId: id,
          shots: [...shotsFor(id), ...current.shots],
          jobs: [...sampleJobs(id), ...current.jobs],
          editorOpen: false,
          notices: withNotice(current.notices, `“${title}” is saved on this device only.`),
        }));
        return null;
      },
      updateProject: (id, patch) =>
        setState((current) => ({
          ...current,
          projects: current.projects.map((project) => (project.id === id ? { ...project, ...patch } : project)),
        })),
      deleteProject: (id) =>
        setState((current) => {
          const removed = current.projects.find((project) => project.id === id);
          let projects = current.projects.filter((project) => project.id !== id);
          let shotsForState = current.shots.filter((shot) => shot.projectId !== id);
          let jobsForState = current.jobs.filter((job) => job.projectId !== id);
          if (projects.length === 0) {
            const replacementId = crypto.randomUUID();
            projects = [blankProject(replacementId, "Untitled production", "Feature")];
            shotsForState = shotsFor(replacementId);
            jobsForState = sampleJobs(replacementId);
          }
          const activeProjectId = projects.some((project) => project.id === current.activeProjectId) ? current.activeProjectId : projects[0].id;
          return {
            ...current,
            projects,
            shots: shotsForState,
            jobs: jobsForState,
            characters: current.characters.filter((character) => character.projectId !== id),
            activeProjectId,
            editorOpen: false,
            notices: withNotice(current.notices, `“${removed?.title ?? "Project"}” was deleted from this device.`),
          };
        }),
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
      selectCharacter: (id) => setState((current) => ({ ...current, selectedCharacterId: id })),
      openCharacter: (id) => setState((current) => ({ ...current, selectedCharacterId: id, editorOpen: true })),
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
        setState((current) => ({
          ...current,
          characters: current.characters.filter((character) => character.id !== id),
          editorOpen: current.selectedCharacterId === id ? false : current.editorOpen,
          notices: withNotice(current.notices, "Character deleted from this project on this device."),
        })),
      selectShot: (id) => setState((current) => ({ ...current, selectedShotId: id })),
      updateShot: (id, patch) =>
        setState((current) => ({
          ...current,
          shots: current.shots.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)),
        })),
      setSelectedAudioTrack: (track) => setState((current) => ({ ...current, selectedAudioTrack: track })),
      recordLocalExport: () =>
        setState((current) => ({
          ...current,
          jobs: [
            { id: crypto.randomUUID(), projectId: current.activeProjectId, label: "Export request", state: "Recorded locally", sample: false },
            ...current.jobs,
          ],
          notices: withNotice(current.notices, "Export was recorded on this device. No renderer was started."),
        })),
      selectConnector: (id) => setState((current) => ({ ...current, selectedConnectorId: id })),
      setConnectorFilter: (filter) => setState((current) => ({ ...current, connectorFilter: filter })),
    };
  }, [ready, state]);

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio must be used inside StudioProvider");
  return value;
}

export { ANIMATION_STYLES };
