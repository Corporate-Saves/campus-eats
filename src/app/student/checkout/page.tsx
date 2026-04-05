import { format } from "date-fns";
import { redirect } from "next/navigation";
import { StudentCheckout } from "@/components/student/StudentCheckout";
import { createClient } from "@/lib/supabase/server";

export default async function StudentCheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/checkout");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("institution_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.institution_id) {
    redirect("/register");
  }

  const { data: canteenRow } = await supabase
    .from("canteens")
    .select("id, name")
    .eq("institution_id", profile.institution_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!canteenRow) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-text">Checkout</h1>
        <p className="mt-2 text-sm text-muted">
          No canteen is available for your institution yet.
        </p>
      </div>
    );
  }

  const scheduledFor = format(new Date(), "yyyy-MM-dd");

  return (
    <StudentCheckout
      canteenId={canteenRow.id}
      canteenName={canteenRow.name}
      scheduledFor={scheduledFor}
    />
  );
}
