"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugifyFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type Props = {
  onSuccess: () => void;
  onClose: () => void;
};

export function AddInstitutionForm({ onSuccess, onClose }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#FF6B35");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onNameChange = (value: string) => {
    setName(value);
    if (!slugManual) {
      setSlug(slugifyFromName(value));
    }
  };

  const onSlugChange = (value: string) => {
    setSlugManual(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  };

  const addDomain = useCallback(() => {
    const raw = domainInput.trim().replace(/^@/, "").toLowerCase();
    if (!raw) return;
    if (domains.includes(raw)) {
      setDomainInput("");
      return;
    }
    setDomains((d) => [...d, raw]);
    setDomainInput("");
  }, [domainInput, domains]);

  const removeDomain = (d: string) => {
    setDomains((prev) => prev.filter((x) => x !== d));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const slugTrim = slug.trim();
    if (!name.trim()) {
      toast.error("Institution name is required");
      return;
    }
    if (!SLUG_REGEX.test(slugTrim) || slugTrim.length < 2) {
      toast.error(
        "Slug must be lowercase, use letters, numbers, and hyphens only (e.g. acme-college)",
      );
      return;
    }
    if (domains.length === 0) {
      toast.error("Add at least one email domain");
      return;
    }
    if (!adminEmail.trim()) {
      toast.error("Institution admin email is required");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("name", name.trim());
      fd.set("slug", slugTrim);
      fd.set("domain_whitelist", domains.join("\n"));
      fd.set("primary_color", primaryColor);
      fd.set("admin_email", adminEmail.trim().toLowerCase());
      fd.set("admin_name", adminName.trim() || "Institution admin");
      if (logo) fd.set("logo", logo);

      const res = await fetch("/api/superadmin/institutions", {
        method: "POST",
        body: fd,
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not create institution");
        return;
      }
      toast.success("Institution created · invite email sent to admin");
      onSuccess();
      onClose();
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
      <div>
        <label className="block text-sm font-medium text-text">
          Institution name
        </label>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm"
          placeholder="e.g. North Campus"
          autoComplete="organization"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text">Slug</label>
        <p className="mt-0.5 text-xs text-muted">
          URL-safe identifier; unique, lowercase, hyphens only. Auto-filled from
          name until you edit it.
        </p>
        <input
          value={slug}
          onChange={(e) => onSlugChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm font-mono"
          placeholder="north-campus"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text">
          Domain whitelist
        </label>
        <p className="mt-0.5 text-xs text-muted">
          Registration and admin email must match one of these domains.
        </p>
        <div className="mt-1 flex gap-2">
          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDomain();
              }
            }}
            className="flex-1 rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm"
            placeholder="e.g. college.edu"
          />
          <button
            type="button"
            onClick={addDomain}
            className="rounded-xl border border-muted/30 px-3 py-2 text-sm font-medium text-text hover:bg-muted/10"
          >
            Add
          </button>
        </div>
        {domains.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {domains.map((d) => (
              <li
                key={d}
                className="inline-flex items-center gap-1 rounded-full bg-muted/15 px-2.5 py-1 text-xs font-medium text-text"
              >
                @{d}
                <button
                  type="button"
                  onClick={() => removeDomain(d)}
                  className="text-muted hover:text-text"
                  aria-label={`Remove ${d}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <label className="block text-sm font-medium text-text">
          Primary color
        </label>
        <div className="mt-1 flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-muted/25 bg-background p-1"
          />
          <input
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="flex-1 rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm font-mono"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text">Logo</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
          className="mt-1 w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
        />
      </div>

      <div className="border-t border-muted/15 pt-4">
        <p className="text-sm font-medium text-text">Default institution admin</p>
        <p className="mt-0.5 text-xs text-muted">
          We send a Supabase invite email; they set a password from the link.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted">Email</label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm"
              placeholder="admin@college.edu"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted">
              Display name (optional)
            </label>
            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-muted/25 bg-background px-3 py-2 text-sm"
              placeholder="Campus admin"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-xl border border-muted/30 px-4 py-2 text-sm font-medium text-text hover:bg-muted/10 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create institution"}
        </button>
      </div>
    </form>
  );
}
