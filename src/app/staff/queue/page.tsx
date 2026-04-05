import { format } from "date-fns";
import { redirect } from "next/navigation";
import { OrderQueueBoard } from "@/components/staff/OrderQueueBoard";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { createClient } from "@/lib/supabase/server";

export default async function StaffQueuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/staff/queue");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("canteen_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.canteen_id) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6">
        <h1 className="text-2xl font-semibold text-text">Queue</h1>
        <p className="mt-2 text-sm text-muted">
          Your account is not assigned to a canteen. Ask an institution admin to
          link you to a kitchen.
        </p>
      </main>
    );
  }

  const { data: canteen, error: canteenError } = await supabase
    .from("canteens")
    .select("id, name, is_open")
    .eq("id", profile.canteen_id)
    .maybeSingle();

  if (canteenError || !canteen) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6">
        <h1 className="text-2xl font-semibold text-text">Queue</h1>
        <p className="mt-2 text-sm text-red-600">
          Could not load canteen details.
        </p>
      </main>
    );
  }

  const scheduledFor = format(new Date(), "yyyy-MM-dd");

  return (
    <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <StaffHeader
        canteenId={canteen.id}
        canteenName={canteen.name}
        initialIsOpen={canteen.is_open}
      />
      <OrderQueueBoard canteenId={canteen.id} scheduledFor={scheduledFor} />
    </main>
  );
}
