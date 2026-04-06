import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatZodBodyError } from "@/lib/zod-api-error";

const tagEnum = z.enum(["spicy", "bestseller", "new", "healthy"]);

const staffPatchSchema = z
  .object({
    is_available: z.boolean().optional(),
    prepared_quantity: z.number().int().min(0).optional(),
    max_daily_quantity: z.union([z.number().int().min(0), z.null()]).optional(),
  })
  .refine(
    (b) =>
      b.is_available !== undefined ||
      b.prepared_quantity !== undefined ||
      b.max_daily_quantity !== undefined,
    { message: "At least one field required" },
  );

const ownerPatchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    category_id: z.string().uuid().optional(),
    price: z.number().min(0).optional(),
    is_veg: z.boolean().optional(),
    max_daily_quantity: z.union([z.number().int().min(0), z.null()]).optional(),
    tags: z.array(tagEnum).optional(),
    image_url: z.union([z.string().url(), z.null()]).optional(),
    is_available: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: "At least one field required",
  });

const SELECT =
  "id, category_id, canteen_id, name, description, price, image_url, is_veg, is_available, max_daily_quantity, prepared_quantity, tags, deleted_at";

const CATALOG_KEYS = new Set([
  "name",
  "description",
  "category_id",
  "price",
  "is_veg",
  "tags",
  "image_url",
]);

type RouteParams = { params: Promise<{ itemId: string }> };

function usesCatalogUpdate(body: Record<string, unknown>): boolean {
  return [...CATALOG_KEYS].some((k) => body[k] !== undefined);
}

function serializeItem(updated: {
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
    typeof updated.price === "string"
      ? parseFloat(updated.price)
      : updated.price;
  return {
    id: updated.id,
    category_id: updated.category_id,
    name: updated.name,
    description: updated.description,
    price,
    image_url: updated.image_url,
    is_veg: updated.is_veg,
    is_available: updated.is_available,
    max_daily_quantity: updated.max_daily_quantity,
    prepared_quantity: updated.prepared_quantity ?? 0,
    tags: updated.tags,
    deleted_at: updated.deleted_at ?? null,
  };
}

export async function PATCH(request: Request, context: RouteParams) {
  const { itemId } = await context.params;

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

  let json: Record<string, unknown>;
  try {
    json = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const isStaffRole =
    profile.role === "canteen_staff" || profile.role === "canteen_owner";
  const isOwner = profile.role === "canteen_owner";

  if (!isStaffRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (usesCatalogUpdate(json)) {
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const parsed = ownerPatchSchema.safeParse(json);
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

    const { data: row, error: fetchError } = await admin
      .from("menu_items")
      .select(SELECT)
      .eq("id", itemId)
      .eq("canteen_id", profile.canteen_id)
      .maybeSingle();

    if (fetchError || !row) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (row.deleted_at) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const body = parsed.data;

    if (body.category_id) {
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
    }

    const nextMax =
      body.max_daily_quantity !== undefined
        ? body.max_daily_quantity
        : row.max_daily_quantity;
    const nextPrepared = row.prepared_quantity ?? 0;

    if (nextMax !== null && nextPrepared > nextMax) {
      return NextResponse.json(
        {
          error:
            "Prepared quantity exceeds daily max. Lower prepared count on the staff availability screen or raise the max.",
        },
        { status: 400 },
      );
    }

    let nextAvailable = row.is_available;
    if (nextMax !== null && nextPrepared >= nextMax) {
      nextAvailable = false;
    } else if (body.is_available !== undefined) {
      nextAvailable = body.is_available;
    }

    const updatePayload: Record<string, unknown> = {};
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.category_id !== undefined) updatePayload.category_id = body.category_id;
    if (body.price !== undefined) updatePayload.price = body.price;
    if (body.is_veg !== undefined) updatePayload.is_veg = body.is_veg;
    if (body.max_daily_quantity !== undefined) {
      updatePayload.max_daily_quantity = body.max_daily_quantity;
    }
    if (body.tags !== undefined) updatePayload.tags = body.tags;
    if (body.image_url !== undefined) updatePayload.image_url = body.image_url;

    const touchAvailability =
      body.is_available !== undefined || body.max_daily_quantity !== undefined;
    if (touchAvailability) {
      updatePayload.is_available = nextAvailable;
    }

    const { data: updated, error: updateError } = await admin
      .from("menu_items")
      .update(updatePayload)
      .eq("id", itemId)
      .eq("canteen_id", profile.canteen_id)
      .select(SELECT)
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "Update failed" },
        { status: 400 },
      );
    }

    return NextResponse.json({ item: serializeItem(updated) });
  }

  const staffParsed = staffPatchSchema.safeParse(json);
  if (!staffParsed.success) {
    return NextResponse.json(
      { error: formatZodBodyError(staffParsed.error) },
      { status: 400 },
    );
  }

  const body = staffParsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { data: row, error: fetchError } = await admin
    .from("menu_items")
    .select(SELECT)
    .eq("id", itemId)
    .eq("canteen_id", profile.canteen_id)
    .maybeSingle();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (row.deleted_at) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const nextMax =
    body.max_daily_quantity !== undefined
      ? body.max_daily_quantity
      : row.max_daily_quantity;

  const nextPrepared =
    body.prepared_quantity !== undefined
      ? body.prepared_quantity
      : row.prepared_quantity;

  if (nextMax !== null && nextPrepared > nextMax) {
    return NextResponse.json(
      {
        error:
          "Prepared quantity cannot exceed daily max. Lower prepared count or raise the max.",
      },
      { status: 400 },
    );
  }

  let nextAvailable = row.is_available;
  if (nextMax !== null && nextPrepared >= nextMax) {
    nextAvailable = false;
  } else if (body.is_available !== undefined) {
    nextAvailable = body.is_available;
  }

  const updatePayload: Record<string, unknown> = {};
  if (body.prepared_quantity !== undefined) {
    updatePayload.prepared_quantity = nextPrepared;
  }
  if (body.max_daily_quantity !== undefined) {
    updatePayload.max_daily_quantity = body.max_daily_quantity;
  }
  const touchAvailability =
    body.is_available !== undefined ||
    body.prepared_quantity !== undefined ||
    body.max_daily_quantity !== undefined;
  if (touchAvailability) {
    updatePayload.is_available = nextAvailable;
  }

  const { data: updated, error: updateError } = await admin
    .from("menu_items")
    .update(updatePayload)
    .eq("id", itemId)
    .eq("canteen_id", profile.canteen_id)
    .select(SELECT)
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "Update failed" },
      { status: 400 },
    );
  }

  const full = serializeItem(updated);
  const { deleted_at, ...staffItem } = full;
  void deleted_at;
  return NextResponse.json({ item: staffItem });
}

export async function DELETE(_request: Request, context: RouteParams) {
  const { itemId } = await context.params;

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
    .from("menu_items")
    .update({
      deleted_at: new Date().toISOString(),
      is_available: false,
    })
    .eq("id", itemId)
    .eq("canteen_id", profile.canteen_id)
    .is("deleted_at", null)
    .select(SELECT)
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item: serializeItem(updated) });
}
