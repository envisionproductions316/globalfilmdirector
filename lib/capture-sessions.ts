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
};

function store() {
  if (!globalStore.__gfdCaptureSessions) globalStore.__gfdCaptureSessions = new Map();
  return globalStore.__gfdCaptureSessions;
}

function prune() {
  const now = Date.now();
  for (const [code, session] of store()) {
    if (session.expiresAt < now) store().delete(code);
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
  return true;
}
