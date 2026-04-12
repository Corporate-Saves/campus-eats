"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Institution = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  domain_whitelist: string[] | null;
  is_active: boolean;
  created_at: string;
  deleted_at: string | null;
};

type Stats = {
  daily_active_users: number;
  orders_today: number;
  revenue_this_month: number;
};

type Props = { tenantId: string };

export function SuperAdminTenantDetailClient({ tenantId }: Props) {
  const router = useRouter();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/institutions/${tenantId}`);
      const body = (await res.json()) as {
        institution?: Institution;
        stats?: Stats;
        error?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Could not load institution");
        setInstitution(null);
        setStats(null);
        return;
      }
      setInstitution(body.institution ?? null);
      setStats(body.stats ?? null);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setActive = async (is_active: boolean) => {
    setToggleBusy(true);
    try {
      const res = await fetch(`/api/superadmin/institutions/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Update failed");
        return;
      }
      toast.success(is_active ? "Institution activated" : "Institution deactivated");
      await load();
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setToggleBusy(false);
    }
  };

  const softDelete = async () => {
    if (!institution) return;
    if (confirmName.trim() !== institution.name.trim()) {
      toast.error("Type the institution name exactly to confirm");
      return;
    }
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/superadmin/institutions/${tenantId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: confirmName.trim() }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Delete failed");
        return;
      }
      toast.success("Institution removed");
      router.push("/admin/tenants");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading && !institution) {
    return (
      <p className="text-sm text-muted">Loading institution…</p>
    );
  }

  if (!institution) {
    return (
      <p className="text-sm text-muted">
        Institution not found.{" "}
        <Link href="/admin/tenants" className="text-primary underline">
          Back to list
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/tenants"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← All tenants
        </Link>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text">
              {institution.name}
            </h1>
            <p className="mt-1 font-mono text-sm text-muted">
              {institution.slug}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={
                institution.is_active
                  ? "rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200"
                  : "rounded-full bg-muted/30 px-2.5 py-1 text-xs font-semibold text-muted"
              }
            >
              {institution.is_active ? "Active" : "Inactive"}
            </span>
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={institution.is_active}
                disabled={toggleBusy || institution.deleted_at != null}
                onChange={(e) => void setActive(e.target.checked)}
                className="h-4 w-4 rounded border-muted text-primary"
              />
              Logins enabled
            </label>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          Deactivating blocks all users in this tenant until re-enabled.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Daily active users (ordered today)", stats?.daily_active_users ?? "—"],
          ["Orders today", stats?.orders_today ?? "—"],
          [
            "Revenue this month",
            stats != null
              ? `₹${Number(stats.revenue_this_month).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "—",
          ],
        ].map(([label, val]) => (
          <div
            key={label}
            className="rounded-2xl border border-muted/20 bg-surface p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold text-text">{val}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-muted/20 bg-surface p-5">
        <h2 className="text-lg font-semibold text-text">Details</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Created</dt>
            <dd className="font-medium text-text">
              {institution.created_at
                ? format(parseISO(institution.created_at), "PPp")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Primary color</dt>
            <dd className="flex items-center gap-2 font-mono text-text">
              {institution.primary_color ?? "—"}
              {institution.primary_color ? (
                <span
                  className="inline-block h-5 w-5 rounded border border-muted/30"
                  style={{ backgroundColor: institution.primary_color }}
                  aria-hidden
                />
              ) : null}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted">Domains</dt>
            <dd className="mt-1 text-text">
              {(institution.domain_whitelist ?? []).length
                ? institution.domain_whitelist?.join(", ")
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5 dark:border-red-900/40 dark:bg-red-950/20">
        <h2 className="text-lg font-semibold text-red-900 dark:text-red-200">
          Danger zone
        </h2>
        <p className="mt-2 text-sm text-red-800/90 dark:text-red-200/80">
          Soft-delete this institution. Data is retained but the tenant is hidden,
          slug can be reused, and users cannot sign in. This cannot be undone
          from this panel without database access.
        </p>
        <div className="mt-4 max-w-md space-y-2">
          <label className="block text-sm font-medium text-text">
            Type <strong>{institution.name}</strong> to confirm
          </label>
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className="w-full rounded-xl border border-red-200 bg-background px-3 py-2 text-sm dark:border-red-900/50"
            placeholder={institution.name}
            autoComplete="off"
          />
          <button
            type="button"
            disabled={
              deleteBusy ||
              confirmName.trim() !== institution.name.trim()
            }
            onClick={() => void softDelete()}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleteBusy ? "Deleting…" : "Delete institution"}
          </button>
        </div>
      </section>
    </div>
  );
}
