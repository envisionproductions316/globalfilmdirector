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

export type ProjectRecord = {
  id: string;
  title: string;
  kind: string;
};

export type CharacterRecord = {
  id: string;
  name: string;
  color: string;
  look: "2D" | "3D";
  voice: string;
  wardrobe: string;
};

export type Notice = {
  id: string;
  text: string;
};

type StudioState = {
  theme: ThemeName;
  projects: ProjectRecord[];
  activeProjectId: string;
  status: ProductionStatus;
  notices: Notice[];
  accountName: string;
  characters: CharacterRecord[];
  selectedCharacterId: string;
  directorNote: string;
  planApproved: boolean;
};

const STORAGE_KEY = "gfd.studio.v1";

const STARTER_CHARACTERS: CharacterRecord[] = [
  { id: "max", name: "Max", color: "#324e78", look: "3D", voice: "Unassigned", wardrobe: "Street" },
  { id: "bella", name: "Bella", color: "#714b65", look: "3D", voice: "Unassigned", wardrobe: "Coat" },
  { id: "rocky", name: "Rocky", color: "#3a6c73", look: "2D", voice: "Unassigned", wardrobe: "Work" },
  { id: "luna", name: "Luna", color: "#685b8b", look: "3D", voice: "Unassigned", wardrobe: "Night" },
  { id: "sam", name: "Sam", color: "#75624b", look: "2D", voice: "Unassigned", wardrobe: "Casual" },
];

const INITIAL: StudioState = {
  theme: "night",
  projects: [{ id: "p1", title: "Untitled production", kind: "Feature" }],
  activeProjectId: "p1",
  status: "Draft",
  notices: [{ id: "n1", text: "Saved on this device. No cloud service is connected." }],
  accountName: "Studio account",
  characters: STARTER_CHARACTERS,
  selectedCharacterId: "max",
  directorNote: "Make the scene more cinematic.",
  planApproved: false,
};

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

type StudioContextValue = StudioState & {
  ready: boolean;
  activeProject: ProjectRecord;
  selectedCharacter: CharacterRecord;
  setTheme: (theme: ThemeName) => void;
  setActiveProjectId: (id: string) => void;
  setStatus: (status: ProductionStatus) => void;
  setAccountName: (name: string) => void;
  createProject: (description: string) => string | null;
  setDirectorNote: (note: string) => void;
  saveDirection: () => void;
  approvePlan: () => void;
  selectCharacter: (id: string) => void;
  updateCharacter: (id: string, patch: Partial<CharacterRecord>) => void;
  addCharacter: (name: string) => void;
};

const StudioContext = createContext<StudioContextValue | null>(null);

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudioState>(INITIAL);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<StudioState>;
        setState((current) => ({ ...current, ...stored }));
        if (stored.theme) applyTheme(stored.theme);
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
    const selectedCharacter =
      state.characters.find((character) => character.id === state.selectedCharacterId) ?? state.characters[0];

    function pushNotice(text: string) {
      setState((current) => ({
        ...current,
        notices: [{ id: crypto.randomUUID(), text }, ...current.notices].slice(0, 8),
      }));
    }

    return {
      ...state,
      ready,
      activeProject,
      selectedCharacter,
      setTheme: (theme) => setState((current) => ({ ...current, theme })),
      setActiveProjectId: (id) => setState((current) => ({ ...current, activeProjectId: id })),
      setStatus: (status) => setState((current) => ({ ...current, status })),
      setAccountName: (name) => setState((current) => ({ ...current, accountName: name })),
      createProject: (description) => {
        const title = description.trim();
        if (!title) return "Describe a film before creating a production.";
        const id = crypto.randomUUID();
        setState((current) => ({
          ...current,
          projects: [{ id, title, kind: "Draft" }, ...current.projects],
          activeProjectId: id,
          status: "Draft",
          planApproved: false,
          notices: [{ id: crypto.randomUUID(), text: `“${title}” is saved on this device only.` }, ...current.notices].slice(0, 8),
        }));
        return null;
      },
      setDirectorNote: (note) => setState((current) => ({ ...current, directorNote: note })),
      saveDirection: () => pushNotice("Direction saved on this device. No assistant service was called."),
      approvePlan: () =>
        setState((current) => ({
          ...current,
          planApproved: true,
          status: "Approved",
          notices: [{ id: crypto.randomUUID(), text: "Production plan approved on this device." }, ...current.notices].slice(0, 8),
        })),
      selectCharacter: (id) => setState((current) => ({ ...current, selectedCharacterId: id })),
      updateCharacter: (id, patch) =>
        setState((current) => ({
          ...current,
          characters: current.characters.map((character) => (character.id === id ? { ...character, ...patch } : character)),
        })),
      addCharacter: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const id = crypto.randomUUID();
        setState((current) => ({
          ...current,
          characters: [
            ...current.characters,
            { id, name: trimmed, color: "#405d84", look: "3D", voice: "Unassigned", wardrobe: "Unset" },
          ],
          selectedCharacterId: id,
        }));
      },
    };
  }, [ready, state]);

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio must be used inside StudioProvider");
  return value;
}
