import Razorpay from "razorpay";
import { createAdminClient } from "@/lib/supabase/admin";

export function getRazorpayForServer(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Missing Razorpay keys");
  }
  return new Razorpay({ key_id, key_secret });
}

type FetchedOrder = {
  notes?: Record<string, string | number | undefined>;
  amount: number;
};

type FetchedPayment = {
  order_id?: string;
  status?: string;
  amount?: number;
};

export type ApplyRazorpayWalletTopupResult =
  | {
      ok: true;
      credited: boolean;
      duplicate: boolean;
      amountRupees: number;
      wallet_balance: number | null;
    }
  | { ok: false; error: string };

/**
 * Credits wallet for a captured Razorpay payment on a wallet_topup order.
 * Idempotent via credit_wallet_topup (reference = payment id).
 */
export async function applyRazorpayWalletTopupCaptured(options: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  /** When set (e.g. client /api/wallet/verify), must match order notes.user_id */
  expectedUserId?: string;
}): Promise<ApplyRazorpayWalletTopupResult> {
  const { razorpay_order_id, razorpay_payment_id, expectedUserId } = options;

  let razorpay: Razorpay;
  try {
    razorpay = getRazorpayForServer();
  } catch {
    return { ok: false, error: "Payment provider is not configured" };
  }

  let order: FetchedOrder;
  let payment: FetchedPayment;
  try {
    order = (await razorpay.orders.fetch(
      razorpay_order_id,
    )) as unknown as FetchedOrder;
    payment = (await razorpay.payments.fetch(
      razorpay_payment_id,
    )) as unknown as FetchedPayment;
  } catch {
    return { ok: false, error: "Could not verify payment with Razorpay" };
  }

  const notes = order.notes ?? {};
  const noteUserId = String(notes.user_id ?? "");
  if (!noteUserId) {
    return { ok: false, error: "Invalid order metadata" };
  }

  if (expectedUserId != null && noteUserId !== expectedUserId) {
    return { ok: false, error: "Order does not belong to this account" };
  }

  if (String(notes.purpose ?? "") !== "wallet_topup") {
    return { ok: false, error: "Invalid order type" };
  }

  if (payment.order_id !== razorpay_order_id) {
    return { ok: false, error: "Payment does not match order" };
  }

  if (payment.status !== "captured") {
    return { ok: false, error: "Payment is not captured" };
  }

  const amountPaise = Number(order.amount);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    return { ok: false, error: "Invalid order amount" };
  }

  const amountRupees = amountPaise / 100;
  if (Number(payment.amount) !== amountPaise) {
    return { ok: false, error: "Payment amount mismatch" };
  }

  const institutionId = String(notes.institution_id ?? "");
  if (!institutionId) {
    return { ok: false, error: "Invalid order metadata" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Server configuration error" };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("institution_id")
    .eq("id", noteUserId)
    .maybeSingle();

  if (profileError || !profile?.institution_id) {
    return { ok: false, error: "Profile not found" };
  }

  if (profile.institution_id !== institutionId) {
    return { ok: false, error: "Institution mismatch" };
  }

  const { data: credited, error: creditError } = await admin.rpc(
    "credit_wallet_topup",
    {
      p_profile_id: noteUserId,
      p_institution_id: profile.institution_id,
      p_amount: amountRupees,
      p_reference_id: razorpay_payment_id,
      p_description: "Wallet top-up (Razorpay)",
    },
  );

  if (creditError) {
    const msg = creditError.message?.toLowerCase() ?? "";
    if (msg.includes("profile_update_failed")) {
      return { ok: false, error: "Could not update wallet" };
    }
    return { ok: false, error: creditError.message };
  }

  const { data: updatedProfile } = await admin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", noteUserId)
    .maybeSingle();

  const wb = updatedProfile?.wallet_balance;
  const wallet_balance =
    wb == null ? null : typeof wb === "string" ? parseFloat(wb) : Number(wb);

  return {
    ok: true,
    credited: credited === true,
    duplicate: credited === false,
    amountRupees,
    wallet_balance,
  };
}
