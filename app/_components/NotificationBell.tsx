// app/_components/NotificationBell.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type NotificationRow = {
  id: number;
  type: string;
  title: string | null;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications?limit=10", {
        cache: "no-store",
      });
      const data = await res.json();
      if (data?.ok) {
        setUnreadCount(Number(data.unreadCount || 0));
        setItems(Array.isArray(data.notifications) ? data.notifications : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();

    // ✅ Instant refresh when Match page marks notifications read
    const onRefresh = () => refresh();
    window.addEventListener("rr-notifications-refresh", onRefresh);

    // ✅ Fallback polling
    const t = setInterval(refresh, 15000);

    return () => {
      window.removeEventListener("rr-notifications-refresh", onRefresh);
      clearInterval(t);
    };
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) refresh();
        }}
        className="relative rounded-lg border border-slate-800 bg-slate-900 px-2 py-2 text-white hover:bg-slate-800 transition"
        aria-label="Notifications"
      >
        {/* Bell icon */}
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="font-semibold text-white">Notifications</div>
            <button
              className="text-sm text-slate-300 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="max-h-[360px] overflow-auto">
            {loading && (
              <div className="px-4 py-3 text-sm text-slate-400">Loading…</div>
            )}

            {!loading && items.length === 0 && (
              <div className="px-4 py-6 text-sm text-slate-400">
                No notifications yet.
              </div>
            )}

            {!loading &&
              items.map((n) => (
                <Link
                  key={n.id}
                  href={(n.link || "#") as any}
                  className="block border-b border-slate-900 px-4 py-3 hover:bg-slate-900/60"
                  onClick={() => setOpen(false)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {n.title || "Notification"}
                      </div>
                      {n.body && (
                        <div className="mt-1 text-sm text-slate-300 line-clamp-2">
                          {n.body}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-slate-500">
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>

                    {!n.is_read && (
                      <span className="mt-1 h-2.5 w-2.5 flex-none rounded-full bg-red-500" />
                    )}
                  </div>
                </Link>
              ))}
          </div>

          <div className="border-t border-slate-800 px-4 py-3">
            {/* typedRoutes-safe */}
            <Link
              href={"/notifications" as any}
              className="text-sm text-slate-300 hover:text-white"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}