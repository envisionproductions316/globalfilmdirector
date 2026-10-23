import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const server = path.join(standalone, "server.js");

if (!existsSync(server)) {
  console.error("Production build is missing. Run: npm run build");
  process.exit(1);
}

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

mirror(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
mirror(path.join(root, "public"), path.join(standalone, "public"));

const host = process.env.HOST || process.env.HOSTNAME || "127.0.0.1";
const port = process.env.PORT || "5180";

console.log(`Starting Global Film Director (standalone) on http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`);

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  cwd: standalone,
  env: {
    ...process.env,
    HOSTNAME: host,
    PORT: String(port),
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
