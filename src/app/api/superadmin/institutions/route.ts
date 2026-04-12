import { NextResponse } from "next/server";
import { z } from "zod";
import { domainAllowed, emailDomain } from "@/lib/auth/email-domain";
import { requireSuperAdminApi } from "@/lib/auth/require-super-admin-api";
import { formatZodBodyError } from "@/lib/zod-api-error";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers, hyphens only");

function parseDomains(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
}

export async function GET() {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { data: insts, error: instErr } = await admin
    .from("institutions")
    .select("id, name, slug, is_active, created_at, deleted_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (instErr) {
    return NextResponse.json({ error: instErr.message }, { status: 500 });
  }

  const rows = insts ?? [];
  const ids = rows.map((r) => r.id);
  const studentBy: Record<string, number> = {};
  const activeOrdersBy: Record<string, number> = {};

  if (ids.length > 0) {
    const { data: studs } = await admin
      .from("profiles")
      .select("institution_id")
      .eq("role", "student")
      .in("institution_id", ids);

    for (const s of studs ?? []) {
      if (!s.institution_id) continue;
      studentBy[s.institution_id] = (studentBy[s.institution_id] ?? 0) + 1;
    }

    const { data: ords } = await admin
      .from("orders")
      .select("institution_id")
      .in("institution_id", ids)
      .in("status", ["PENDING", "ACCEPTED", "PREPARING", "READY"]);

    for (const o of ords ?? []) {
      activeOrdersBy[o.institution_id] = (activeOrdersBy[o.institution_id] ?? 0) + 1;
    }
  }

  const institutions = rows.map((i) => ({
    id: i.id,
    name: i.name,
    slug: i.slug,
    is_active: i.is_active,
    created_at: i.created_at,
    student_count: studentBy[i.id] ?? 0,
    active_orders: activeOrdersBy[i.id] ?? 0,
  }));

  return NextResponse.json({ institutions });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim().toLowerCase();
  const domainsRaw = String(formData.get("domain_whitelist") ?? "");
  const primary_color = String(formData.get("primary_color") ?? "#FF6B35").trim() || "#FF6B35";
  const admin_email = String(formData.get("admin_email") ?? "").trim().toLowerCase();
  const admin_name = String(formData.get("admin_name") ?? "").trim() || "Institution admin";

  const domain_whitelist = parseDomains(domainsRaw);
  if (!domain_whitelist.length) {
    return NextResponse.json(
      { error: "Add at least one allowed email domain" },
      { status: 400 },
    );
  }

  const slugParsed = slugSchema.safeParse(slugRaw);
  if (!slugParsed.success) {
    return NextResponse.json(
      { error: formatZodBodyError(slugParsed.error) },
      { status: 400 },
    );
  }

  if (!name) {
    return NextResponse.json({ error: "Institution name is required" }, { status: 400 });
  }

  const emailCheck = z.string().email().safeParse(admin_email);
  if (!emailCheck.success) {
    return NextResponse.json({ error: "Valid admin email is required" }, { status: 400 });
  }

  const admDomain = emailDomain(admin_email);
  if (!admDomain || !domainAllowed(admDomain, domain_whitelist)) {
    return NextResponse.json(
      { error: "Admin email must use one of the whitelisted domains" },
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

  const { data: existing } = await admin
    .from("institutions")
    .select("id")
    .eq("slug", slugParsed.data)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Slug is already in use" }, { status: 409 });
  }

  const { data: created, error: insErr } = await admin
    .from("institutions")
    .insert({
      name,
      slug: slugParsed.data,
      domain_whitelist,
      primary_color,
      logo_url: null,
      is_active: true,
    })
    .select("id, name, slug, domain_whitelist, primary_color, logo_url, is_active, created_at")
    .maybeSingle();

  if (insErr || !created) {
    return NextResponse.json(
      { error: insErr?.message ?? "Create failed" },
      { status: 400 },
    );
  }

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) {
      await admin.from("institutions").delete().eq("id", created.id);
      return NextResponse.json({ error: "Logo must be 5MB or smaller" }, { status: 400 });
    }
    const type = logo.type || "application/octet-stream";
    if (!ALLOWED_LOGO.has(type)) {
      await admin.from("institutions").delete().eq("id", created.id);
      return NextResponse.json(
        { error: "Logo: use JPEG, PNG, WebP, or GIF" },
        { status: 400 },
      );
    }
    const ext =
      type === "image/jpeg"
        ? "jpg"
        : type === "image/png"
          ? "png"
          : type === "image/webp"
            ? "webp"
            : "gif";
    const path = `branding/institutions/${created.id}/logo.${ext}`;
    const buffer = Buffer.from(await logo.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from("menu-images")
      .upload(path, buffer, { contentType: type, upsert: true });
    if (upErr) {
      await admin.from("institutions").delete().eq("id", created.id);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    const { data: pub } = admin.storage.from("menu-images").getPublicUrl(path);
    await admin.from("institutions").update({ logo_url: pub.publicUrl }).eq("id", created.id);
    created.logo_url = pub.publicUrl;
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const redirectTo = `${siteUrl}/login`;

  const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(
    admin_email,
    {
      redirectTo,
      data: { full_name: admin_name },
    },
  );

  if (invErr || !invited.user) {
    await admin.storage.from("menu-images").remove([`branding/institutions/${created.id}/logo.jpg`, `branding/institutions/${created.id}/logo.png`, `branding/institutions/${created.id}/logo.webp`, `branding/institutions/${created.id}/logo.gif`]);
    await admin.from("institutions").delete().eq("id", created.id);
    return NextResponse.json(
      { error: invErr?.message ?? "Could not invite institution admin" },
      { status: 400 },
    );
  }

  const { error: profErr } = await admin.from("profiles").insert({
    id: invited.user.id,
    institution_id: created.id,
    role: "institution_admin",
    full_name: admin_name,
  });

  if (profErr) {
    return NextResponse.json(
      {
        error: `Institution created but profile failed: ${profErr.message}. Fix admin user in dashboard.`,
        institution: created,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ institution: created, admin_invited: true }, { status: 201 });
}
