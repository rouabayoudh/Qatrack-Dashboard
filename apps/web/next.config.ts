import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to serve static assets to non-localhost hosts
  // (e.g. when accessing the app from another device via the LAN IP).
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.100", "192.168.137.1"],
  // Enable standalone output for Docker production builds
  output: "standalone",
};

export default nextConfig;
