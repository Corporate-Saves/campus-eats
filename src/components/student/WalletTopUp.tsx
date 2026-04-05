"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useProfile } from "@/hooks/useProfile";
import { useTenant } from "@/context/TenantContext";
import { cn } from "@/lib/utils";

const QUICK_AMOUNTS = [50, 100, 200, 500] as const;

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

type CreateOrderResponse = {
  razorpay_order_id: string;
  amount: number;
  amount_paise: number;
  key_id: string;
  currency: string;
  error?: string;
};

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => {
  open: () => void;
};

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("No window"));
  }
  if ((window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Script load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = CHECKOUT_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(s);
  });
}

export function WalletTopUp({
  userEmail,
  userName,
}: {
  userEmail: string | null;
  userName: string | null;
}) {
  const router = useRouter();
  const { refetch: refetchProfile } = useProfile();
  const { institution } = useTenant();
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const primary = institution?.primary_color ?? "#FF6B35";

  const runTopUp = useCallback(
    async (amountRupees: number) => {
      if (inFlight.current) return;
      if (!Number.isFinite(amountRupees) || amountRupees < 10 || amountRupees > 5000) {
        toast.error("Enter an amount between ₹10 and ₹5000");
        return;
      }
      if (!Number.isInteger(amountRupees)) {
        toast.error("Use whole rupee amounts only");
        return;
      }

      inFlight.current = true;
      setBusy(true);
      try {
        const res = await fetch("/api/wallet/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amountRupees }),
        });
        const data = (await res.json()) as CreateOrderResponse;
        if (!res.ok) {
          toast.error(data.error ?? "Could not start payment");
          return;
        }

        await loadRazorpayScript();
        const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor })
          .Razorpay;
        if (!Razorpay) {
          toast.error("Payment UI failed to load");
          return;
        }

        const options: Record<string, unknown> = {
          key: data.key_id,
          amount: data.amount_paise,
          currency: data.currency,
          name: institution?.name ?? "CampusEats",
          description: "Wallet top-up",
          order_id: data.razorpay_order_id,
          prefill: {
            email: userEmail ?? undefined,
            name: userName ?? undefined,
          },
          theme: { color: primary },
          handler: async (response: RazorpaySuccessResponse) => {
            try {
              const verifyRes = await fetch("/api/wallet/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  amount: amountRupees,
                }),
              });
              const verifyJson = (await verifyRes.json()) as {
                success?: boolean;
                error?: string;
                amount?: number;
                credited?: boolean;
                duplicate?: boolean;
              };
              if (!verifyRes.ok || !verifyJson.success) {
                toast.error(verifyJson.error ?? "Payment verification failed");
                return;
              }
              const added = verifyJson.amount ?? amountRupees;
              if (verifyJson.duplicate) {
                toast.success("Payment was already applied to your wallet.");
              } else {
                toast.success(`₹${added.toFixed(0)} added to wallet!`);
              }
              await refetchProfile();
              router.refresh();
            } catch {
              toast.error("Verification request failed");
            } finally {
              inFlight.current = false;
              setBusy(false);
            }
          },
          modal: {
            ondismiss: () => {
              inFlight.current = false;
              setBusy(false);
            },
          },
        };

        const rzp = new Razorpay(options);
        rzp.open();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
        inFlight.current = false;
        setBusy(false);
      }
    },
    [institution?.name, primary, refetchProfile, router, userEmail, userName],
  );

  const submitCustom = () => {
    const n = parseInt(custom, 10);
    if (Number.isNaN(n)) {
      toast.error("Enter a valid amount");
      return;
    }
    void runTopUp(n);
  };

  return (
    <div className="rounded-2xl border border-muted/20 bg-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Add money
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {QUICK_AMOUNTS.map((amt) => (
          <button
            key={amt}
            type="button"
            disabled={busy}
            onClick={() => void runTopUp(amt)}
            className={cn(
              "rounded-xl border border-muted/25 bg-background py-3 text-sm font-semibold text-text transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50",
            )}
          >
            ₹{amt}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="number"
          min={10}
          max={5000}
          step={1}
          inputMode="numeric"
          placeholder="Custom amount (₹10–5000)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-muted/25 bg-background px-3 py-2.5 text-sm text-text outline-none ring-primary focus:ring-2"
        />
        <button
          type="button"
          disabled={busy}
          onClick={submitCustom}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {busy ? (
        <p className="mt-2 text-xs text-muted">Opening secure checkout…</p>
      ) : null}
    </div>
  );
}
