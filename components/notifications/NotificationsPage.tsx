"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";

type NotificationItem = {
  id: number;
  user_id?: number | null;
  user_uuid?: string | null;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  link?: string | null;
  created_at?: string | null;
  is_read?: boolean | null;
};

type NotificationsApiResponse = {
  ok?: boolean;
  notifications?: NotificationItem[];
  unreadCount?: number;
  message?: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Props = {
  roleLabel: "Parent" | "Coach";
  dashboardHref: Route;
};

export default function NotificationsPage({
  roleLabel,
  dashboardHref,
}: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/notifications?limit=50", {
        cache: "no-store",
      });

      const data: NotificationsApiResponse = await res.json();

      if (!res.ok || data.ok === false) {
        throw new Error(data.message || "Failed to load notifications");
      }

      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load notifications");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  async function markOneAsRead(id: number) {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to mark notification as read");

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function markAllAsRead() {
    try {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);

      await Promise.all(
        unreadIds.map((id) =>
          fetch(`/api/notifications/${id}/read`, { method: "POST" })
        )
      );

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-slate-100">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{roleLabel} Notifications</h1>
          <p className="mt-2 text-slate-300">
            Stay up to date on matches, messages, and activity.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={dashboardHref}
            className="inline-flex rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            Back to Dashboard
          </Link>

          <button
            onClick={markAllAsRead}
            disabled={loading || unreadCount === 0}
            className="inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            Mark All Read
          </button>
        </div>
      </div>

      <div className="mb-6 inline-flex items-center rounded-full border border-red-700 bg-red-900/30 px-4 py-2 text-sm font-semibold text-red-200">
        {loading ? "Loading..." : `${unreadCount} unread`}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-slate-300">
          Loading notifications...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-700 bg-red-950/40 p-6 text-red-300">
          {error}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-900/40 p-10 text-center">
          <div className="text-lg font-semibold text-white">No notifications yet</div>
          <p className="mt-2 text-sm text-slate-300">
            When activity happens, it will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((n) => {
            const href = n.link?.trim() || null;

            return (
              <div
                key={n.id}
                className={`rounded-2xl border p-5 ${
                  n.is_read
                    ? "border-slate-700 bg-slate-900/50"
                    : "border-red-700 bg-red-950/20"
                }`}
              >
                <div className="flex justify-between gap-4">
                  <div className="flex-1">
                    {!n.is_read && (
                      <span className="inline-block h-2 w-2 bg-red-400 rounded-full mr-2" />
                    )}

                    <h2 className="text-lg font-semibold">
                      {n.title || "Notification"}
                    </h2>

                    {n.body && (
                      <p className="text-sm text-slate-300 mt-1">{n.body}</p>
                    )}

                    <div className="text-xs text-slate-400 mt-2">
                      {formatDateTime(n.created_at)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {href && (
                      <Link
                        href={href as Route}
                        onClick={() => {
                          if (!n.is_read) markOneAsRead(n.id);
                        }}
                        className="bg-red-600 px-3 py-1 rounded text-sm"
                      >
                        Open
                      </Link>
                    )}

                    {!n.is_read && (
                      <button
                        onClick={() => markOneAsRead(n.id)}
                        className="border px-3 py-1 rounded text-sm"
                      >
                        Read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}