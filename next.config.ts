import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // The "N" dev badge sat bottom-left over the sidebar and composer. Build errors still show.
  devIndicators: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
