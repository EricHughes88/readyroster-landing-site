"use client";

import Link from "next/link";
import type { Route } from "next"; // ✅ typedRoutes fix
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
  event: string;
  event_name: string;
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

// ✅ Admin audit log item shape from /api/admin/audit
type AuditItem = {
  id: number;
  admin_user_id: number;
  admin_email: string | null;
  admin_firstname: string | null;
  admin_lastname: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  metadata: any;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

type AuditResponse = {
  ok: boolean;
  items?: AuditItem[];
  message?: string;
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

function niceAdminName(a: AuditItem) {
  const n = [a.admin_firstname, a.admin_lastname].filter(Boolean).join(" ").trim();
  return n || a.admin_email || `Admin #${a.admin_user_id}`;
}

/** Tiny sparkline (SVG polyline) */
function Sparkline({ values, height = 44 }: { values: number[]; height?: number }) {
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
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" opacity={0.9} />
    </svg>
  );
}

export default function AdminDashboardPage() {
  const [days, setDays] = useState(30);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [traction, setTraction] = useState<TractionRow[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  // ✅ NEW: audit log feed
  const [audit, setAudit] = useState<AuditItem[]>([]);

  // IMPORTANT: set this client-side only to avoid hydration mismatch
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const d = clampDays(days);

        const [ovRes, trRes, fdRes, auRes] = await Promise.all([
          fetch(`/api/admin/analytics/overview?days=${d}`, { cache: "no-store" }),
          fetch(`/api/admin/analytics/event-traction?days=${d}&limit=50`, { cache: "no-store" }),
          fetch(`/api/admin/analytics/feed?limit=60`, { cache: "no-store" }),
          // ✅ This endpoint logs the view server-side (view_admin_activity_feed)
          fetch(`/api/admin/audit?limit=20`, { cache: "no-store" }),
        ]);

        const ov: OverviewResponse = await ovRes.json();
        const tr: TractionResponse = await trRes.json();
        const fd: FeedResponse = await fdRes.json();
        const au: AuditResponse = await auRes.json();

        if (!ovRes.ok || !ov?.ok) throw new Error((ov as any)?.message || "Failed overview");
        if (!trRes.ok || !tr?.ok) throw new Error((tr as any)?.message || "Failed traction");
        if (!fdRes.ok || !fd?.ok) throw new Error((fd as any)?.message || "Failed feed");
        if (!auRes.ok || !au?.ok) throw new Error(au?.message || "Failed audit log");

        if (cancelled) return;

        setOverview(ov);

        const rows = pickArray<TractionRow>(tr, ["rows", "data", "events", "traction"]);
        setTraction(rows);

        const items = pickArray<FeedItem>(fd, ["rows", "feed", "data", "items"]);
        setFeed(items);

        setAudit(Array.isArray(au.items) ? au.items : []);

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

  // Shared “button” style (prevents “invisible” / tiny links)
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

  return (
    <main style={{ padding: 20, maxWidth: 1200, margin: "0 auto", color: "#e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0, color: "#fff" }}>
            Admin Dashboard
          </h1>
          <p style={{ marginTop: 6, color: "#94a3b8" }}>
            New users + what users are putting out there (activity feed)
          </p>
        </div>

        {/* ✅ RIGHT SIDE ACTIONS */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* ✅ Directory buttons */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href={"/admin/athletes" as Route} prefetch={false} style={navBtn}>
              Athletes DB
            </Link>

            <Link href={"/admin/coaches" as Route} prefetch={false} style={navBtn}>
              Coaches DB
            </Link>

            {/* ✅ NEW: Admin audit feed */}
            <Link href={"/admin/activity" as Route} prefetch={false} style={navBtn}>
              Admin Activity
            </Link>
          </div>

          {/* Range selector */}
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

      {/* Stat cards */}
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
            <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", marginTop: 6 }}>
              {loading ? "…" : value}
            </div>
          </div>
        ))}
      </section>

      {/* Trend charts */}
      <section
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <div style={{ border: "1px solid #334155", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <b style={{ color: "#fff" }}>New users trend</b>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>
              {updatedAt ? `Updated: ${updatedAt}` : ""}
            </span>
          </div>
          <div style={{ marginTop: 10, color: "#e5e7eb" }}>
            {loading ? <span style={{ color: "#94a3b8" }}>Loading…</span> : <Sparkline values={newUsersSeries} />}
          </div>
        </div>

        <div style={{ border: "1px solid #334155", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <b style={{ color: "#fff" }}>Activity events trend</b>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>
              Includes logged actions (needs, interests, requests, messages, etc.)
            </span>
          </div>
          <div style={{ marginTop: 10, color: "#e5e7eb" }}>
            {loading ? <span style={{ color: "#94a3b8" }}>Loading…</span> : <Sparkline values={activitySeries} />}
          </div>
        </div>
      </section>

      {/* Top events by traction */}
      <section style={{ marginTop: 14, border: "1px solid #334155", borderRadius: 12 }}>
        <div style={{ padding: 12, borderBottom: "1px solid #334155" }}>
          <b style={{ color: "#fff" }}>Top events by traction</b>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
            Coach demand vs Athlete interest ({days} days)
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "10px 12px" }}>Event</th>
                <th style={{ padding: "10px 12px" }}>Coach needs</th>
                <th style={{ padding: "10px 12px" }}>Unique coaches</th>
                <th style={{ padding: "10px 12px" }}>Athlete interest</th>
                <th style={{ padding: "10px 12px" }}>Unique athletes</th>
                <th style={{ padding: "10px 12px" }}>Supply gap</th>
              </tr>
            </thead>
            <tbody>
              {traction.map((r, idx) => (
                <tr key={`${r.event_name}-${idx}`} style={{ borderTop: "1px solid #334155" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <Link
                      href={`/admin/events/${encodeURIComponent(r.event_name)}`}
                      style={{ color: "#fff", textDecoration: "underline" }}
                    >
                      {r.event_name}
                    </Link>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{toNum(r.coach_needs)}</td>
                  <td style={{ padding: "10px 12px" }}>{toNum(r.unique_coaches)}</td>
                  <td style={{ padding: "10px 12px" }}>{toNum(r.athlete_interest)}</td>
                  <td style={{ padding: "10px 12px" }}>{toNum(r.unique_athletes)}</td>
                  <td style={{ padding: "10px 12px" }}>{toNum(r.supply_gap)}</td>
                </tr>
              ))}

              {!loading && traction.length === 0 && (
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

      {/* Recent activity feed */}
      <section style={{ marginTop: 14, border: "1px solid #334155", borderRadius: 12 }}>
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
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ color: "#fff", fontWeight: 700 }}>{f.type}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    {f.created_at ? new Date(f.created_at).toLocaleString() : ""}
                  </div>
                </div>
                {f.message ? <div style={{ marginTop: 6, color: "#cbd5e1" }}>{f.message}</div> : null}
              </div>
            ))
          )}
        </div>
      </section>

      {/* ✅ NEW: Admin audit log preview */}
      <section style={{ marginTop: 14, border: "1px solid #334155", borderRadius: 12 }}>
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid #334155",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <b style={{ color: "#fff" }}>Admin audit log</b>
          <Link href={"/admin/activity" as Route} style={{ color: "#fff", textDecoration: "underline", fontSize: 12 }}>
            View all
          </Link>
        </div>

        <div style={{ padding: 12 }}>
          {!loading && audit.length === 0 ? (
            <div style={{ color: "#94a3b8" }}>No admin audit activity yet.</div>
          ) : (
            audit.slice(0, 8).map((a) => (
              <div
                key={a.id}
                style={{
                  padding: "10px 0",
                  borderTop: "1px solid #334155",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ color: "#fff", fontWeight: 700 }}>
                    {niceAdminName(a)} — {a.action}
                    {a.entity_type ? (
                      <span style={{ color: "#94a3b8", fontWeight: 600 }}>
                        {" "}
                        • {a.entity_type}
                        {a.entity_id ? ` #${a.entity_id}` : ""}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                  </div>
                </div>

                {a.metadata ? (
                  <pre
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#cbd5e1",
                      background: "#0b1220",
                      border: "1px solid #334155",
                      borderRadius: 10,
                      padding: 10,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(a.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}