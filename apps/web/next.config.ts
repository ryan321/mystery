import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mystery/shared"],
  // Slim self-contained server for the Fly image (Dockerfile.web).
  output: "standalone",
  async redirects() {
    // Pre-rebrand URLs ("the shelf" → "the gallery").
    return [
      { source: "/shelf", destination: "/gallery", permanent: true },
    ];
  },
};

export default nextConfig;
