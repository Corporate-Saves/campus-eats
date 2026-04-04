import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const bodySchema = z.object({
  userId: z.string().uuid(),
  /** Resolved server-side; never trust a client-supplied institution UUID. */
  institutionSlug: z.string().min(1).max(120),
  fullName: z.string().min(1).max(200),
  studentId: z.string().min(1).max(100),
});

function emailDomain(email: string | undefined): string | null {
  if (!email) return null;
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 ? parts[1]! : null;
}

function domainAllowed(domain: string, whitelist: string[] | null) {
  if (!whitelist?.length) return false;
  const d = domain.toLowerCase();
  return whitelist.some((w) => w.replace(/^@/, "").toLowerCase() === d);
}

/**
 * Creates the student profile after signUp when there is no client session.
 * Institution is resolved by slug; email domain is checked against whitelist.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { userId, institutionSlug, fullName, studentId } = parsed.data;
  const slug = institutionSlug.trim().toLowerCase();

  try {
    const admin = createAdminClient();

    const { data: inst, error: instError } = await admin
      .from("institutions")
      .select("id, slug, domain_whitelist, is_active")
      .eq("slug", slug)
      .maybeSingle();

    if (instError) {
      return NextResponse.json({ error: instError.message }, { status: 500 });
    }
    if (!inst || !inst.is_active) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    const { data: authData, error: authErr } =
      await admin.auth.admin.getUserById(userId);
    if (authErr || !authData.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const domain = emailDomain(authData.user.email);
    const whitelist = (inst.domain_whitelist ?? []) as string[];
    if (!domain || !domainAllowed(domain, whitelist)) {
      return NextResponse.json(
        { error: "Email domain is not allowed for this institution" },
        { status: 403 },
      );
    }

    const { error: insertErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        institution_id: inst.id,
        full_name: fullName,
        role: "student",
        student_id: studentId,
      },
      { onConflict: "id" },
    );

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
