import type { NextConfig } from "next";
import { validateEnv } from "./src/lib/env";

// Validate required environment variables at build/boot time.
// next.config.ts is always server-only — no risk of client bundle leaks.
validateEnv();

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
