"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "campus_eats_pwa_install_dismissed_v1";

type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEventLike | null>(
    null,
  );
  const [timerDone, setTimerDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY) === "1") {
      setDismissed(true);
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEventLike);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const t = window.setTimeout(() => setTimerDone(true), 30_000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.clearTimeout(t);
    };
  }, []);

  const visible = timerDone && deferred != null && !dismissed && !isStandalone();

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* user dismissed native sheet */
    } finally {
      setDeferred(null);
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install CampusEats"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-muted/25 bg-surface px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text">
          Add CampusEats to your home screen for the best experience
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl border border-muted/30 px-4 py-2 text-sm font-medium text-muted transition hover:bg-background"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void install()}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
