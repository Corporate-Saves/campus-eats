import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z
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

const SELECT =
  "id, category_id, canteen_id, name, description, price, image_url, is_veg, is_available, max_daily_quantity, prepared_quantity, tags";

type RouteParams = { params: Promise<{ itemId: string }> };

function formatZodBodyError(error: z.ZodError): string {
  const flat = error.flatten();
  const form = flat.formErrors[0];
  if (form) return form;
  const fieldParts: string[] = [];
  for (const [key, msgs] of Object.entries(flat.fieldErrors)) {
    if (!Array.isArray(msgs)) continue;
    for (const msg of msgs) {
      fieldParts.push(`${key}: ${msg}`);
    }
  }
  if (fieldParts.length > 0) return fieldParts.join("; ");
  return "Invalid body";
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

  if (
    profile.role !== "canteen_staff" &&
    profile.role !== "canteen_owner"
  ) {
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

  const { data: row, error: fetchError } = await admin
    .from("menu_items")
    .select(SELECT)
    .eq("id", itemId)
    .eq("canteen_id", profile.canteen_id)
    .maybeSingle();

  if (fetchError || !row) {
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

  const price =
    typeof updated.price === "string"
      ? parseFloat(updated.price)
      : updated.price;

  const item = {
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
  };

  return NextResponse.json({ item });
}
