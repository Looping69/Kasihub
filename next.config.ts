import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Author: Klaasvaakie ( |╲ )
  // The desktop browser opens the local app through 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  /* config options here */
  reactStrictMode: true,
};

export default nextConfig;
