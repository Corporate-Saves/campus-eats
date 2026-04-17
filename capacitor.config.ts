import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.campuseats.mobile",
  appName: "CampusEats",
  webDir: "out",
  server: {
    androidScheme: "https",
    // Load deployed Next app when present (App Router API routes cannot ship inside static `out/`).
    ...(process.env.CAPACITOR_SERVER_URL
      ? { url: process.env.CAPACITOR_SERVER_URL }
      : {}),
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
    },
    StatusBar: {
      style: "DARK",
    },
  },
};

export default config;
