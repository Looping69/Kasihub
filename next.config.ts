import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel manages Next.js output and tracing itself. Standalone output is kept
  // for non-Vercel/self-hosted deployments where scripts/start.mjs uses it.
  ...(process.env.VERCEL === "1" ? {} : { output: "standalone" as const }),
  turbopack: {
    root: process.cwd(),
  },
  // Author: Klaasvaakie ( |╲ )
  // The desktop browser opens the local app through 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  /* config options here */
  reactStrictMode: true,
};

export default nextConfig;
