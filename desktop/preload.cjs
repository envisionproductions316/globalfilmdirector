/**
 * Secure preload — expose a minimal, validated API to the renderer.
 * No Node integration; no unrestricted fs/shell.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gfdDesktop", {
  isDesktop: true,
  getInfo: () => ipcRenderer.invoke("gfd:get-info"),
  showOpenDialog: (options) => ipcRenderer.invoke("gfd:show-open-dialog", options || {}),
  showSaveDialog: (options) => ipcRenderer.invoke("gfd:show-save-dialog", options || {}),
  openPath: (target) => ipcRenderer.invoke("gfd:open-path", target),
  openDataDir: () => ipcRenderer.invoke("gfd:open-data-dir"),
  openExternal: (url) => ipcRenderer.invoke("gfd:open-external", url),
  writeFile: (payload) => ipcRenderer.invoke("gfd:write-file", payload),
  readFile: (target) => ipcRenderer.invoke("gfd:read-file", target),
  beginAuth: (options) => ipcRenderer.invoke("gfd:auth-begin", options || {}),
  getAuthSession: () => ipcRenderer.invoke("gfd:auth-session"),
  signOutAuth: () => ipcRenderer.invoke("gfd:auth-sign-out"),
});
