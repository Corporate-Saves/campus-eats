import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

/**
 * Public institution branding for login/register (?slug=).
 * Does not expose internal ids. No auth. Scoped lookup by slug only.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("slug");
  const slug = raw?.trim().toLowerCase();

  if (!slug) {
    return NextResponse.json({ error: "Missing slug query parameter" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("institutions")
      .select("name, slug, logo_url, primary_color")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    return NextResponse.json({
      name: data.name,
      slug: data.slug,
      logo_url: data.logo_url,
      primary_color: data.primary_color ?? "#FF6B35",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
