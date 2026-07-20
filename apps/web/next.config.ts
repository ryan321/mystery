import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mystery/shared"],
  async redirects() {
    // Pre-rebrand URLs ("the shelf" → "the gallery").
    return [
      { source: "/shelf", destination: "/gallery", permanent: true },
    ];
  },
};

export default nextConfig;
