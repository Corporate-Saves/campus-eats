import { createHmac, timingSafeEqual } from "crypto";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyRazorpayWalletTopupCaptured,
  getRazorpayForServer,
} from "@/lib/wallet/apply-razorpay-wallet-topup";

export const runtime = "nodejs";

function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(header, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type RefundEntity = {
  id?: string;
  payment_id?: string;
  amount?: number;
};

async function processRefundProcessed(entity: RefundEntity) {
  if (!entity.id || !entity.payment_id) return;
  const amountPaise = Number(entity.amount);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) return;
  const rupees = amountPaise / 100;

  const rz = getRazorpayForServer();
  const payment = (await rz.payments.fetch(entity.payment_id)) as {
    notes?: Record<string, string | undefined>;
  };
  const notes = payment.notes ?? {};
  if (String(notes.purpose ?? "") !== "wallet_topup") {
    return;
  }
  const userId = String(notes.user_id ?? "");
  const institutionId = String(notes.institution_id ?? "");
  if (!userId || !institutionId) return;

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[razorpay webhook] admin client", e);
    return;
  }

  const { error } = await admin.rpc("debit_wallet_razorpay_refund", {
    p_profile_id: userId,
    p_institution_id: institutionId,
    p_amount_rupees: rupees,
    p_reference_id: `razorpay_refund:${entity.id}`,
    p_description: "Razorpay gateway refund (wallet debited)",
  });
  if (error) {
    console.error(
      "[razorpay webhook] debit_wallet_razorpay_refund",
      error.message,
    );
  }
}

type RazorpayWebhookBody = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
    refund?: { entity?: RefundEntity };
  };
};

async function processRazorpayEvent(raw: string) {
  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(raw) as RazorpayWebhookBody;
  } catch {
    return;
  }

  const ev = body.event;
  if (ev === "payment.captured") {
    const pay = body.payload?.payment?.entity;
    if (pay?.order_id && pay?.id) {
      const result = await applyRazorpayWalletTopupCaptured({
        razorpay_order_id: pay.order_id,
        razorpay_payment_id: pay.id,
      });
      if (!result.ok) {
        console.error("[razorpay webhook] payment.captured", result.error);
      }
    }
    return;
  }

  if (ev === "refund.processed") {
    const ref = body.payload?.refund?.entity;
    if (ref) await processRefundProcessed(ref);
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(rawBody, sig)) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  after(() => {
    void processRazorpayEvent(rawBody).catch((e) => {
      console.error("[razorpay webhook] async error", e);
    });
  });

  return new NextResponse(null, { status: 200 });
}
