import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  amount: z.number().optional(),
});

function getRazorpay(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Missing Razorpay keys");
  }
  return new Razorpay({ key_id, key_secret });
}

function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    amount: clientAmount,
  } = parsed.data;

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Payment provider is not configured" },
      { status: 500 },
    );
  }

  if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, secret)) {
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  let razorpay: Razorpay;
  try {
    razorpay = getRazorpay();
  } catch {
    return NextResponse.json(
      { error: "Payment provider is not configured" },
      { status: 500 },
    );
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
    return NextResponse.json(
      { error: "Could not verify payment with Razorpay" },
      { status: 502 },
    );
  }

  const notes = order.notes ?? {};
  if (String(notes.user_id ?? "") !== user.id) {
    return NextResponse.json({ error: "Order does not belong to this account" }, { status: 403 });
  }

  if (String(notes.purpose ?? "") !== "wallet_topup") {
    return NextResponse.json({ error: "Invalid order type" }, { status: 400 });
  }

  if (payment.order_id !== razorpay_order_id) {
    return NextResponse.json({ error: "Payment does not match order" }, { status: 400 });
  }

  if (payment.status !== "captured") {
    return NextResponse.json(
      { error: "Payment is not captured yet" },
      { status: 400 },
    );
  }

  const amountPaise = Number(order.amount);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    return NextResponse.json({ error: "Invalid order amount" }, { status: 400 });
  }

  const amountRupees = amountPaise / 100;
  if (
    clientAmount != null &&
    Math.abs(clientAmount - amountRupees) > 0.001
  ) {
    return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
  }

  if (Number(payment.amount) !== amountPaise) {
    return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
  }

  const institutionId = String(notes.institution_id ?? "");
  if (!institutionId) {
    return NextResponse.json({ error: "Invalid order metadata" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("institution_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.institution_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  }

  if (profile.institution_id !== institutionId) {
    return NextResponse.json({ error: "Institution mismatch" }, { status: 403 });
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

  const { data: credited, error: creditError } = await admin.rpc(
    "credit_wallet_topup",
    {
      p_profile_id: user.id,
      p_institution_id: profile.institution_id,
      p_amount: amountRupees,
      p_reference_id: razorpay_payment_id,
      p_description: "Wallet top-up (Razorpay)",
    },
  );

  if (creditError) {
    const msg = creditError.message?.toLowerCase() ?? "";
    if (msg.includes("profile_update_failed")) {
      return NextResponse.json({ error: "Could not update wallet" }, { status: 500 });
    }
    return NextResponse.json({ error: creditError.message }, { status: 500 });
  }

  const { data: updatedProfile } = await admin
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    credited: credited === true,
    duplicate: credited === false,
    amount: amountRupees,
    wallet_balance: updatedProfile?.wallet_balance ?? null,
  });
}
