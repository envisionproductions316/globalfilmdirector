/**
 * Electron main process — Global Film Director desktop shell.
 * Starts the Next.js standalone server locally and opens a secure BrowserWindow.
 */
import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";
import { spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveFfmpegBinaries } from "./ffmpeg-path.mjs";
import { beginDesktopAuth, clearDesktopSession, getDesktopAuthSnapshot } from "./auth.mjs";

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

/** When project `.next` is an AppData junction, standalone/.next may be the same link — materialize real files. */
function materializeStandaloneNext(standalone) {
  const nextDir = path.join(standalone, ".next");
  if (!existsSync(nextDir)) return;
  let real = nextDir;
  try {
    real = realpathSync(nextDir);
  } catch {
    return;
  }
  const linked = (() => {
    try {
      return lstatSync(nextDir).isSymbolicLink() || path.resolve(real) !== path.resolve(nextDir);
    } catch {
      return false;
    }
  })();
  if (!linked) {
    const nested = path.join(nextDir, "standalone");
    if (existsSync(nested)) rmSync(nested, { recursive: true, force: true });
    return;
  }
  rmSync(nextDir, { recursive: true, force: true });
  mkdirSync(nextDir, { recursive: true });
  const keep = [
    "server",
    "static",
    "BUILD_ID",
    "app-build-manifest.json",
    "app-path-routes-manifest.json",
    "build-manifest.json",
    "export-marker.json",
    "fallback-build-manifest.json",
    "images-manifest.json",
    "package.json",
    "prerender-manifest.json",
    "react-loadable-manifest.json",
    "required-server-files.json",
    "routes-manifest.json",
  ];
  for (const name of keep) {
    const src = path.join(real, name);
    if (existsSync(src)) cpSync(src, path.join(nextDir, name), { recursive: true, dereference: true });
  }
}

/** webpack-runtime requires `./{id}.js` beside itself; builds often only emit chunks/{id}.js. */
function flattenServerChunks(standalone) {
  const serverDir = path.join(standalone, ".next", "server");
  const chunksDir = path.join(serverDir, "chunks");
  if (!existsSync(chunksDir)) return;
  for (const name of readdirSync(chunksDir)) {
    if (!name.endsWith(".js")) continue;
    const dest = path.join(serverDir, name);
    if (!existsSync(dest)) cpSync(path.join(chunksDir, name), dest);
  }
}

/** Packaged / junction builds must not keep the developer machine appDir. */
function ensureStandaloneLocalPaths() {
  const standalone = standaloneDir();
  materializeStandaloneNext(standalone);
  flattenServerChunks(standalone);
  const rsfPath = path.join(standalone, ".next", "required-server-files.json");
  if (!existsSync(rsfPath)) return;
  try {
    const rsf = JSON.parse(readFileSync(rsfPath, "utf8"));
    rsf.appDir = standalone;
    rsf.relativeAppDir = ".";
    if (rsf.config) {
      rsf.config.outputFileTracingRoot = standalone;
      if (rsf.config.turbopack) rsf.config.turbopack.root = standalone;
    }
    writeFileSync(rsfPath, JSON.stringify(rsf));
  } catch {
    /* non-fatal — staging may already have neutralized paths */
  }
  const nextConfig = path.join(standalone, "next.config.mjs");
  if (!existsSync(nextConfig)) {
    writeFileSync(
      nextConfig,
      `/** Generated at desktop startup — keep distDir local to standalone. */\nconst nextConfig = { distDir: ".next" };\nexport default nextConfig;\n`,
    );
  }
}

function assertIpcSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error("Desktop API is only available from the Global Film Director window.");
  }
}

function dataDirPath() {
  return path.join(app.getPath("userData"), "gfd-data");
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
  const dataDir = dataDirPath();
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(path.join(dataDir, "capture-sessions"), { recursive: true });
  const tmpDir = path.join(dataDir, "tmp");
  mkdirSync(tmpDir, { recursive: true });
  // Clear stale render temps from previous crashed runs (keep capture-sessions).
  try {
    for (const name of readdirSync(tmpDir)) {
      rmSync(path.join(tmpDir, name), { recursive: true, force: true });
    }
  } catch {
    /* ignore */
  }

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
    GFD_TMP_DIR: tmpDir,
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
  ipcMain.handle("gfd:get-info", (event) => {
    assertIpcSender(event);
    return {
      desktop: true,
      version: app.getVersion(),
      userData: app.getPath("userData"),
      dataDir: dataDirPath(),
      port: serverPort,
    };
  });

  ipcMain.handle("gfd:show-open-dialog", async (event, options = {}) => {
    assertIpcSender(event);
    const allowedProps = new Set(["openFile", "openDirectory", "multiSelections", "treatPackageAsDirectory"]);
    const properties = Array.isArray(options.properties)
      ? options.properties.filter((p) => typeof p === "string" && allowedProps.has(p))
      : ["openFile"];
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: typeof options.title === "string" ? options.title : "Open",
      properties: properties.length ? properties : ["openFile"],
      filters: Array.isArray(options.filters) ? options.filters : undefined,
    });
    if (!result.canceled) {
      for (const filePath of result.filePaths) allowDialogPath(filePath);
    }
    return { canceled: result.canceled, filePaths: result.filePaths };
  });

  ipcMain.handle("gfd:show-save-dialog", async (event, options = {}) => {
    assertIpcSender(event);
    const result = await dialog.showSaveDialog(mainWindow ?? undefined, {
      title: typeof options.title === "string" ? options.title : "Save",
      defaultPath: typeof options.defaultPath === "string" ? options.defaultPath : undefined,
      filters: Array.isArray(options.filters) ? options.filters : undefined,
    });
    if (!result.canceled && result.filePath) allowDialogPath(result.filePath);
    return { canceled: result.canceled, filePath: result.filePath || "" };
  });

  ipcMain.handle("gfd:open-path", async (event, target) => {
    assertIpcSender(event);
    if (typeof target !== "string" || !target.trim()) return { error: "Invalid path." };
    const resolved = path.resolve(target);
    if (!(isUnderDir(resolved, app.getPath("userData")) || isUnderDir(resolved, app.getPath("temp")))) {
      return { error: "That folder is outside the allowed desktop data directories." };
    }
    const err = await shell.openPath(resolved);
    return err ? { error: err } : { ok: true };
  });

  ipcMain.handle("gfd:open-data-dir", async (event) => {
    assertIpcSender(event);
    const dir = dataDirPath();
    mkdirSync(dir, { recursive: true });
    const err = await shell.openPath(dir);
    return err ? { error: err } : { ok: true, path: dir };
  });

  ipcMain.handle("gfd:open-external", async (event, target) => {
    assertIpcSender(event);
    if (typeof target !== "string" || !/^https?:\/\//i.test(target)) {
      return { error: "Only http(s) URLs can be opened." };
    }
    await shell.openExternal(target);
    return { ok: true };
  });

  ipcMain.handle("gfd:auth-begin", async (event, options = {}) => {
    assertIpcSender(event);
    try {
      return await beginDesktopAuth({ mode: options.mode === "signup" ? "signup" : "login" });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Sign-in failed." };
    }
  });

  ipcMain.handle("gfd:auth-session", async (event) => {
    assertIpcSender(event);
    const snapshot = await getDesktopAuthSnapshot();
    const issuer = (process.env.AUTH_ISSUER || process.env.NEXT_PUBLIC_AUTH_ISSUER || "").trim();
    return { ...snapshot, configured: Boolean(issuer) };
  });

  ipcMain.handle("gfd:auth-sign-out", async (event) => {
    assertIpcSender(event);
    await clearDesktopSession();
    return { ok: true };
  });

  ipcMain.handle("gfd:write-file", async (event, payload) => {
    assertIpcSender(event);
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

  ipcMain.handle("gfd:read-file", async (event, target) => {
    assertIpcSender(event);
    if (typeof target !== "string") return { error: "Invalid path." };
    const resolved = path.resolve(target);
    if (!canAccessUserFile(resolved)) {
      return { error: "Read path is not allowed. Choose a file with Open first." };
    }
    try {
      const data = readFileSync(resolved);
      if (data.byteLength > 200 * 1024 * 1024) {
        return { error: "File exceeds the 200MB desktop import limit." };
      }
      return { ok: true, base64: data.toString("base64"), bytes: data.byteLength, name: path.basename(resolved) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Read failed." };
    }
  });
}

async function stopServer() {
  shuttingDown = true;
  const child = serverChild;
  serverChild = null;
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  }
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });

  registerIpc();
  try {
    const { port } = await startNextServer();
    createWindow(port);
  } catch (firstError) {
    await stopServer();
    shuttingDown = false;
    try {
      ensureStandaloneLocalPaths();
      mirrorStaticAssets();
      const { port } = await startNextServer();
      createWindow(port);
      void dialog.showMessageBox({
        type: "warning",
        title: "Global Film Director",
        message: "Desktop recovered after a startup error. If something looks wrong, run npm run build and try again.",
        detail: firstError instanceof Error ? firstError.message : String(firstError),
      });
    } catch (error) {
      dialog.showErrorBox(
        "Global Film Director",
        error instanceof Error ? error.message : "Desktop startup failed. Run npm run build, then npm run desktop.",
      );
      app.quit();
    }
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
