import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 400 });
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

  const path = `${profile.canteen_id}/${randomUUID()}.${ext}`;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from("menu-images")
    .upload(path, buffer, {
      contentType: type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 },
    );
  }

  const { data: pub } = admin.storage.from("menu-images").getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl });
}
