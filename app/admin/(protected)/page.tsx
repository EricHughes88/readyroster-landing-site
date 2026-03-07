// app/admin/(protected)/page.tsx
"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";

type OverviewResponse = {
  ok: boolean;
  days: number;
  totals: {
    new_users: number;
    active_users: number;
    needs_posted: number;
    match_requests: number;
    messages_sent: number;
  };
  trend: {
    new_users: { day: string; count: number }[];
    activity: { day: string; total: number }[];
  };
};

type TractionRow = {
  event?: string;
  event_name?: string;
  coach_needs: number;
  unique_coaches: number;
  athlete_interest: number;
  unique_athletes: number;
  supply_gap: number;
};

type TractionResponse = {
  ok: boolean;
  days: number;
  limit: number;
  rows?: TractionRow[];
  data?: TractionRow[];
  events?: TractionRow[];
  traction?: TractionRow[];
};

type FeedItem = {
  id: string | number;
  type: string;
  created_at: string;
  message?: string | null;
  meta?: any;
};

type FeedResponse = {
  ok: boolean;
  rows?: FeedItem[];
  feed?: FeedItem[];
  data?: FeedItem[];
  items?: FeedItem[];
};

type SessionUser = {
  id?: string | number;
  email?: string | null;
  role?: string | null;
  name?: string | null;
};

function clampDays(n: number) {
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(365, Math.floor(n)));
}

function toNum(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function pickArray<T>(obj: any, keys: string[]): T[] {
  for (const k of keys) {
    if (Array.isArray(obj?.[k])) return obj[k] as T[];
  }
  return [];
}

function displayEventName(r: TractionRow) {
  return String(r.event_name ?? r.event ?? "").trim() || "Unknown event";
}

function Sparkline({
  values,
  height = 44,
}: {
  values: number[];
  height?: number;
}) {
  const width = 280;
  const pad = 6;

  const safe = values.length ? values : [0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);

  const points = safe
    .map((v, i) => {
      const x = pad + (i * (width - pad * 2)) / Math.max(1, safe.length - 1);
      const t = max === min ? 0.5 : (v - min) / (max - min);
      const y = pad + (1 - t) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity={0.9}
      />
    </svg>
  );
}

type SortKey =
  | "event_name"
  | "coach_needs"
  | "unique_coaches"
  | "athlete_interest"
  | "unique_athletes"
  | "supply_gap";

export default function AdminDashboardPage() {
  const [days, setDays] = useState(30);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [traction, setTraction] = useState<TractionRow[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const [updatedAt, setUpdatedAt] = useState<string>("");

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("coach_needs");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const SUPER_EMAILS = ["eric@nuwaycombat.com"].map((s) => s.toLowerCase());

  async function fetchSessionUser(): Promise<SessionUser | null> {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return (data?.user as SessionUser) ?? null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    (async () => {
      const u = await fetchSessionUser();
      const email = String(u?.email ?? "").toLowerCase();
      setIsSuperAdmin(Boolean(email && SUPER_EMAILS.includes(email)));
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const d = clampDays(days);

        const [ovRes, trRes, fdRes] = await Promise.all([
          fetch(`/api/admin/analytics/overview?days=${d}`, { cache: "no-store" }),
          fetch(`/api/admin/analytics/event-traction?days=${d}&limit=50`, {
            cache: "no-store",
          }),
          fetch(`/api/admin/analytics/feed?limit=60`, { cache: "no-store" }),
        ]);

        const ov: OverviewResponse = await ovRes.json();
        const tr: TractionResponse = await trRes.json();
        const fd: FeedResponse = await fdRes.json();

        if (!ovRes.ok || !ov?.ok) {
          throw new Error((ov as any)?.message || "Failed overview");
        }
        if (!trRes.ok || !tr?.ok) {
          throw new Error((tr as any)?.message || "Failed traction");
        }
        if (!fdRes.ok || !fd?.ok) {
          throw new Error((fd as any)?.message || "Failed feed");
        }

        if (cancelled) return;

        setOverview(ov);

        const rows = pickArray<TractionRow>(tr, [
          "rows",
          "data",
          "events",
          "traction",
        ]).map((r) => ({
          ...r,
          coach_needs: toNum(r.coach_needs),
          unique_coaches: toNum(r.unique_coaches),
          athlete_interest: toNum(r.athlete_interest),
          unique_athletes: toNum(r.unique_athletes),
          supply_gap: toNum(r.supply_gap),
        }));

        setTraction(rows);

        const items = pickArray<FeedItem>(fd, ["rows", "feed", "data", "items"]);
        setFeed(items);

        setUpdatedAt(new Date().toLocaleString());
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [days]);

  const totals = overview?.totals;

  const newUsersSeries = useMemo(
    () => (overview?.trend?.new_users ?? []).map((d) => toNum(d.count)),
    [overview]
  );

  const activitySeries = useMemo(
    () => (overview?.trend?.activity ?? []).map((d) => toNum(d.total)),
    [overview]
  );

  const filteredSortedTraction = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const base = needle
      ? traction.filter((r) =>
          displayEventName(r).toLowerCase().includes(needle)
        )
      : traction.slice();

    const dir = sortDir === "asc" ? 1 : -1;

    base.sort((a, b) => {
      if (sortKey === "event_name") {
        const an = displayEventName(a).toLowerCase();
        const bn = displayEventName(b).toLowerCase();
        return an < bn ? -1 * dir : an > bn ? 1 * dir : 0;
      }

      const av = toNum((a as any)[sortKey]);
      const bv = toNum((b as any)[sortKey]);
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });

    return base;
  }, [traction, q, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(k);
      setSortDir(k === "event_name" ? "asc" : "desc");
    }
  }

  const navBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 10,
    textDecoration: "none",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
    minHeight: 36,
  };

  const thBtn: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    padding: 0,
    fontWeight: 800,
  };

  return (
    <main
      style={{
        padding: 20,
        maxWidth: 1200,
        margin: "0 auto",
        color: "#e5e7eb",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 34,
              fontWeight: 900,
              margin: 0,
              color: "#fff",
            }}
          >
            Admin Dashboard
          </h1>
          <p style={{ marginTop: 6, color: "#94a3b8" }}>
            New users + what users are putting out there (activity feed)
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link
              href={"/admin/athletes" as Route}
              prefetch={false}
              style={navBtn}
            >
              Athletes DB
            </Link>

            <Link
              href={"/admin/coaches" as Route}
              prefetch={false}
              style={navBtn}
            >
              Coaches DB
            </Link>

            <Link
              href={"/admin/insights" as Route}
              prefetch={false}
              style={navBtn}
            >
              Event Intelligence
            </Link>

            <Link
              href={"/admin/events" as Route}
              prefetch={false}
              style={navBtn}
            >
              Normalize Events
            </Link>

            {isSuperAdmin ? (
              <>
                <Link
                  href={"/admin/activity" as Route}
                  prefetch={false}
                  style={navBtn}
                >
                  Admin Activity
                </Link>

                <Link
                  href={"/admin/admins" as Route}
                  prefetch={false}
                  style={navBtn}
                >
                  Manage Admins
                </Link>
              </>
            ) : null}
          </div>

          <span style={{ color: "#94a3b8" }}>Range:</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{
              border: "1px solid #334155",
              background: "#0b1220",
              color: "#fff",
              padding: "8px 10px",
              borderRadius: 10,
              cursor: "pointer",
              minHeight: 36,
            }}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      {err && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #f99",
            borderRadius: 10,
            background: "#fff5f5",
            color: "#111",
          }}
        >
          <b>Error:</b> {err}
        </div>
      )}

      <section
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {[
          ["New users", toNum(totals?.new_users)],
          ["Active users", toNum(totals?.active_users)],
          ["Needs posted", toNum(totals?.needs_posted)],
          ["Match requests", toNum(totals?.match_requests)],
          ["Messages sent", toNum(totals?.messages_sent)],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 14,
              background: "rgba(2,6,23,0.35)",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 12 }}>{label}</div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: "#fff",
                marginTop: 6,
              }}
            >
              {loading ? "…" : value}
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <div
          style={{ border: "1px solid #334155", borderRadius: 12, padding: 12 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <b style={{ color: "#fff" }}>New users trend</b>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>
              {updatedAt ? `Updated: ${updatedAt}` : ""}
            </span>
          </div>
          <div style={{ marginTop: 10, color: "#e5e7eb" }}>
            {loading ? (
              <span style={{ color: "#94a3b8" }}>Loading…</span>
            ) : (
              <Sparkline values={newUsersSeries} />
            )}
          </div>
        </div>

        <div
          style={{ border: "1px solid #334155", borderRadius: 12, padding: 12 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <b style={{ color: "#fff" }}>Activity events trend</b>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>
              Includes logged actions (needs, interests, requests, messages, etc.)
            </span>
          </div>
          <div style={{ marginTop: 10, color: "#e5e7eb" }}>
            {loading ? (
              <span style={{ color: "#94a3b8" }}>Loading…</span>
            ) : (
              <Sparkline values={activitySeries} />
            )}
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: 14,
          border: "1px solid #334155",
          borderRadius: 12,
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #334155" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <b style={{ color: "#fff" }}>Top events by traction</b>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                Coach demand vs Athlete interest ({days} days)
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search events…"
                style={{
                  border: "1px solid #334155",
                  background: "#0b1220",
                  color: "#fff",
                  padding: "8px 10px",
                  borderRadius: 10,
                  minHeight: 36,
                  width: 220,
                }}
              />
              <span style={{ color: "#94a3b8", fontSize: 12 }}>
                {filteredSortedTraction.length} shown
              </span>
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "10px 12px" }}>
                  <button style={thBtn} onClick={() => toggleSort("event_name")}>
                    Event{" "}
                    {sortKey === "event_name"
                      ? sortDir === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
                  </button>
                </th>
                <th style={{ padding: "10px 12px" }}>
                  <button
                    style={thBtn}
                    onClick={() => toggleSort("coach_needs")}
                  >
                    Coach needs{" "}
                    {sortKey === "coach_needs"
                      ? sortDir === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
                  </button>
                </th>
                <th style={{ padding: "10px 12px" }}>
                  <button
                    style={thBtn}
                    onClick={() => toggleSort("unique_coaches")}
                  >
                    Unique coaches{" "}
                    {sortKey === "unique_coaches"
                      ? sortDir === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
                  </button>
                </th>
                <th style={{ padding: "10px 12px" }}>
                  <button
                    style={thBtn}
                    onClick={() => toggleSort("athlete_interest")}
                  >
                    Athlete interest{" "}
                    {sortKey === "athlete_interest"
                      ? sortDir === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
                  </button>
                </th>
                <th style={{ padding: "10px 12px" }}>
                  <button
                    style={thBtn}
                    onClick={() => toggleSort("unique_athletes")}
                  >
                    Unique athletes{" "}
                    {sortKey === "unique_athletes"
                      ? sortDir === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
                  </button>
                </th>
                <th style={{ padding: "10px 12px" }}>
                  <button
                    style={thBtn}
                    onClick={() => toggleSort("supply_gap")}
                  >
                    Supply gap{" "}
                    {sortKey === "supply_gap"
                      ? sortDir === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredSortedTraction.map((r, idx) => {
                const name = displayEventName(r);

                return (
                  <tr
                    key={`${name}-${idx}`}
                    style={{ borderTop: "1px solid #334155" }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <Link
                        href={`/admin/events/${encodeURIComponent(name)}` as Route}
                        prefetch={false}
                        style={{ color: "#fff", textDecoration: "underline" }}
                      >
                        {name}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {toNum(r.coach_needs)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {toNum(r.unique_coaches)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {toNum(r.athlete_interest)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {toNum(r.unique_athletes)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {toNum(r.supply_gap)}
                    </td>
                  </tr>
                );
              })}

              {!loading && filteredSortedTraction.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 12, color: "#94a3b8" }}>
                    No traction data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        style={{
          marginTop: 14,
          border: "1px solid #334155",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid #334155",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <b style={{ color: "#fff" }}>Recent activity feed</b>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>
            Showing {Math.min(10, feed.length)} latest actions
          </span>
        </div>

        <div style={{ padding: 12 }}>
          {!loading && feed.length === 0 ? (
            <div style={{ color: "#94a3b8" }}>No activity yet.</div>
          ) : (
            feed.slice(0, 10).map((f, i) => (
              <div
                key={`${f.id}-${i}`}
                style={{
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : "1px solid #334155",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ color: "#fff", fontWeight: 700 }}>{f.type}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    {f.created_at ? new Date(f.created_at).toLocaleString() : ""}
                  </div>
                </div>
                {f.message ? (
                  <div style={{ marginTop: 6, color: "#cbd5e1" }}>
                    {f.message}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}