export type GfdDesktopApi = {
  isDesktop: true;
  getInfo: () => Promise<{ desktop: boolean; version: string; userData: string; port: number }>;
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
  writeFile: (payload: { path: string; base64: string }) => Promise<{ ok?: boolean; path?: string; error?: string }>;
  readFile: (target: string) => Promise<{ ok?: boolean; base64?: string; bytes?: number; error?: string }>;
};

export function getDesktopApi(): GfdDesktopApi | null {
  if (typeof window === "undefined") return null;
  const api = (window as Window & { gfdDesktop?: GfdDesktopApi }).gfdDesktop;
  return api?.isDesktop ? api : null;
}
