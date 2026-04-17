import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { applyRazorpayWalletTopupCaptured } from "@/lib/wallet/apply-razorpay-wallet-topup";

export const runtime = "nodejs";

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  amount: z.number().optional(),
});

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

  const result = await applyRazorpayWalletTopupCaptured({
    razorpay_order_id,
    razorpay_payment_id,
    expectedUserId: user.id,
  });

  if (!result.ok) {
    const status =
      result.error === "Order does not belong to this account" ||
      result.error === "Institution mismatch"
        ? 403
        : result.error === "Invalid order type" ||
            result.error === "Payment does not match order" ||
            result.error === "Payment is not captured" ||
            result.error === "Invalid order amount" ||
            result.error === "Payment amount mismatch" ||
            result.error === "Invalid order metadata" ||
            result.error === "Profile not found"
          ? 400
          : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  if (
    clientAmount != null &&
    Math.abs(clientAmount - result.amountRupees) > 0.001
  ) {
    return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    credited: result.credited,
    duplicate: result.duplicate,
    amount: result.amountRupees,
    wallet_balance: result.wallet_balance,
  });
}
