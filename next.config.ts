import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.MAPPING_TARGET === "node" ? { output: "standalone" } : {}),
};

export default nextConfig;
