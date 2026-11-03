import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone build (traced deps + a
  // minimal server.js) so the Docker runtime image doesn't need node_modules.
  output: "standalone",
  // Dev only: lets the dashboard be opened from this Mac's LAN address
  // (also used by the mobile app) without Next blocking HMR/dev chunks.
  allowedDevOrigins: ["192.168.0.136", "192.168.8.101"],
  // The firm's public web form: never indexed or cached, and its address
  // (the firm's link) is not sent on to other sites.
  async headers() {
    return [
      {
        source: "/f/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
