import type { NextConfig } from "next";

// Local authoring tool only — never deployed.
const nextConfig: NextConfig = {
  transpilePackages: ["@mystery/shared"],
};

export default nextConfig;
