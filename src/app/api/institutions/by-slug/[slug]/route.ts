import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * Registration-only public lookup (slug → id + domain_whitelist).
 * For authenticated data access, use session institution from profiles — never a client id.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const normalized = slug.trim().toLowerCase();
  if (!normalized) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("institutions")
      .select("id, slug, domain_whitelist, is_active")
      .eq("slug", normalized)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || !data.is_active) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: data.id,
      slug: data.slug,
      domain_whitelist: data.domain_whitelist ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
