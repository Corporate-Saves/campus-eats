"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BulkStudentImport } from "./BulkStudentImport";

type Overview = {
  institution: { name: string };
  totalStudents: number;
  activeOrdersToday: number;
  revenueThisMonth: number;
  canteenCount: number;
};

type StudentRow = {
  id: string;
  full_name: string | null;
  student_id: string | null;
  wallet_balance: number | string | null;
  email: string;
  last_active: string | null;
  created_at: string;
};

type ProfileDetail = StudentRow & {
  banned?: boolean;
};

const PAGE_SIZE = 20;

export function InstitutionAdminClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileDetail, setProfileDetail] = useState<ProfileDetail | null>(null);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await fetch("/api/admin/institution/overview");
      const body = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        toast.error(String(body.error ?? "Could not load overview"));
        setOverview(null);
        return;
      }
      setOverview({
        institution: body.institution as Overview["institution"],
        totalStudents: Number(body.totalStudents),
        activeOrdersToday: Number(body.activeOrdersToday),
        revenueThisMonth: Number(body.revenueThisMonth),
        canteenCount: Number(body.canteenCount),
      });
    } catch {
      toast.error("Network error");
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search,
      });
      const res = await fetch(`/api/admin/students?${q}`);
      const body = (await res.json()) as {
        students?: StudentRow[];
        total?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Could not load students");
        setStudents([]);
        setTotal(0);
        return;
      }
      setStudents(body.students ?? []);
      setTotal(body.total ?? 0);
    } catch {
      toast.error("Network error");
    } finally {
      setLoadingStudents(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const exportCsv = async () => {
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/admin/students/export${q}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "students-export.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Network error");
    }
  };

  const openProfile = async (id: string) => {
    setProfileUserId(id);
    setProfileDetail(null);
    try {
      const res = await fetch(`/api/admin/students/${id}`);
      const body = (await res.json()) as { student?: ProfileDetail; error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not load profile");
        setProfileUserId(null);
        return;
      }
      setProfileDetail(body.student ?? null);
    } catch {
      toast.error("Network error");
      setProfileUserId(null);
    }
  };

  const deactivate = async (id: string) => {
    if (!confirm("Deactivate this account? The student will be banned from signing in.")) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/students/${id}/deactivate`, {
        method: "POST",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not deactivate");
        return;
      }
      toast.success("Account deactivated");
      setProfileUserId(null);
      void loadStudents();
      void loadOverview();
    } catch {
      toast.error("Network error");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {loadingOverview ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : overview ? (
            <p className="text-lg font-medium text-text">{overview.institution.name}</p>
          ) : null}
        </div>
        <Link
          href="/admin/institutions/canteens"
          className="rounded-xl border border-muted/30 px-4 py-2 text-sm font-medium text-text hover:bg-muted/10"
        >
          Manage canteens
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total students", overview?.totalStudents ?? "—"],
          ["Active orders today", overview?.activeOrdersToday ?? "—"],
          [
            "Revenue this month",
            overview != null
              ? `₹${Number(overview.revenueThisMonth).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "—",
          ],
          ["Canteens", overview?.canteenCount ?? "—"],
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

      <BulkStudentImport
        onDone={() => {
          void loadOverview();
          void loadStudents();
        }}
      />

      <section className="rounded-2xl border border-muted/20 bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">Students</h2>
            <p className="text-sm text-muted">
              {PAGE_SIZE} per page · search by name, student ID, or full email
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex min-w-[200px] flex-1 gap-2">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
                placeholder="Search…"
                className="flex-1 rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={applySearch}
                className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white"
              >
                Search
              </button>
            </div>
            <button
              type="button"
              onClick={() => void exportCsv()}
              className="rounded-xl border border-muted/30 px-3 py-2 text-sm font-medium text-text hover:bg-muted/10"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-muted/15 text-xs uppercase text-muted">
                <th className="py-2 pr-2 font-semibold">Name</th>
                <th className="py-2 pr-2 font-semibold">Student ID</th>
                <th className="py-2 pr-2 font-semibold">Email</th>
                <th className="py-2 pr-2 font-semibold">Wallet</th>
                <th className="py-2 pr-2 font-semibold">Last active</th>
                <th className="py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingStudents ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No students found.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id} className="border-b border-muted/10">
                    <td className="py-2 pr-2 font-medium text-text">
                      {s.full_name ?? "—"}
                    </td>
                    <td className="py-2 pr-2 text-muted">{s.student_id ?? "—"}</td>
                    <td className="py-2 pr-2 text-muted">{s.email || "—"}</td>
                    <td className="py-2 pr-2 tabular-nums">
                      ₹{Number(s.wallet_balance ?? 0).toFixed(0)}
                    </td>
                    <td className="py-2 pr-2 text-muted">
                      {s.last_active
                        ? format(parseISO(s.last_active), "MMM d, yyyy HH:mm")
                        : "—"}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void openProfile(s.id)}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          View profile
                        </button>
                        <button
                          type="button"
                          onClick={() => void deactivate(s.id)}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-2 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-muted/30 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-muted">
              Page {page} of {totalPages} ({total} total)
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-muted/30 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </section>

      {profileUserId ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-muted/20 bg-surface p-5 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-text">Student profile</h3>
              <button
                type="button"
                onClick={() => setProfileUserId(null)}
                className="text-sm text-muted hover:text-text"
              >
                Close
              </button>
            </div>
            {!profileDetail ? (
              <p className="mt-4 text-sm text-muted">Loading…</p>
            ) : (
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-muted">Name</dt>
                  <dd className="font-medium text-text">
                    {profileDetail.full_name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Student ID</dt>
                  <dd>{profileDetail.student_id ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Email</dt>
                  <dd>{profileDetail.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Wallet</dt>
                  <dd>₹{Number(profileDetail.wallet_balance ?? 0).toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Last active</dt>
                  <dd>
                    {profileDetail.last_active
                      ? format(parseISO(profileDetail.last_active), "PPp")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Joined</dt>
                  <dd>
                    {profileDetail.created_at
                      ? format(parseISO(profileDetail.created_at), "PP")
                      : "—"}
                  </dd>
                </div>
                {profileDetail.banned ? (
                  <p className="text-amber-700">Account is deactivated (banned).</p>
                ) : null}
              </dl>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
