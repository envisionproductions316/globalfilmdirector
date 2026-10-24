/**
 * Versioned project + media backup helpers (client-side assembly).
 * Format: gfd-backup-v1 — JSON manifest + base64 media entries (or Electron file write).
 */

export const BACKUP_FORMAT = "gfd-backup-v1" as const;

export type BackupMediaEntry = {
  id: string;
  projectId: string;
  takeId: string;
  mime: string;
  bytes: number;
  createdAt: string;
  /** base64 of blob bytes */
  dataBase64: string;
};

export type StudioBackup = {
  format: typeof BACKUP_FORMAT;
  createdAt: string;
  appVersion: string;
  studio: unknown;
  media: BackupMediaEntry[];
};

export function validateBackup(raw: unknown): { ok: true; backup: StudioBackup } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Backup file is not valid JSON." };
  const data = raw as Record<string, unknown>;
  if (data.format !== BACKUP_FORMAT) return { ok: false, error: `Unsupported backup format (${String(data.format)}). Expected ${BACKUP_FORMAT}.` };
  if (typeof data.createdAt !== "string") return { ok: false, error: "Backup is missing createdAt." };
  if (!("studio" in data) || data.studio === null || typeof data.studio !== "object") {
    return { ok: false, error: "Backup is missing studio project data." };
  }
  if (!Array.isArray(data.media)) return { ok: false, error: "Backup is missing a media array." };
  for (const item of data.media) {
    if (!item || typeof item !== "object") return { ok: false, error: "Backup media entry is invalid." };
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== "string" || typeof entry.dataBase64 !== "string") {
      return { ok: false, error: "Backup media entry is missing id or data." };
    }
  }
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      createdAt: data.createdAt,
      appVersion: typeof data.appVersion === "string" ? data.appVersion : "0.1.0",
      studio: data.studio,
      media: data.media as BackupMediaEntry[],
    },
  };
}

/**
 * Strip accidental auth/token fields from studio JSON before writing a backup.
 * Tokens live in httpOnly cookies / Electron safeStorage — never in gfd-backup-v1.
 */
export function scrubAuthFromStudioSnapshot(studio: unknown): unknown {
  if (!studio || typeof studio !== "object") return studio;
  const clone = structuredClone(studio) as Record<string, unknown>;
  const banned = ["accessToken", "refreshToken", "idToken", "password", "clientSecret", "authTokens", "sessionToken"];
  for (const key of banned) delete clone[key];
  if (clone.auth && typeof clone.auth === "object") {
    const auth = clone.auth as Record<string, unknown>;
    for (const key of banned) delete auth[key];
  }
  return clone;
}

export async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBlob(base64: string, mime: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || "application/octet-stream" });
}
