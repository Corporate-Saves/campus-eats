import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireInstitutionAdminApi } from "@/lib/auth/require-institution-admin-api";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function normalizeTime(t: string | null): string | null {
  if (!t?.trim()) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] != null ? Number(m[3]) : 0;
  if (
    Number.isNaN(h) ||
    Number.isNaN(min) ||
    h < 0 ||
    h > 23 ||
    min < 0 ||
    min > 59
  ) {
    return null;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export async function GET() {
  const auth = await requireInstitutionAdminApi();
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

  const { data, error } = await admin
    .from("canteens")
    .select(
      "id, name, description, image_url, is_open, opening_time, closing_time, created_at",
    )
    .eq("institution_id", auth.institutionId)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ canteens: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireInstitutionAdminApi();
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const description = String(formData.get("description") ?? "").trim() || null;
  const openingRaw = String(formData.get("opening_time") ?? "").trim();
  const closingRaw = String(formData.get("closing_time") ?? "").trim();
  const opening_time = normalizeTime(openingRaw || null);
  const closing_time = normalizeTime(closingRaw || null);

  let image_url: string | null = null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image must be 5MB or smaller" },
        { status: 400 },
      );
    }
    const type = file.type || "application/octet-stream";
    if (!ALLOWED.has(type)) {
      return NextResponse.json(
        { error: "Use JPEG, PNG, WebP, or GIF" },
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
    const path = `${auth.institutionId}/canteens/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from("menu-images")
      .upload(path, buffer, {
        contentType: type,
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    const { data: pub } = admin.storage.from("menu-images").getPublicUrl(path);
    image_url = pub.publicUrl;
  }

  const { data: created, error: insertErr } = await admin
    .from("canteens")
    .insert({
      institution_id: auth.institutionId,
      name,
      description,
      image_url,
      opening_time,
      closing_time,
    })
    .select(
      "id, name, description, image_url, is_open, opening_time, closing_time, created_at",
    )
    .maybeSingle();

  if (insertErr || !created) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Create failed" },
      { status: 400 },
    );
  }

  return NextResponse.json({ canteen: created }, { status: 201 });
}
