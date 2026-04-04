"use client";

import { useEffect, type ReactNode } from "react";
import { TenantContextProvider, useTenant } from "@/context/TenantContext";

const DEFAULT_PRIMARY = "#FF6B35";

function TenantPrimaryColorSync() {
  const { institution } = useTenant();

  useEffect(() => {
    if (!institution?.primary_color) {
      return;
    }
    const color = institution.primary_color.trim();
    document.documentElement.style.setProperty("--tenant-primary", color);
    return () => {
      document.documentElement.style.setProperty(
        "--tenant-primary",
        DEFAULT_PRIMARY,
      );
    };
  }, [institution?.primary_color]);

  return null;
}

/**
 * Wraps the app with tenant context and syncs institution primary color to
 * `--tenant-primary` on the document root (mapped to Tailwind `primary` in globals).
 */
export function TenantProvider({ children }: { children: ReactNode }) {
  return (
    <TenantContextProvider>
      <TenantPrimaryColorSync />
      {children}
    </TenantContextProvider>
  );
}
