import type { ReactNode } from "react";
import { PublicTenantBranding } from "@/components/PublicTenantBranding";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white shadow-md"
          aria-hidden
        >
          CE
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-text">
          CampusEats
        </h1>
        <p className="mt-1 text-sm text-muted">Order smart. Eat fast.</p>
      </div>
      <div className="w-full max-w-md rounded-xl border border-muted/20 bg-surface p-8 shadow-sm">
        <PublicTenantBranding />
        {children}
      </div>
    </div>
  );
}
