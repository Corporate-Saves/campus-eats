import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        /* Prefer --tenant-primary via @theme in globals.css; fallback for tooling */
        primary: "var(--tenant-primary, #FF6B35)",
        background: "#FAFAF8",
        surface: "#FFFFFF",
        text: "#1A1A1A",
        muted: "#6B7280",
      },
    },
  },
};

export default config;
