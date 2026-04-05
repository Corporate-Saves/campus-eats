import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ canteenId: string }> };

export async function PATCH(_request: Request, context: RouteParams) {
  const { canteenId } = await context.params;

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

  if (profile.canteen_id !== canteenId) {
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

  const { data: nextOpen, error: toggleError } = await admin.rpc(
    "toggle_canteen_is_open",
    { p_canteen_id: canteenId },
  );

  if (toggleError) {
    const m = toggleError.message?.toLowerCase() ?? "";
    if (m.includes("canteen_not_found")) {
      return NextResponse.json({ error: "Canteen not found" }, { status: 404 });
    }
    return NextResponse.json({ error: toggleError.message }, { status: 500 });
  }

  if (typeof nextOpen !== "boolean") {
    return NextResponse.json(
      { error: "Unexpected toggle response" },
      { status: 500 },
    );
  }

  return NextResponse.json({ is_open: nextOpen });
}
