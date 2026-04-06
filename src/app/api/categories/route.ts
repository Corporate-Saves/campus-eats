import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatZodBodyError } from "@/lib/zod-api-error";

const createSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  sort_order: z.number().int().min(0).optional(),
});

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

export async function GET() {
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

  const { data, error } = await admin
    .from("menu_categories")
    .select("id, name, sort_order, canteen_id")
    .eq("canteen_id", profile.canteen_id)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const categories = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sort_order: c.sort_order,
  }));
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const res = await requireOwner();
  if ("error" in res) return res.error;
  const { profile } = res;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
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

  let sortOrder = parsed.data.sort_order;
  if (sortOrder === undefined) {
    const { data: maxRow } = await admin
      .from("menu_categories")
      .select("sort_order")
      .eq("canteen_id", profile.canteen_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? -1) + 1;
  }

  const { data: created, error: insertError } = await admin
    .from("menu_categories")
    .insert({
      canteen_id: profile.canteen_id,
      name: parsed.data.name,
      sort_order: sortOrder,
    })
    .select("id, name, sort_order")
    .maybeSingle();

  if (insertError || !created) {
    return NextResponse.json(
      { error: insertError?.message ?? "Create failed" },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      category: {
        id: created.id,
        name: created.name,
        sort_order: created.sort_order,
      },
    },
    { status: 201 },
  );
}
