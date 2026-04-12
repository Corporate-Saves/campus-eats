"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Info,
  Megaphone,
  Package,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

function iconForType(type: string): LucideIcon {
  switch (type) {
    case "order_update":
      return Package;
    case "promo":
      return Megaphone;
    default:
      return Info;
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUnread(0);
      return;
    }
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("is_read", false);
    if (error) return;
    setUnread(count ?? 0);
  }, []);

  const fetchRecent = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, type, is_read, created_at")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) {
        toast.error(error.message);
        return;
      }
      setItems((data ?? []) as NotificationRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const ch = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `profile_id=eq.${user.id}`,
          },
          () => {
            void fetchUnreadCount();
            void fetchRecent();
          },
        )
        .subscribe();
      if (cancelled) {
        void supabase.removeChannel(ch);
        return;
      }
      channel = ch;
    })();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [fetchRecent, fetchUnreadCount]);

  useEffect(() => {
    if (!open) return;
    void fetchRecent();
  }, [open, fetchRecent]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/notifications/mark-read", {
        method: "PATCH",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not mark read");
        return;
      }
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {
      toast.error("Network error");
    }
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-muted hover:bg-background hover:text-text"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-muted/20 bg-surface py-2 shadow-xl"
          role="menu"
        >
          <div className="flex items-center justify-between border-b border-muted/15 px-3 pb-2">
            <p className="text-sm font-semibold text-text">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[min(70vh,320px)] overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted">
                Loading…
              </p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-muted/10">
                {items.map((n) => {
                  const Icon = iconForType(n.type);
                  return (
                    <li
                      key={n.id}
                      className="flex gap-3 px-3 py-2.5 text-left"
                    >
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/15 text-primary">
                        <Icon className="h-4 w-4" />
                        {!n.is_read ? (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-600"
                            aria-hidden
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text">
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">{n.body}</p>
                        <p className="mt-1 text-[11px] text-muted">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
