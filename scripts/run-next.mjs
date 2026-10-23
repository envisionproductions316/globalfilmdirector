import { spawn } from "node:child_process";
import path from "node:path";

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const args = process.argv.slice(2);
const command = args[0] || "";

function hasOption(name) {
  const flag = `--${name}`;
  return args.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
}

const nextArgs = [...args];
if (command === "dev" || command === "start") {
  // Default local-safe bind; set HOST=0.0.0.0 for LAN/Docker.
  if (!hasOption("hostname")) {
    nextArgs.push("--hostname", process.env.HOST || process.env.HOSTNAME || "127.0.0.1");
  }
  if (!hasOption("port")) {
    nextArgs.push("--port", process.env.PORT || "5180");
  }
}

const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_PATH: path.join(process.cwd(), "node_modules"),
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
