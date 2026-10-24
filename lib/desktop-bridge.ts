import type { AuthUser } from "@/lib/auth/types";

export type GfdDesktopApi = {
  isDesktop: true;
  getInfo: () => Promise<{ desktop: boolean; version: string; userData: string; dataDir?: string; port: number }>;
  showOpenDialog: (options?: {
    title?: string;
    properties?: string[];
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<{ canceled: boolean; filePaths: string[] }>;
  showSaveDialog: (options?: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<{ canceled: boolean; filePath: string }>;
  openPath: (target: string) => Promise<{ ok?: boolean; error?: string }>;
  openDataDir: () => Promise<{ ok?: boolean; path?: string; error?: string }>;
  openExternal: (url: string) => Promise<{ ok?: boolean; error?: string }>;
  writeFile: (payload: { path: string; base64: string }) => Promise<{ ok?: boolean; path?: string; error?: string }>;
  readFile: (target: string) => Promise<{ ok?: boolean; base64?: string; bytes?: number; name?: string; error?: string }>;
  beginAuth: (options?: { mode?: "login" | "signup" }) => Promise<{
    session?: { user: AuthUser; expiresAt: number; source: "desktop" };
    error?: string;
  }>;
  getAuthSession: () => Promise<{
    session?: { user: AuthUser; expiresAt: number; source: "desktop" } | null;
    configured?: boolean;
    encryptionAvailable?: boolean;
    error?: string;
  }>;
  signOutAuth: () => Promise<{ ok?: boolean }>;
};

export function getDesktopApi(): GfdDesktopApi | null {
  if (typeof window === "undefined") return null;
  const api = (window as Window & { gfdDesktop?: GfdDesktopApi }).gfdDesktop;
  return api?.isDesktop ? api : null;
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function utf8ToBase64(text: string) {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function base64ToUtf8(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function base64ToUint8(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function guessMimeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".srt") || lower.endsWith(".vtt")) return "text/plain";
  return "application/octet-stream";
}
