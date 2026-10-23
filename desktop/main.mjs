/**
 * Electron main process — Global Film Director desktop shell.
 * Starts the Next.js standalone server locally and opens a secure BrowserWindow.
 */
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveFfmpegBinaries } from "./ffmpeg-path.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.GFD_ELECTRON_DEV === "1" || !app.isPackaged;

let mainWindow = null;
let serverChild = null;
let serverPort = 0;
let shuttingDown = false;
/** Paths explicitly chosen via OS dialogs — only these (plus userData/tmp) may be read/written. */
const dialogAllowedPaths = new Set();

const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost"]);

function isUnderDir(target, root) {
  const resolved = path.resolve(target);
  const base = path.resolve(root);
  return resolved === base || resolved.startsWith(base + path.sep);
}

function allowDialogPath(filePath) {
  if (typeof filePath === "string" && filePath.trim()) {
    dialogAllowedPaths.add(path.resolve(filePath));
  }
}

function canAccessUserFile(target) {
  const resolved = path.resolve(target);
  if (dialogAllowedPaths.has(resolved)) return true;
  // App-owned dirs only unless the path was chosen via an OS dialog.
  return isUnderDir(resolved, app.getPath("userData")) || isUnderDir(resolved, app.getPath("temp"));
}

function projectRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, "app");
  return path.resolve(__dirname, "..");
}

function standaloneDir() {
  return path.join(projectRoot(), ".next", "standalone");
}

function mirrorStaticAssets() {
  const root = projectRoot();
  const standalone = standaloneDir();
  const staticSrc = path.join(root, ".next", "static");
  const staticDest = path.join(standalone, ".next", "static");
  const publicSrc = path.join(root, "public");
  const publicDest = path.join(standalone, "public");
  if (existsSync(staticSrc)) {
    mkdirSync(path.dirname(staticDest), { recursive: true });
    cpSync(staticSrc, staticDest, { recursive: true, force: true });
  }
  if (existsSync(publicSrc)) {
    mkdirSync(path.dirname(publicDest), { recursive: true });
    cpSync(publicSrc, publicDest, { recursive: true, force: true });
  }
}

/** Packaged builds must not keep the developer machine appDir from required-server-files.json. */
function ensureStandaloneLocalPaths() {
  const standalone = standaloneDir();
  const rsfPath = path.join(standalone, ".next", "required-server-files.json");
  if (!existsSync(rsfPath)) return;
  try {
    const rsf = JSON.parse(readFileSync(rsfPath, "utf8"));
    if (rsf.appDir === "." || rsf.appDir === standalone) return;
    rsf.appDir = standalone;
    rsf.relativeAppDir = ".";
    if (rsf.config) {
      rsf.config.outputFileTracingRoot = standalone;
      if (rsf.config.turbopack) rsf.config.turbopack.root = standalone;
    }
    writeFileSync(rsfPath, JSON.stringify(rsf));
  } catch {
    /* non-fatal — server may still start if staging already neutralized paths */
  }
}

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
    server.on("error", reject);
  });
}

function waitForServer(port, attempts = 80) {
  return new Promise((resolve, reject) => {
    let left = attempts;
    const tick = () => {
      fetch(`http://127.0.0.1:${port}/projects`)
        .then((response) => {
          if (response.status > 0 && response.status < 500) {
            resolve(true);
            return;
          }
          throw new Error(`status ${response.status}`);
        })
        .catch(() => {
          left -= 1;
          if (left <= 0) reject(new Error("Next.js server did not become ready in time."));
          else setTimeout(tick, 400);
        });
    };
    tick();
  });
}

async function startNextServer() {
  const port = Number(process.env.GFD_PORT) || (await pickFreePort());
  serverPort = port;
  const dataDir = path.join(app.getPath("userData"), "gfd-data");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(path.join(dataDir, "capture-sessions"), { recursive: true });
  mkdirSync(path.join(dataDir, "tmp"), { recursive: true });

  const bins = resolveFfmpegBinaries({
    resourcesPath: process.resourcesPath,
    projectRoot: projectRoot(),
  });

  const env = {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    HOST: "127.0.0.1",
    PORT: String(port),
    GFD_DATA_DIR: dataDir,
    GFD_TMP_DIR: path.join(dataDir, "tmp"),
    GFD_DESKTOP: "1",
  };
  if (bins.ffmpeg) env.GFD_FFMPEG_PATH = bins.ffmpeg;
  if (bins.ffprobe) env.GFD_FFPROBE_PATH = bins.ffprobe;

  if (isDev && process.env.GFD_ELECTRON_USE_DEV_SERVER === "1") {
    const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
      cwd: projectRoot(),
      env: { ...env, PORT: String(port), HOST: "127.0.0.1" },
      stdio: "inherit",
      shell: false,
      windowsHide: true,
    });
    serverChild = child;
    await waitForServer(port);
    return { port, bins };
  }

  const standalone = standaloneDir();
  const serverJs = path.join(standalone, "server.js");
  if (!existsSync(serverJs)) {
    throw new Error("Production build missing. Run: npm run build");
  }
  mirrorStaticAssets();
  ensureStandaloneLocalPaths();

  // Run Next with Electron's Node binary (ELECTRON_RUN_AS_NODE).
  const child = spawn(process.execPath, [serverJs], {
    cwd: standalone,
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "inherit",
    windowsHide: true,
  });
  serverChild = child;
  child.on("exit", (code) => {
    if (!shuttingDown && mainWindow) {
      dialog.showErrorBox("Global Film Director", `The local studio server stopped unexpectedly (code ${code ?? "?"}).`);
    }
  });
  await waitForServer(port);
  return { port, bins };
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Global Film Director",
    show: false,
    backgroundColor: "#0b1220",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (ALLOWED_HOSTS.has(parsed.hostname) && parsed.port === String(serverPort)) {
        return { action: "allow" };
      }
    } catch {
      /* ignore */
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    try {
      const parsed = new URL(url);
      if (!(ALLOWED_HOSTS.has(parsed.hostname) && Number(parsed.port) === serverPort)) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  void mainWindow.loadURL(`http://127.0.0.1:${port}/projects`);
}

function registerIpc() {
  ipcMain.handle("gfd:get-info", () => ({
    desktop: true,
    version: app.getVersion(),
    userData: app.getPath("userData"),
    port: serverPort,
  }));

  ipcMain.handle("gfd:show-open-dialog", async (_event, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: typeof options.title === "string" ? options.title : "Open",
      properties: Array.isArray(options.properties) ? options.properties.filter((p) => typeof p === "string") : ["openFile"],
      filters: Array.isArray(options.filters) ? options.filters : undefined,
    });
    if (!result.canceled) {
      for (const filePath of result.filePaths) allowDialogPath(filePath);
    }
    return { canceled: result.canceled, filePaths: result.filePaths };
  });

  ipcMain.handle("gfd:show-save-dialog", async (_event, options = {}) => {
    const result = await dialog.showSaveDialog(mainWindow ?? undefined, {
      title: typeof options.title === "string" ? options.title : "Save",
      defaultPath: typeof options.defaultPath === "string" ? options.defaultPath : undefined,
      filters: Array.isArray(options.filters) ? options.filters : undefined,
    });
    if (!result.canceled && result.filePath) allowDialogPath(result.filePath);
    return { canceled: result.canceled, filePath: result.filePath || "" };
  });

  ipcMain.handle("gfd:open-path", async (_event, target) => {
    if (typeof target !== "string" || !target.trim()) return { error: "Invalid path." };
    const resolved = path.resolve(target);
    if (!(isUnderDir(resolved, app.getPath("userData")) || isUnderDir(resolved, app.getPath("temp")))) {
      return { error: "That folder is outside the allowed desktop data directories." };
    }
    const err = await shell.openPath(resolved);
    return err ? { error: err } : { ok: true };
  });

  ipcMain.handle("gfd:write-file", async (_event, payload) => {
    if (!payload || typeof payload.path !== "string" || typeof payload.base64 !== "string") {
      return { error: "Invalid write payload." };
    }
    if (payload.base64.length > 400_000_000) {
      return { error: "File payload exceeds the desktop write limit." };
    }
    const resolved = path.resolve(payload.path);
    if (!canAccessUserFile(resolved)) {
      return { error: "Write path is not allowed. Choose a location with Save first." };
    }
    try {
      mkdirSync(path.dirname(resolved), { recursive: true });
      writeFileSync(resolved, Buffer.from(payload.base64, "base64"));
      allowDialogPath(resolved);
      return { ok: true, path: resolved };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Write failed." };
    }
  });

  ipcMain.handle("gfd:read-file", async (_event, target) => {
    if (typeof target !== "string") return { error: "Invalid path." };
    const resolved = path.resolve(target);
    if (!canAccessUserFile(resolved)) {
      return { error: "Read path is not allowed. Choose a file with Open first." };
    }
    try {
      const data = readFileSync(resolved);
      if (data.byteLength > 400_000_000) {
        return { error: "File exceeds the desktop read limit." };
      }
      return { ok: true, base64: data.toString("base64"), bytes: data.byteLength };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Read failed." };
    }
  });
}

async function stopServer() {
  shuttingDown = true;
  if (serverChild && !serverChild.killed) {
    serverChild.kill();
    serverChild = null;
  }
}

app.whenReady().then(async () => {
  registerIpc();
  try {
    const { port } = await startNextServer();
    createWindow(port);
  } catch (error) {
    dialog.showErrorBox("Global Film Director", error instanceof Error ? error.message : "Desktop startup failed.");
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverPort) createWindow(serverPort);
  });
});

app.on("window-all-closed", () => {
  void stopServer().finally(() => {
    if (process.platform !== "darwin") app.quit();
  });
});

app.on("before-quit", () => {
  void stopServer();
});
