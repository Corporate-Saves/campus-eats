import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Browsers often request /favicon.ico by default; we ship SVG as the icon.
        { source: "/favicon.ico", destination: "/favicon.svg" },
      ],
    };
  },
};

export default nextConfig;
