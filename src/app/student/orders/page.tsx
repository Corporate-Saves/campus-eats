import { redirect } from "next/navigation";
import {
  StudentOrdersList,
  type StudentOrderRow,
} from "@/components/student/StudentOrdersList";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/order-tracking";

function coerceStatus(s: string): OrderStatus {
  if (
    s === "PENDING" ||
    s === "ACCEPTED" ||
    s === "PREPARING" ||
    s === "READY" ||
    s === "COLLECTED" ||
    s === "CANCELLED"
  ) {
    return s;
  }
  return "PENDING";
}

export default async function StudentOrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/orders");
  }

  const { data: rows, error } = await supabase
    .from("orders")
    .select("id, created_at, token_number, total_amount, status, scheduled_for")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-text">Orders</h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
      </div>
    );
  }

  const orders: StudentOrderRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    token_number: r.token_number,
    total_amount:
      typeof r.total_amount === "string"
        ? parseFloat(r.total_amount)
        : r.total_amount,
    status: coerceStatus(r.status),
    scheduled_for: r.scheduled_for,
  }));

  return <StudentOrdersList orders={orders} />;
}
