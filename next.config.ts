import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Mobile static bundle. Fails while `src/app/api` exists — use `CAPACITOR_SERVER_URL` + normal `next build` or split API. */
const capacitorStatic = process.env.CAPACITOR_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(capacitorStatic
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        turbopack: {
          root: __dirname,
        },
      }),
  async rewrites() {
    if (capacitorStatic) {
      return { beforeFiles: [] };
    }
    return {
      beforeFiles: [
        {
          source: "/favicon.ico",
          destination: "/favicon.svg",
        },
      ],
    };
  },
};

export default nextConfig;
