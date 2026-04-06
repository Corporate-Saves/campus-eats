import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatZodBodyError } from "@/lib/zod-api-error";

const bodySchema = z.object({
  category_ids: z.array(z.string().uuid()).min(1),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, canteen_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.canteen_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  }

  if (profile.role !== "canteen_owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const { category_ids } = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { data: existing, error: listError } = await admin
    .from("menu_categories")
    .select("id")
    .eq("canteen_id", profile.canteen_id);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const allowed = new Set((existing ?? []).map((r) => r.id));
  if (category_ids.length !== allowed.size) {
    return NextResponse.json(
      { error: "category_ids must include every category exactly once" },
      { status: 400 },
    );
  }
  for (const cid of category_ids) {
    if (!allowed.has(cid)) {
      return NextResponse.json(
        { error: "Invalid category in list" },
        { status: 400 },
      );
    }
  }

  for (let i = 0; i < category_ids.length; i++) {
    const { error: upErr } = await admin
      .from("menu_categories")
      .update({ sort_order: i })
      .eq("id", category_ids[i])
      .eq("canteen_id", profile.canteen_id);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
