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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Force HTTPS on subsequent visits (Fly force_https only upgrades
          // the current request; this makes the browser remember).
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Clickjacking: the session cookie is SameSite=Lax, so a framed
          // GET still carries it. Deny framing entirely.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
