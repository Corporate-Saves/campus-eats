import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatZodBodyError } from "@/lib/zod-api-error";

const patchSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

type OwnerAuth =
  | { profile: { canteen_id: string } }
  | { error: NextResponse };

async function requireOwner(): Promise<OwnerAuth> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, canteen_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile?.canteen_id) {
    return {
      error: NextResponse.json({ error: "Profile not found" }, { status: 400 }),
    };
  }
  if (profile.role !== "canteen_owner") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { profile };
}

export async function PATCH(request: Request, context: RouteParams) {
  const { id } = await context.params;
  const res = await requireOwner();
  if ("error" in res) return res.error;
  const { profile } = res;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodBodyError(parsed.error) },
      { status: 400 },
    );
  }

  if (parsed.data.name === undefined) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
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

  const { data: updated, error: updateError } = await admin
    .from("menu_categories")
    .update({ name: parsed.data.name })
    .eq("id", id)
    .eq("canteen_id", profile.canteen_id)
    .select("id, name, sort_order")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json({
    category: {
      id: updated.id,
      name: updated.name,
      sort_order: updated.sort_order,
    },
  });
}

export async function DELETE(_request: Request, context: RouteParams) {
  const { id } = await context.params;
  const res = await requireOwner();
  if ("error" in res) return res.error;
  const { profile } = res;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { count, error: countError } = await admin
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id)
    .eq("canteen_id", profile.canteen_id)
    .is("deleted_at", null);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Move or delete items in this category first" },
      { status: 409 },
    );
  }

  const { error: delError } = await admin
    .from("menu_categories")
    .delete()
    .eq("id", id)
    .eq("canteen_id", profile.canteen_id);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
