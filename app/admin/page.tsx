// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type OverviewResponse = {
  ok: boolean;
  rangeDays: number;
  generatedAt: string;
  kpis: {
    new_users: number;
    active_users: number;
    needs_created: number;
    matches_requested: number;
    messages_sent: number;
  };
  series: { day: string; new_users: number; activity_events: number }[];
};

type FeedItem = {
  id: number;
  user_id: number;
  event_type: string;
  entity_type: string | null;
  entity_id: number | null;
  metadata: any;
  created_at: string;
};

type TractionItem = {
  event_name: string;
  coach_needs: number;
  unique_coaches: number;
  athlete_interest: number;
  unique_athletes: number;
  supply_gap: number;
};

type ApiError = { ok: false; message?: string; details?: unknown };
type OverviewApiResponse = OverviewResponse | ApiError;
type FeedApiResponse = { ok: true; items: FeedItem[] } | ApiError;
type TractionApiResponse = { ok: true; days: number; items: TractionItem[] } | ApiError;

function fmtDay(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString();
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleString();
}

function Sparkline({ values }: { values: number[] }) {
  const w = 220;
  const h = 40;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);

  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts.join(" ")} />
    </svg>
  );
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;

  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [traction, setTraction] = useState<TractionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/login";
    }
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (status !== "authenticated") return;

      if (role !== "Admin") {
        setErr("You are logged in, but you do not have Admin access.");
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const [oRes, fRes, tRes] = await Promise.all([
          fetch(`/api/admin/analytics/overview?days=${days}`),
          fetch(`/api/admin/analytics/feed?limit=60`),
          fetch(`/api/admin/analytics/event-traction?days=${days}&limit=50`),
        ]);

        const oJson = (await oRes.json()) as OverviewApiResponse;
        const fJson = (await fRes.json()) as FeedApiResponse;
        const tJson = (await tRes.json()) as TractionApiResponse;

        if (!oRes.ok || !("ok" in oJson) || (oJson as any).ok !== true) {
          const msg = (oJson as any)?.message || `Overview failed (${oRes.status})`;
          throw new Error(msg);
        }

        if (!fRes.ok || !("ok" in fJson) || (fJson as any).ok !== true) {
          const msg = (fJson as any)?.message || `Feed failed (${fRes.status})`;
          throw new Error(msg);
        }

        if (!tRes.ok || !("ok" in tJson) || (tJson as any).ok !== true) {
          const msg = (tJson as any)?.message || `Event traction failed (${tRes.status})`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setOverview(oJson as OverviewResponse);
          setFeed((fJson as any).items || []);
          setTraction((tJson as any).items || []);
        }
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [days, role, status]);

  const newUsersValues = overview?.series?.map((r) => r.new_users) ?? [];
  const activityValues = overview?.series?.map((r) => r.activity_events) ?? [];

  return (
    <main style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Admin Dashboard</h1>
          <p style={{ marginTop: 6, color: "#94a3b8" }}>
            New users + what users are putting out there (activity feed)
          </p>
          {status === "authenticated" && (
            <div style={{ color: "#94a3b8", fontSize: 12 }}>
              Logged in as {(session?.user as any)?.email} • role: {role}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#e5e7eb" }}>
            Range:
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{
                background: "#111827",
                color: "#ffffff",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "6px 10px",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value={7} style={{ background: "#111827", color: "#fff" }}>7 days</option>
              <option value={30} style={{ background: "#111827", color: "#fff" }}>30 days</option>
              <option value={90} style={{ background: "#111827", color: "#fff" }}>90 days</option>
            </select>
          </label>
        </div>
      </header>

      {status === "loading" && <div style={{ marginTop: 16, color: "#94a3b8" }}>Checking session…</div>}

      {err && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #f99", borderRadius: 10, background: "#fff5f5" }}>
          <b>Error:</b> {err}
        </div>
      )}

      <section style={{ marginTop: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {[
            ["New users", overview?.kpis?.new_users ?? 0],
            ["Active users", overview?.kpis?.active_users ?? 0],
            ["Needs posted", overview?.kpis?.needs_created ?? 0],
            ["Match requests", overview?.kpis?.matches_requested ?? 0],
            ["Messages sent", overview?.kpis?.messages_sent ?? 0],
          ].map(([label, value]) => (
            <div key={label} style={{ border: "1px solid #334155", borderRadius: 12, padding: 12 }}>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: "#fff" }}>{value as number}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #334155", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b style={{ color: "#fff" }}>New users trend</b>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>
              {overview?.generatedAt ? `Updated: ${fmtTime(overview.generatedAt)}` : ""}
            </span>
          </div>
          <div style={{ marginTop: 10, color: "#fff" }}>
            <Sparkline values={newUsersValues} />
          </div>
          <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12 }}>
            {overview?.series?.length
              ? `From ${fmtDay(overview.series[0].day)} to ${fmtDay(overview.series[overview.series.length - 1].day)}`
              : ""}
          </div>
        </div>

        <div style={{ border: "1px solid #334155", borderRadius: 12, padding: 12 }}>
          <b style={{ color: "#fff" }}>Activity events trend</b>
          <div style={{ marginTop: 10, color: "#fff" }}>
            <Sparkline values={activityValues} />
          </div>
          <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12 }}>
            Includes logged actions (needs, requests, messages, etc.)
          </div>
        </div>
      </section>

      {/* ✅ NEW: Top events table */}
      <section style={{ marginTop: 18 }}>
        <div style={{ border: "1px solid #334155", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b style={{ color: "#fff" }}>Top events by traction</b>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>
              Coach demand vs Athlete interest (last {days} days)
            </span>
          </div>

          <div style={{ marginTop: 10, overflowX: "auto" }}>
            {loading && <div style={{ color: "#94a3b8" }}>Loading…</div>}

            {!loading && traction.length === 0 && (
              <div style={{ color: "#94a3b8" }}>
                No traction data yet — once we start logging NEED_POSTED and ATHLETE_INTEREST, this will populate.
              </div>
            )}

            {!loading && traction.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", color: "#e5e7eb" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                    <th style={{ padding: "8px 6px" }}>Event</th>
                    <th style={{ padding: "8px 6px" }}>Coach needs</th>
                    <th style={{ padding: "8px 6px" }}>Unique coaches</th>
                    <th style={{ padding: "8px 6px" }}>Athlete interest</th>
                    <th style={{ padding: "8px 6px" }}>Unique athletes</th>
                    <th style={{ padding: "8px 6px" }}>Supply gap</th>
                  </tr>
                </thead>
                <tbody>
                  {traction.map((r) => (
                    <tr key={r.event_name} style={{ borderTop: "1px solid #334155" }}>
                      <td style={{ padding: "8px 6px", fontWeight: 800, color: "#fff" }}>{r.event_name}</td>
                      <td style={{ padding: "8px 6px" }}>{r.coach_needs}</td>
                      <td style={{ padding: "8px 6px" }}>{r.unique_coaches}</td>
                      <td style={{ padding: "8px 6px" }}>{r.athlete_interest}</td>
                      <td style={{ padding: "8px 6px" }}>{r.unique_athletes}</td>
                      <td style={{ padding: "8px 6px", fontWeight: 700 }}>
                        {r.supply_gap}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <div style={{ border: "1px solid #334155", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b style={{ color: "#fff" }}>Recent activity feed</b>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>Showing {feed.length} latest actions</span>
          </div>

          <div style={{ marginTop: 10 }}>
            {loading && <div style={{ color: "#94a3b8" }}>Loading…</div>}

            {!loading && feed.length === 0 && (
              <div style={{ color: "#94a3b8" }}>
                No activity yet — once you start logging events, this fills up.
              </div>
            )}

            {!loading && feed.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                {feed.map((it) => (
                  <div key={it.id} style={{ padding: 10, border: "1px solid #334155", borderRadius: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 700, color: "#fff" }}>
                        {it.event_type}
                        <span style={{ fontWeight: 400, color: "#94a3b8" }}> • user {it.user_id}</span>
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>{fmtTime(it.created_at)}</div>
                    </div>

                    <div style={{ marginTop: 6, color: "#e5e7eb", fontSize: 13 }}>
                      {it.entity_type ? (
                        <>
                          {it.entity_type} {it.entity_id ? `#${it.entity_id}` : ""}
                        </>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>No entity</span>
                      )}
                    </div>

                    {it.metadata && Object.keys(it.metadata).length > 0 && (
                      <pre
                        style={{
                          marginTop: 8,
                          padding: 10,
                          background: "#0b1220",
                          borderRadius: 8,
                          overflowX: "auto",
                          color: "#e5e7eb",
                          border: "1px solid #334155",
                        }}
                      >
{JSON.stringify(it.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
