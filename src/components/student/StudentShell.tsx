"use client";

import { ClipboardList, Home, UtensilsCrossed, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";
import { useTenant } from "@/context/TenantContext";
import { useProfile } from "@/hooks/useProfile";

const tabs = [
  { href: "/student/dashboard", label: "Home", icon: Home },
  { href: "/student/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/student/orders", label: "Orders", icon: ClipboardList },
  { href: "/student/wallet", label: "Wallet", icon: Wallet },
] as const;

export function StudentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { institution, isLoading: tenantLoading } = useTenant();
  const { profile, isLoading: profileLoading } = useProfile();

  const walletLabel =
    profile?.wallet_balance != null
      ? `₹${Number(profile.wallet_balance).toFixed(0)}`
      : "—";

  return (
    <div className="flex min-h-screen flex-col bg-background text-text">
      <header className="sticky top-0 z-20 border-b border-muted/20 bg-surface px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {institution?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote institution logos
              <img
                src={institution.logo_url}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                {tenantLoading ? "…" : institution?.name?.charAt(0) ?? "C"}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-muted">
                {tenantLoading ? "…" : institution?.name ?? "Campus"}
              </p>
              <p className="truncate text-sm font-semibold text-text">
                {profileLoading ? "…" : profile?.full_name ?? "Student"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-text ring-1 ring-muted/30">
              {walletLabel}
            </div>
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-muted/20 bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg justify-around px-1 pt-1">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
