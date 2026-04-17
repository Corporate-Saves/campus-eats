"use client";

import { QRCodeSVG } from "qrcode.react";
import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";

type Props = {
  canteenId: string;
  baseUrl: string;
  canteenName: string;
};

export function StaffDisplayLinkClient({
  canteenId,
  baseUrl,
  canteenName,
}: Props) {
  const [copied, setCopied] = useState(false);

  const displayUrl = useMemo(() => {
    const origin = baseUrl.replace(/\/$/, "");
    return `${origin}/display/${canteenId}`;
  }, [baseUrl, canteenId]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }, [displayUrl]);

  const openFullScreen = useCallback(() => {
    window.open(displayUrl, "_blank", "noopener,noreferrer");
  }, [displayUrl]);

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">TV display</h1>
        <p className="mt-2 text-sm text-muted">
          Scan or open this on the canteen TV. The board shows preparing and
          ready tokens for <span className="font-medium text-text">{canteenName}</span>{" "}
          (today&apos;s orders only).
        </p>
      </div>

      <div className="flex flex-col items-center rounded-2xl border border-muted/20 bg-surface p-8 shadow-sm">
        <div className="rounded-xl bg-white p-4">
          <QRCodeSVG
            value={displayUrl}
            size={220}
            level="M"
            marginSize={2}
            fgColor="#050508"
            bgColor="#ffffff"
          />
        </div>
        <p className="mt-4 break-all text-center font-mono text-xs text-muted">
          {displayUrl}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={openFullScreen}
          className="rounded-xl border border-muted/30 px-5 py-3 text-sm font-semibold text-text hover:bg-muted/10"
        >
          Open full screen
        </button>
      </div>
    </div>
  );
}
