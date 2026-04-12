"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Canteen = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_open: boolean;
  opening_time: string | null;
  closing_time: string | null;
  created_at: string;
};

export function CanteensAdminClient() {
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [openingTime, setOpeningTime] = useState("08:00");
  const [closingTime, setClosingTime] = useState("20:00");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [assignEmail, setAssignEmail] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/canteens");
      const body = (await res.json()) as { canteens?: Canteen[]; error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not load canteens");
        setCanteens([]);
        return;
      }
      setCanteens(body.canteens ?? []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createCanteen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("description", description.trim());
      fd.append("opening_time", openingTime);
      fd.append("closing_time", closingTime);
      if (imageFile) fd.append("image", imageFile);

      const res = await fetch("/api/admin/canteens", { method: "POST", body: fd });
      const body = (await res.json()) as { error?: string; canteen?: Canteen };
      if (!res.ok) {
        toast.error(body.error ?? "Could not create canteen");
        return;
      }
      toast.success("Canteen created");
      setName("");
      setDescription("");
      setImageFile(null);
      void load();
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const assignOwner = async (canteenId: string) => {
    const email = (assignEmail[canteenId] ?? "").trim().toLowerCase();
    if (!email) {
      toast.error("Enter an email");
      return;
    }
    setAssigningId(canteenId);
    try {
      const res = await fetch(`/api/admin/canteens/${canteenId}/assign-owner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Assignment failed");
        return;
      }
      toast.success("Canteen owner assigned");
      setAssignEmail((prev) => ({ ...prev, [canteenId]: "" }));
    } catch {
      toast.error("Network error");
    } finally {
      setAssigningId(null);
    }
  };

  const fmtTime = (t: string | null) => {
    if (!t) return "—";
    return t.slice(0, 5);
  };

  return (
    <div className="space-y-10">
      <Link
        href="/admin/institutions"
        className="inline-block text-sm font-medium text-primary hover:underline"
      >
        ← Back to institution overview
      </Link>

      <section className="rounded-2xl border border-muted/20 bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-text">Add canteen</h2>
        <form onSubmit={(e) => void createCanteen(e)} className="mt-4 space-y-4">
          <label className="block text-sm text-text">
            <span className="text-muted">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-text">
            <span className="text-muted">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-text">
              <span className="text-muted">Opening time</span>
              <input
                type="time"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-text">
              <span className="text-muted">Closing time</span>
              <input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-sm text-text">
            <span className="text-muted">Image (optional)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create canteen"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text">Your canteens</h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : canteens.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No canteens yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {canteens.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl border border-muted/20 bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.image_url}
                      alt=""
                      className="h-24 w-24 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-muted/20 text-xs text-muted">
                      No image
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-text">{c.name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.is_open
                            ? "bg-emerald-500/15 text-emerald-800"
                            : "bg-muted/30 text-muted"
                        }`}
                      >
                        {c.is_open ? "Open" : "Closed"}
                      </span>
                    </div>
                    {c.description ? (
                      <p className="mt-1 text-sm text-muted">{c.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted">
                      Hours: {fmtTime(c.opening_time)} – {fmtTime(c.closing_time)}
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="flex-1 text-sm text-text">
                        <span className="text-muted">Assign canteen owner (email)</span>
                        <input
                          type="email"
                          value={assignEmail[c.id] ?? ""}
                          onChange={(e) =>
                            setAssignEmail((prev) => ({
                              ...prev,
                              [c.id]: e.target.value,
                            }))
                          }
                          placeholder="user@school.edu"
                          className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={assigningId === c.id}
                        onClick={() => void assignOwner(c.id)}
                        className="rounded-xl border border-muted/30 px-4 py-2 text-sm font-medium hover:bg-muted/10 disabled:opacity-50"
                      >
                        {assigningId === c.id ? "Assigning…" : "Assign"}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
