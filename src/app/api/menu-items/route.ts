import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatZodBodyError } from "@/lib/zod-api-error";

const tagEnum = z.enum(["spicy", "bestseller", "new", "healthy"]);

const createSchema = z.object({
  category_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().min(0),
  is_veg: z.boolean(),
  max_daily_quantity: z.union([z.number().int().min(0), z.null()]).optional(),
  tags: z.array(tagEnum).optional(),
  image_url: z.union([z.string().url(), z.null()]).optional(),
  is_available: z.boolean().optional(),
});

const SELECT =
  "id, category_id, canteen_id, name, description, price, image_url, is_veg, is_available, max_daily_quantity, prepared_quantity, tags, deleted_at";

function serializeItem(row: {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: string | number;
  image_url: string | null;
  is_veg: boolean;
  is_available: boolean;
  max_daily_quantity: number | null;
  prepared_quantity: number | null;
  tags: string[] | null;
  deleted_at?: string | null;
}) {
  const price =
    typeof row.price === "string" ? parseFloat(row.price) : row.price;
  return {
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    price,
    image_url: row.image_url,
    is_veg: row.is_veg,
    is_available: row.is_available,
    max_daily_quantity: row.max_daily_quantity,
    prepared_quantity: row.prepared_quantity ?? 0,
    tags: row.tags,
    deleted_at: row.deleted_at ?? null,
  };
}

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
    .from("menu_items")
    .select(SELECT)
    .eq("canteen_id", profile.canteen_id)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map(serializeItem);
  return NextResponse.json({ items });
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

  const body = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { data: cat } = await admin
    .from("menu_categories")
    .select("id")
    .eq("id", body.category_id)
    .eq("canteen_id", profile.canteen_id)
    .maybeSingle();

  if (!cat) {
    return NextResponse.json(
      { error: "Category not found for this canteen" },
      { status: 400 },
    );
  }

  const insertRow = {
    canteen_id: profile.canteen_id,
    category_id: body.category_id,
    name: body.name,
    description: body.description ?? null,
    price: body.price,
    is_veg: body.is_veg,
    is_available: body.is_available ?? true,
    max_daily_quantity: body.max_daily_quantity ?? null,
    prepared_quantity: 0,
    tags: body.tags ?? [],
    image_url: body.image_url ?? null,
  };

  const { data: created, error: insertError } = await admin
    .from("menu_items")
    .insert(insertRow)
    .select(SELECT)
    .maybeSingle();

  if (insertError || !created) {
    return NextResponse.json(
      { error: insertError?.message ?? "Create failed" },
      { status: 400 },
    );
  }

  return NextResponse.json({ item: serializeItem(created) }, { status: 201 });
}
