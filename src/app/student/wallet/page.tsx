import { redirect } from "next/navigation";
import {
  StudentWallet,
  type WalletTransactionRow,
} from "@/components/student/StudentWallet";
import { createClient } from "@/lib/supabase/server";

export default async function StudentWalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/wallet");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("wallet_balance, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-text">Wallet</h1>
        <p className="mt-2 text-sm text-red-600">
          {profileError?.message ?? "Could not load profile"}
        </p>
      </div>
    );
  }

  const { data: txRows, error: txError } = await supabase
    .from("wallet_transactions")
    .select("id, created_at, type, amount, description")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (txError) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-text">Wallet</h1>
        <p className="mt-2 text-sm text-red-600">{txError.message}</p>
      </div>
    );
  }

  const transactions: WalletTransactionRow[] = (txRows ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    type: r.type,
    amount:
      typeof r.amount === "string" ? parseFloat(r.amount) : Number(r.amount),
    description: r.description,
  }));

  const initialBalance =
    typeof profile.wallet_balance === "string"
      ? parseFloat(profile.wallet_balance)
      : Number(profile.wallet_balance);

  return (
    <StudentWallet
      initialBalance={initialBalance}
      transactions={transactions}
      userEmail={user.email ?? null}
      userName={profile.full_name ?? null}
    />
  );
}
