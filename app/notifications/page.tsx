// app/notifications/page.tsx
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

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications?limit=50", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) {
        setItems(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(Number(data.unreadCount || 0));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="mt-1 text-sm text-slate-300">
              Unread: <span className="font-semibold text-white">{unreadCount}</span>
            </p>
          </div>

          <button
            onClick={load}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold hover:bg-slate-800 transition"
          >
            Refresh
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
          {loading ? (
            <div className="px-4 py-6 text-slate-300">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-6 text-slate-300">No notifications yet.</div>
          ) : (
            <ul className="divide-y divide-slate-900">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={(n.link || "#") as any}
                    className="block px-4 py-4 hover:bg-slate-900/60"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold truncate">
                            {n.title || "Notification"}
                          </div>
                          {!n.is_read && (
                            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                          )}
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

                      <span className="text-xs text-slate-400">{n.type}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}