"use client";

import { useState } from "react";
import Papa from "papaparse";
import toast from "react-hot-toast";

type ParsedRow = {
  full_name: string;
  student_id: string;
  email: string;
};

export function BulkStudentImport({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    failed: number;
    failures: { email: string; reason: string }[];
  } | null>(null);

  const onFile = (file: File | null) => {
    setRows(null);
    setParseErrors([]);
    setResult(null);
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const errs: string[] = [...(res.errors?.map((e) => e.message) ?? [])];
        const out: ParsedRow[] = [];

        const pick = (line: Record<string, string>, key: string) => {
          const k = Object.keys(line).find(
            (h) => h.replace(/^\ufeff/, "").trim().toLowerCase() === key,
          );
          return k ? String(line[k] ?? "").trim() : "";
        };

        const fields = (res.meta.fields ?? []).map((f) =>
          f.replace(/^\ufeff/, "").trim().toLowerCase(),
        );
        if (
          !fields.includes("full_name") ||
          !fields.includes("student_id") ||
          !fields.includes("email")
        ) {
          errs.push(
            "CSV must include columns: full_name, student_id, email (header names).",
          );
          setParseErrors(errs);
          setRows(null);
          return;
        }

        for (const line of res.data) {
          if (!line || typeof line !== "object") continue;
          const full_name = pick(line, "full_name");
          const student_id = pick(line, "student_id");
          const email = pick(line, "email");
          if (!full_name && !student_id && !email) continue;
          if (!full_name || !student_id || !email) {
            errs.push(`Incomplete row: ${email || full_name || student_id || "(empty)"}`);
            continue;
          }
          out.push({ full_name, student_id, email });
        }
        setParseErrors(errs);
        setRows(out);
      },
    });
  };

  const confirm = async () => {
    if (!rows?.length) {
      toast.error("No valid rows to import.");
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/students/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const body = (await res.json()) as {
        error?: string;
        created?: number;
        skipped?: number;
        failed?: number;
        failures?: { email: string; reason: string }[];
      };
      if (!res.ok) {
        toast.error(body.error ?? "Import failed");
        return;
      }
      setResult({
        created: body.created ?? 0,
        skipped: body.skipped ?? 0,
        failed: body.failed ?? 0,
        failures: body.failures ?? [],
      });
      toast.success(
        `Import finished: ${body.created ?? 0} created, ${body.skipped ?? 0} skipped, ${body.failed ?? 0} failed`,
      );
      onDone();
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-muted/20 bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-text">Bulk student import</h2>
      <p className="mt-1 text-sm text-muted">
        CSV columns: <code className="text-xs">full_name</code>,{" "}
        <code className="text-xs">student_id</code>, <code className="text-xs">email</code>.
        Emails must match your institution domain whitelist. Invites are sent via Supabase Auth.
      </p>

      <div className="mt-4">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
      </div>

      {parseErrors.length > 0 ? (
        <ul className="mt-3 list-inside list-disc text-sm text-amber-700">
          {parseErrors.slice(0, 8).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      {rows && rows.length > 0 ? (
        <>
          <p className="mt-3 text-sm text-muted">
            Preview: <span className="font-medium text-text">{rows.length}</span> rows
          </p>
          <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-muted/15">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-muted/15 bg-background/60 text-xs uppercase text-muted">
                  <th className="px-2 py-1.5">Name</th>
                  <th className="px-2 py-1.5">Student ID</th>
                  <th className="px-2 py-1.5">Email</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={`${r.email}-${i}`} className="border-b border-muted/10">
                    <td className="px-2 py-1.5">{r.full_name}</td>
                    <td className="px-2 py-1.5">{r.student_id}</td>
                    <td className="px-2 py-1.5">{r.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 ? (
              <p className="p-2 text-center text-xs text-muted">
                Showing first 50 of {rows.length}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void confirm()}
            className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? "Importing…" : "Confirm import"}
          </button>
        </>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-muted/20 bg-background/50 p-3 text-sm">
          <p className="font-medium text-text">Results</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>Created: {result.created}</li>
            <li>Skipped (already enrolled): {result.skipped}</li>
            <li>Failed: {result.failed}</li>
          </ul>
          {result.failures.length > 0 ? (
            <ul className="mt-2 max-h-32 overflow-auto text-xs text-red-700">
              {result.failures.map((f) => (
                <li key={f.email}>
                  {f.email}: {f.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
