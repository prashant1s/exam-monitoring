import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // argon2 ships native bindings — keep it out of the server bundle and
  // require()'d directly at runtime instead (needed for Vercel/serverless).
  serverExternalPackages: ["argon2"],
};

export default nextConfig;
