"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type PublicTenant = {
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
};

const DEFAULT_PRIMARY = "#FF6B35";

function PublicTenantBrandingInner() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug")?.trim().toLowerCase() ?? "";
  const [tenant, setTenant] = useState<PublicTenant | null>(null);

  useEffect(() => {
    if (!slug) {
      setTenant(null);
      document.documentElement.style.setProperty(
        "--tenant-primary",
        DEFAULT_PRIMARY,
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/tenant?slug=${encodeURIComponent(slug)}`,
        );
        if (!res.ok) {
          if (!cancelled) setTenant(null);
          return;
        }
        const data = (await res.json()) as PublicTenant;
        if (cancelled) return;
        setTenant(data);
        const color = data.primary_color?.trim() || DEFAULT_PRIMARY;
        document.documentElement.style.setProperty("--tenant-primary", color);
      } catch {
        if (!cancelled) setTenant(null);
      }
    })();

    return () => {
      cancelled = true;
      document.documentElement.style.setProperty(
        "--tenant-primary",
        DEFAULT_PRIMARY,
      );
    };
  }, [slug]);

  if (!slug || !tenant) return null;

  return (
    <div className="mb-6 flex flex-col items-center gap-2 rounded-lg border border-muted/20 bg-background/80 px-4 py-3 text-center">
      {tenant.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- institution URLs are arbitrary (e.g. Supabase storage)
        <img
          src={tenant.logo_url}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 rounded-lg object-cover"
        />
      ) : null}
      <p className="text-sm font-semibold text-text">{tenant.name}</p>
    </div>
  );
}

export function PublicTenantBranding() {
  return (
    <Suspense fallback={null}>
      <PublicTenantBrandingInner />
    </Suspense>
  );
}
