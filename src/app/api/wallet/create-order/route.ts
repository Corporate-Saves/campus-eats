import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  amount: z.coerce
    .number()
    .int("Use a whole number of rupees")
    .min(10, "Minimum top-up is ₹10")
    .max(5000, "Maximum top-up is ₹5000"),
});

function getRazorpay(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET");
  }
  return new Razorpay({ key_id, key_secret });
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid amount" },
      { status: 400 },
    );
  }

  const amountRupees = parsed.data.amount;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("institution_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.institution_id) {
    return NextResponse.json(
      { error: "Profile or institution not found" },
      { status: 400 },
    );
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

  const amountPaise = amountRupees * 100;
  const receipt = `wt_${user.id.slice(0, 8)}_${Date.now()}`.slice(0, 40);

  try {
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        user_id: user.id,
        institution_id: profile.institution_id,
        purpose: "wallet_topup",
      },
    });

    return NextResponse.json({
      razorpay_order_id: order.id,
      amount: amountRupees,
      amount_paise: amountPaise,
      key_id: process.env.RAZORPAY_KEY_ID,
      currency: "INR",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
