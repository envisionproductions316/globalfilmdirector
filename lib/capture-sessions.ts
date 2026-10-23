import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

export type CaptureSessionMeta = {
  code: string;
  projectId: string;
  characterId: string;
  characterName: string;
  sceneId: string;
  shotId: string;
  createdAt: number;
  expiresAt: number;
};

export type PendingPhoneTake = {
  id: string;
  projectId?: string;
  mime: string;
  bytes: number;
  durationMs: number;
  hasAudio: boolean;
  hasVideo: boolean;
  name: string;
  dialogue: string;
  notes: string;
  createdAt: number;
};

type SessionRecord = CaptureSessionMeta & {
  pending: PendingPhoneTake | null;
  buffer: Buffer | null;
};

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_BYTES = 80 * 1024 * 1024;

const globalStore = globalThis as typeof globalThis & {
  __gfdCaptureSessions?: Map<string, SessionRecord>;
  __gfdCaptureHydrated?: boolean;
};

function dataDir() {
  const root = process.env.GFD_DATA_DIR || path.join(tmpdir(), "gfd-capture-data");
  const dir = path.join(root, "capture-sessions");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function metaPath(code: string) {
  return path.join(dataDir(), `${code}.json`);
}

function binPath(code: string) {
  return path.join(dataDir(), `${code}.bin`);
}

function store() {
  if (!globalStore.__gfdCaptureSessions) globalStore.__gfdCaptureSessions = new Map();
  return globalStore.__gfdCaptureSessions;
}

function persist(session: SessionRecord) {
  const meta = {
    code: session.code,
    projectId: session.projectId,
    characterId: session.characterId,
    characterName: session.characterName,
    sceneId: session.sceneId,
    shotId: session.shotId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    pending: session.pending,
  };
  writeFileSync(metaPath(session.code), JSON.stringify(meta), "utf8");
  if (session.buffer && session.pending) writeFileSync(binPath(session.code), session.buffer);
  else if (existsSync(binPath(session.code))) unlinkSync(binPath(session.code));
}

function removePersisted(code: string) {
  for (const file of [metaPath(code), binPath(code)]) {
    if (existsSync(file)) unlinkSync(file);
  }
}

function hydrateFromDisk() {
  if (globalStore.__gfdCaptureHydrated) return;
  globalStore.__gfdCaptureHydrated = true;
  const dir = dataDir();
  if (!existsSync(dir)) return;
  const now = Date.now();
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(readFileSync(path.join(dir, name), "utf8")) as SessionRecord;
      if (!raw?.code || raw.expiresAt < now) {
        removePersisted(String(raw?.code || name.replace(/\.json$/, "")));
        continue;
      }
      let buffer: Buffer | null = null;
      if (raw.pending && existsSync(binPath(raw.code))) buffer = readFileSync(binPath(raw.code));
      store().set(raw.code, { ...raw, buffer });
    } catch {
      /* skip corrupt session files */
    }
  }
}

function prune() {
  hydrateFromDisk();
  const now = Date.now();
  for (const [code, session] of store()) {
    if (session.expiresAt < now) {
      store().delete(code);
      removePersisted(code);
    }
  }
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function createCaptureSession(input: {
  projectId: string;
  characterId: string;
  characterName: string;
  sceneId: string;
  shotId: string;
}): CaptureSessionMeta {
  prune();
  let code = makeCode();
  while (store().has(code)) code = makeCode();
  const now = Date.now();
  const session: SessionRecord = {
    code,
    projectId: input.projectId,
    characterId: input.characterId,
    characterName: input.characterName,
    sceneId: input.sceneId,
    shotId: input.shotId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    pending: null,
    buffer: null,
  };
  store().set(code, session);
  persist(session);
  return {
    code: session.code,
    projectId: session.projectId,
    characterId: session.characterId,
    characterName: session.characterName,
    sceneId: session.sceneId,
    shotId: session.shotId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

export function getCaptureSession(code: string): CaptureSessionMeta | null {
  prune();
  const session = store().get(code.toUpperCase());
  if (!session) return null;
  return {
    code: session.code,
    projectId: session.projectId,
    characterId: session.characterId,
    characterName: session.characterName,
    sceneId: session.sceneId,
    shotId: session.shotId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

export function getPendingTake(code: string): PendingPhoneTake | null {
  prune();
  return store().get(code.toUpperCase())?.pending ?? null;
}

export function putPhoneTake(
  code: string,
  input: {
    buffer: Buffer;
    mime: string;
    durationMs: number;
    hasAudio: boolean;
    hasVideo: boolean;
    name: string;
    dialogue: string;
    notes: string;
  },
): PendingPhoneTake | { error: string } {
  prune();
  const session = store().get(code.toUpperCase());
  if (!session) return { error: "Session not found or expired." };
  if (input.buffer.byteLength > MAX_BYTES) return { error: "Take is too large (80MB max)." };
  const pending: PendingPhoneTake = {
    id: crypto.randomUUID(),
    projectId: session.projectId,
    mime: input.mime || "video/webm",
    bytes: input.buffer.byteLength,
    durationMs: Math.max(0, input.durationMs),
    hasAudio: input.hasAudio,
    hasVideo: input.hasVideo !== false,
    name: input.name || "Phone take",
    dialogue: input.dialogue || "",
    notes: input.notes || "",
    createdAt: Date.now(),
  };
  session.pending = pending;
  session.buffer = input.buffer;
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  persist(session);
  return pending;
}

export function takePhoneMedia(code: string, takeId: string): { mime: string; buffer: Buffer } | null {
  prune();
  const session = store().get(code.toUpperCase());
  if (!session?.pending || session.pending.id !== takeId || !session.buffer) return null;
  return { mime: session.pending.mime, buffer: session.buffer };
}

export function clearPendingTake(code: string, takeId: string): boolean {
  const session = store().get(code.toUpperCase());
  if (!session?.pending || session.pending.id !== takeId) return false;
  session.pending = null;
  session.buffer = null;
  persist(session);
  return true;
}
