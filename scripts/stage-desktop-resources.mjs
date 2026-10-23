/**
 * Stage Next standalone (+ static + public + ffmpeg) for electron-builder.
 * electron-builder's default FileSet can omit node_modules from extraResources;
 * this script copies the full tree explicitly and strips absolute build-machine paths.
 */
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
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stage = path.join(root, "build", "desktop-resources");
const standaloneSrc = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const publicSrc = path.join(root, "public");
const ffmpegSrc = path.join(root, "resources", "ffmpeg");

function samePath(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return path.resolve(a) === path.resolve(b);
  }
}

function mirror(src, dest) {
  if (!existsSync(src)) return;
  if (existsSync(dest) && samePath(src, dest)) return;
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
}

if (!existsSync(path.join(standaloneSrc, "server.js"))) {
  console.error("Missing .next/standalone/server.js — run npm run build first.");
  process.exit(1);
}

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

const standaloneDest = path.join(stage, "app", ".next", "standalone");
cpSync(standaloneSrc, standaloneDest, { recursive: true });

/**
 * ensure-next-cache.mjs junctions project `.next` → %LOCALAPPDATA%/globalfilmdirector-next.
 * Next's standalone/.next is often that same junction. Packaging must materialize real files
 * or the desktop app keeps depending on the developer machine's AppData build.
 */
function materializeStandaloneNext(standaloneRoot) {
  const nextDir = path.join(standaloneRoot, ".next");
  if (!existsSync(nextDir)) return { materialized: false };

  let real = nextDir;
  try {
    real = realpathSync(nextDir);
  } catch {
    return { materialized: false };
  }

  const isLink = (() => {
    try {
      return lstatSync(nextDir).isSymbolicLink() || path.resolve(real) !== path.resolve(nextDir);
    } catch {
      return false;
    }
  })();

  if (isLink) {
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
      if (!existsSync(src)) continue;
      cpSync(src, path.join(nextDir, name), { recursive: true, dereference: true });
    }
    return { materialized: true, from: real };
  }

  const nestedStandalone = path.join(nextDir, "standalone");
  if (existsSync(nestedStandalone)) {
    rmSync(nestedStandalone, { recursive: true, force: true });
  }
  return { materialized: false };
}

const materializeResult = materializeStandaloneNext(standaloneDest);

/** Next webpack-runtime requires `./{id}.js` next to itself; builds often only emit `chunks/{id}.js`. */
function flattenServerChunks(standaloneRoot) {
  const serverDir = path.join(standaloneRoot, ".next", "server");
  const chunksDir = path.join(serverDir, "chunks");
  if (!existsSync(chunksDir)) return { flattened: 0 };
  let flattened = 0;
  for (const name of readdirSync(chunksDir)) {
    if (!name.endsWith(".js")) continue;
    const dest = path.join(serverDir, name);
    if (existsSync(dest)) continue;
    cpSync(path.join(chunksDir, name), dest);
    flattened += 1;
  }
  const vendorDir = path.join(serverDir, "vendor-chunks");
  if (existsSync(vendorDir)) {
    for (const name of readdirSync(vendorDir)) {
      if (!name.endsWith(".js")) continue;
      const dest = path.join(serverDir, name);
      if (existsSync(dest)) continue;
      cpSync(path.join(vendorDir, name), dest);
      flattened += 1;
    }
  }
  return { flattened };
}

const flattenResult = flattenServerChunks(standaloneDest);

mirror(staticSrc, path.join(stage, "app", ".next", "static"));
mirror(staticSrc, path.join(standaloneDest, ".next", "static"));
mirror(publicSrc, path.join(stage, "app", "public"));
mirror(publicSrc, path.join(standaloneDest, "public"));
if (existsSync(path.join(ffmpegSrc, "ffmpeg.exe")) || existsSync(path.join(ffmpegSrc, "ffmpeg"))) {
  mirror(ffmpegSrc, path.join(stage, "ffmpeg"));
} else {
  mkdirSync(path.join(stage, "ffmpeg"), { recursive: true });
  mirror(path.join(ffmpegSrc, "README.md"), path.join(stage, "ffmpeg", "README.md"));
}

/** Remove machine-absolute paths so packaged Next resolves relative to standalone. */
function neutralizeAbsolutePaths(standaloneRoot) {
  const rootNormalized = root.replace(/\\/g, "\\\\");
  const rsfPath = path.join(standaloneRoot, ".next", "required-server-files.json");
  if (existsSync(rsfPath)) {
    const rsf = JSON.parse(readFileSync(rsfPath, "utf8"));
    rsf.appDir = ".";
    rsf.relativeAppDir = ".";
    if (rsf.config) {
      rsf.config.outputFileTracingRoot = ".";
      if (rsf.config.turbopack) rsf.config.turbopack.root = ".";
    }
    writeFileSync(rsfPath, JSON.stringify(rsf));
  }
  const serverJs = path.join(standaloneRoot, "server.js");
  if (existsSync(serverJs)) {
    let text = readFileSync(serverJs, "utf8");
    text = text.split(root).join(".");
    text = text.split(rootNormalized).join(".");
    writeFileSync(serverJs, text);
  }
}

neutralizeAbsolutePaths(standaloneDest);

// Prevent Next from walking up into the developer repo (or any parent) for next.config / distDir.
writeFileSync(
  path.join(standaloneDest, "next.config.mjs"),
  `/** Generated for Electron packaging — keep distDir local to this standalone folder. */\nconst nextConfig = { distDir: ".next" };\nexport default nextConfig;\n`,
);
const standalonePkgPath = path.join(standaloneDest, "package.json");
if (existsSync(standalonePkgPath)) {
  try {
    const pkg = JSON.parse(readFileSync(standalonePkgPath, "utf8"));
    pkg.private = true;
    pkg.name = pkg.name || "global-film-director-standalone";
    writeFileSync(standalonePkgPath, JSON.stringify(pkg, null, 2));
  } catch {
    /* keep existing package.json */
  }
} else {
  writeFileSync(
    standalonePkgPath,
    JSON.stringify({ name: "global-film-director-standalone", private: true, version: "0.1.0" }, null, 2),
  );
}

const nm = path.join(standaloneDest, "node_modules", "next");
if (!existsSync(nm)) {
  console.error("Staging failed: next package missing under standalone node_modules.");
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    stage,
    standaloneHasNext: true,
    pathsNeutralized: true,
    nextMaterialized: materializeResult,
    chunksFlattened: flattenResult,
  }),
);
