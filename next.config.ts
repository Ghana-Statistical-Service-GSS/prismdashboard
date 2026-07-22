import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone build (traced deps + a
  // minimal server.js) so the Docker runtime image doesn't need node_modules.
  output: "standalone",
};

export default nextConfig;
