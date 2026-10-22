import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const link = path.join(root, ".next");
const target = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), ".cache"), "globalfilmdirector-next");

mkdirSync(target, { recursive: true });

function currentTarget() {
  try {
    return path.resolve(readlinkSync(link));
  } catch {
    return "";
  }
}

if (existsSync(link)) {
  if (currentTarget() === path.resolve(target)) {
    process.exit(0);
  }
  const stat = lstatSync(link);
  if (stat.isDirectory() && !currentTarget()) {
    rmSync(link, { recursive: true, force: true });
  } else {
    rmSync(link, { recursive: true, force: true });
  }
}

if (process.platform === "win32") {
  execFileSync("cmd", ["/c", "mklink", "/J", link, target], { stdio: "inherit" });
} else {
  execFileSync("ln", ["-s", target, link], { stdio: "inherit" });
}
