import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone build (traced deps + a
  // minimal server.js) so the Docker runtime image doesn't need node_modules.
  output: "standalone",
  // Dev only: lets the dashboard be opened from this Mac's LAN address
  // (also used by the mobile app) without Next blocking HMR/dev chunks.
  allowedDevOrigins: ["192.168.0.136"],
};

export default nextConfig;
