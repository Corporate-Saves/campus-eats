"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AddInstitutionForm } from "./AddInstitutionForm";

type InstitutionRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  student_count: number;
  active_orders: number;
};

export function SuperAdminTenantsClient() {
  const [rows, setRows] = useState<InstitutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/institutions");
      const body = (await res.json()) as {
        institutions?: InstitutionRow[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Could not load institutions");
        setRows([]);
        return;
      }
      setRows(body.institutions ?? []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Tenants</h1>
          <p className="mt-1 text-sm text-muted">
            Institutions on the platform · manage onboarding and health
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/tenants/platform-stats"
            className="rounded-xl border border-muted/30 px-4 py-2 text-sm font-medium text-text hover:bg-muted/10"
          >
            Platform stats
          </Link>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Add institution
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-muted/20 bg-surface p-4 sm:p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-muted/15 text-xs uppercase text-muted">
                <th className="py-2 pr-2 font-semibold">Name</th>
                <th className="py-2 pr-2 font-semibold">Slug</th>
                <th className="py-2 pr-2 font-semibold">Students</th>
                <th className="py-2 pr-2 font-semibold">Active orders</th>
                <th className="py-2 pr-2 font-semibold">Status</th>
                <th className="py-2 pr-2 font-semibold">Created</th>
                <th className="py-2 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    No institutions yet. Add one to get started.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-muted/10">
                    <td className="py-2.5 pr-2 font-medium text-text">
                      {r.name}
                    </td>
                    <td className="py-2.5 pr-2 font-mono text-muted">
                      {r.slug}
                    </td>
                    <td className="py-2.5 pr-2 tabular-nums">{r.student_count}</td>
                    <td className="py-2.5 pr-2 tabular-nums">
                      {r.active_orders}
                    </td>
                    <td className="py-2.5 pr-2">
                      <span
                        className={
                          r.is_active
                            ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200"
                            : "rounded-full bg-muted/30 px-2 py-0.5 text-xs font-medium text-muted"
                        }
                      >
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-muted">
                      {r.created_at
                        ? format(parseISO(r.created_at), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="py-2.5">
                      <Link
                        href={`/admin/tenants/${r.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showAdd ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-institution-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-muted/20 bg-surface p-5 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <h2
                id="add-institution-title"
                className="text-lg font-semibold text-text"
              >
                Add institution
              </h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="text-sm text-muted hover:text-text"
              >
                Close
              </button>
            </div>
            <div className="mt-4">
              <AddInstitutionForm
                onSuccess={() => void load()}
                onClose={() => setShowAdd(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
