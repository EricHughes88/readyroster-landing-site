// app/parent/messages/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ConversationRow = {
  match_id: number;

  // other side display
  other_name: string | null;
  other_email: string | null;

  // match state
  status: string | null;
  parent_ok: boolean | null;
  coach_ok: boolean | null;

  // last message
  last_message: string | null;
  last_sent_at: string | null;

  // unread notifications count
  unread_count: number | string;
};

type InboxApiResponse = {
  ok: boolean;
  conversations: ConversationRow[];
  error?: string;
};

type InboxItem = {
  matchId: number;
  coachName: string;
  eventName: string; // placeholder until inbox query adds it
  lastMessage: string;
  lastSentAt: string | null;
  unreadCount: number;
  badge: "Pending" | "Confirmed";
};

function formatTime(ts: string | null) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ParentMessagesInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function loadInbox(signal?: AbortSignal) {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch("/api/inbox/messages", {
        cache: "no-store",
        signal,
      });
      const data: InboxApiResponse = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error || `Failed to load inbox (HTTP ${res.status})`
        );
      }

      const convos = Array.isArray(data.conversations) ? data.conversations : [];

      const mapped: InboxItem[] = convos.map((c) => {
        const unread = Number(c.unread_count || 0);
        const confirmed = !!c.parent_ok && !!c.coach_ok;

        const coachName =
          (c.other_name && c.other_name.trim()) ||
          (c.other_email && c.other_email.trim()) ||
          "Coach";

        // If you later add event_name to the inbox query, wire it here.
        const eventName = "Event";

        return {
          matchId: Number(c.match_id),
          coachName,
          eventName,
          lastMessage: c.last_message ?? "",
          lastSentAt: c.last_sent_at,
          unreadCount: Number.isFinite(unread) ? unread : 0,
          badge: confirmed ? "Confirmed" : "Pending",
        };
      });

      // sort newest first
      mapped.sort((a, b) => {
        const ta = a.lastSentAt ? new Date(a.lastSentAt).getTime() : 0;
        const tb = b.lastSentAt ? new Date(b.lastSentAt).getTime() : 0;
        return tb - ta;
      });

      setItems(mapped);
    } catch (e: any) {
      // Abort is not an error we show
      if (String(e?.name || "") === "AbortError") return;

      setErr(String(e?.message ?? e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();

    loadInbox(ctrl.signal);

    // ✅ refresh inbox when chat page marks notifications read (instant unread badge updates)
    const onRefresh = () => loadInbox(ctrl.signal);
    window.addEventListener("rr-notifications-refresh", onRefresh);

    return () => {
      window.removeEventListener("rr-notifications-refresh", onRefresh);
      ctrl.abort();
    };
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 text-slate-100">
      <h1 className="text-3xl font-semibold mb-2">Messages</h1>
      <p className="text-slate-300 mb-6">
        View and continue conversations with coaches for your wrestler&apos;s
        matches.
      </p>

      <div className="mb-4">
        <Link
          href="/parent"
          className="inline-flex items-center rounded-md border border-white/10 px-3 py-1 text-sm hover:bg-white/10"
        >
          ← Back to dashboard
        </Link>
      </div>

      {err && (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-900/20 p-3 text-sm">
          {err}
        </div>
      )}

      {loading && <p className="text-slate-300">Loading your conversations...</p>}

      {!loading && items.length === 0 && (
        <p className="text-slate-300">
          You don&apos;t have any message conversations yet. Once you start
          messaging a coach about a match, those conversations will appear here.
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <Link
              key={item.matchId}
              // ✅ absolute route; typedRoutes-safe
              href={`/messages/match/${item.matchId}` as any}
              className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors"
            >
              <div className="flex justify-between items-center mb-1 gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {item.coachName}
                    <span className="text-xs text-slate-300 ml-2">
                      • {item.eventName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Pending/Confirmed badge */}
                  <span
                    className={`text-[11px] px-2 py-1 rounded-full border ${
                      item.badge === "Confirmed"
                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                        : "border-amber-400/40 bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    {item.badge}
                  </span>

                  {/* Unread badge */}
                  {item.unreadCount > 0 && (
                    <span className="text-[11px] px-2 py-1 rounded-full bg-red-600 text-white">
                      {item.unreadCount}
                    </span>
                  )}

                  {formatTime(item.lastSentAt) && (
                    <div className="text-xs text-slate-300">
                      {formatTime(item.lastSentAt)}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-sm text-slate-200 truncate">
                {item.lastMessage || (
                  <span className="text-slate-400">No messages yet.</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}