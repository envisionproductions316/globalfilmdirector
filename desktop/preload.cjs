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
  writeFile: (payload) => ipcRenderer.invoke("gfd:write-file", payload),
  readFile: (target) => ipcRenderer.invoke("gfd:read-file", target),
});
