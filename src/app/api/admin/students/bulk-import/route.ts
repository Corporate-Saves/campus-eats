import { NextResponse } from "next/server";
import { z } from "zod";
import { domainAllowed, emailDomain } from "@/lib/auth/email-domain";
import { requireInstitutionAdminApi } from "@/lib/auth/require-institution-admin-api";
import { formatZodBodyError } from "@/lib/zod-api-error";
import { adminFindUserByEmail } from "@/lib/supabase/admin-auth-users";
import { createAdminClient } from "@/lib/supabase/admin";

const rowSchema = z.object({
  full_name: z.string().min(1).max(200).trim(),
  student_id: z.string().min(1).max(100).trim(),
  email: z.string().email().max(320).transform((s) => s.trim().toLowerCase()),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  const auth = await requireInstitutionAdminApi();
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodBodyError(parsed.error) },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { institutionId } = auth;

  const { data: inst, error: instErr } = await admin
    .from("institutions")
    .select("id, domain_whitelist")
    .eq("id", institutionId)
    .maybeSingle();

  if (instErr || !inst) {
    return NextResponse.json({ error: "Institution not found" }, { status: 404 });
  }

  const whitelist = (inst.domain_whitelist ?? []) as string[];
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const redirectTo = `${siteUrl}/login`;

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const failures: { email: string; reason: string }[] = [];

  for (const row of parsed.data.rows) {
    const domain = emailDomain(row.email);
    if (!domain || !domainAllowed(domain, whitelist)) {
      failed++;
      failures.push({ email: row.email, reason: "invalid_email_domain" });
      continue;
    }

    const { user: existing, error: findErr } = await adminFindUserByEmail(
      admin,
      row.email,
    );
    if (findErr) {
      failed++;
      failures.push({ email: row.email, reason: "lookup_failed" });
      continue;
    }

    if (existing) {
      const { data: prof } = await admin
        .from("profiles")
        .select("id, institution_id, role")
        .eq("id", existing.id)
        .maybeSingle();

      if (!prof) {
        const { error: upErr } = await admin.from("profiles").insert({
          id: existing.id,
          institution_id: institutionId,
          role: "student",
          full_name: row.full_name,
          student_id: row.student_id,
        });
        if (upErr) {
          failed++;
          failures.push({ email: row.email, reason: upErr.message });
        } else {
          created++;
        }
        continue;
      }

      if (prof.institution_id === institutionId && prof.role === "student") {
        skipped++;
        continue;
      }

      failed++;
      failures.push({ email: row.email, reason: "user_exists_other_context" });
      continue;
    }

    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(
      row.email,
      {
        redirectTo,
        data: {
          full_name: row.full_name,
          student_id: row.student_id,
        },
      },
    );

    if (invErr || !invited.user) {
      failed++;
      failures.push({
        email: row.email,
        reason: invErr?.message ?? "invite_failed",
      });
      continue;
    }

    const uid = invited.user.id;
    const { error: insErr } = await admin.from("profiles").insert({
      id: uid,
      institution_id: institutionId,
      role: "student",
      full_name: row.full_name,
      student_id: row.student_id,
    });

    if (insErr) {
      failed++;
      failures.push({ email: row.email, reason: insErr.message });
      continue;
    }

    created++;
  }

  return NextResponse.json({
    created,
    skipped,
    failed,
    failures: failures.slice(0, 50),
  });
}
