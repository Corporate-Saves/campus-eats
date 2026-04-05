"use client";

import { format, parseISO } from "date-fns";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { WalletTopUp } from "./WalletTopUp";

export type WalletTransactionRow = {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  description: string | null;
};

function TxIcon({ type }: { type: string }) {
  if (type === "topup") {
    return (
      <ArrowUp className="h-4 w-4 text-emerald-600" aria-hidden />
    );
  }
  if (type === "order_payment") {
    return (
      <ArrowDown className="h-4 w-4 text-red-600" aria-hidden />
    );
  }
  if (type === "refund") {
    return (
      <RotateCcw className="h-4 w-4 text-emerald-600" aria-hidden />
    );
  }
  return (
    <span className="inline-block h-4 w-4 text-muted" aria-hidden>
      ·
    </span>
  );
}

function amountDisplay(
  type: string,
  amount: number,
): { text: string; className: string } {
  const n = Number(amount);
  const isDebit = type === "order_payment" || n < 0;
  const abs = Math.abs(n);
  if (isDebit) {
    return {
      text: `−₹${abs.toFixed(0)}`,
      className: "font-semibold text-red-600",
    };
  }
  return {
    text: `+₹${abs.toFixed(0)}`,
    className: "font-semibold text-emerald-600",
  };
}

export function StudentWallet({
  initialBalance,
  transactions,
  userEmail,
  userName,
}: {
  initialBalance: number;
  transactions: WalletTransactionRow[];
  userEmail: string | null;
  userName: string | null;
}) {
  const { profile } = useProfile();
  const balance =
    profile?.wallet_balance != null
      ? Number(profile.wallet_balance)
      : initialBalance;

  return (
    <div className="pb-8">
      <h1 className="text-2xl font-bold text-text">Wallet</h1>
      <p className="mt-1 text-sm text-muted">Add money and view activity</p>

      <div className="mt-6 rounded-2xl border border-muted/20 bg-gradient-to-br from-primary/12 via-surface to-surface p-6 text-center ring-1 ring-primary/10">
        <p className="text-sm font-medium text-muted">Current balance</p>
        <p className="mt-2 text-4xl font-black tabular-nums tracking-tight text-text">
          ₹{balance.toFixed(0)}
        </p>
      </div>

      <div className="mt-6">
        <WalletTopUp userEmail={userEmail} userName={userName} />
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">
        Transaction history
      </h2>
      {transactions.length === 0 ? (
        <p className="mt-4 text-center text-sm text-muted">
          No transactions yet. Top up to get started.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {transactions.map((tx) => {
            const { text, className } = amountDisplay(tx.type, tx.amount);
            return (
              <li
                key={tx.id}
                className="flex items-center gap-3 rounded-xl border border-muted/15 bg-surface px-3 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background">
                  <TxIcon type={tx.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {tx.description?.trim() || tx.type.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-muted">
                    {format(parseISO(tx.created_at), "MMM d, yyyy · h:mm a")}
                  </p>
                </div>
                <span className={`shrink-0 tabular-nums ${className}`}>
                  {text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
