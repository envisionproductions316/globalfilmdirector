import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output is used by Docker / self-host deploys (FFmpeg export needs a Node server).
  output: "standalone",
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
};

export default nextConfig;
