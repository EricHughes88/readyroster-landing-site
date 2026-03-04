// app/admin/(protected)/insights/page.tsx
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
  message?: string;
};

type TractionRow = {
  event_name: string;
  coach_needs: number;
  unique_coaches: number;
  athlete_interest: number;
  unique_athletes: number;
  supply_gap: number;
};

type TractionResponse = {
  ok: boolean;
  rows?: TractionRow[];
  data?: TractionRow[];
  events?: TractionRow[];
  traction?: TractionRow[];
  message?: string;
};

function toNum(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function pickArray<T>(obj: any, keys: string[]): T[] {
  for (const k of keys) if (Array.isArray(obj?.[k])) return obj[k] as T[];
  return [];
}

function clampDays(n: number) {
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(365, Math.floor(n)));
}

export default function AdminInsightsPage() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [traction, setTraction] = useState<TractionRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const d = clampDays(days);

        const [ovRes, trRes] = await Promise.all([
          fetch(`/api/admin/analytics/overview?days=${d}`, { cache: "no-store" }),
          fetch(`/api/admin/analytics/event-traction?days=${d}&limit=100`, {
            cache: "no-store",
          }),
        ]);

        const ov: OverviewResponse = await ovRes.json();
        const tr: TractionResponse = await trRes.json();

        if (!ovRes.ok || !ov?.ok) throw new Error(ov?.message || "Failed overview");
        if (!trRes.ok || !tr?.ok) throw new Error(tr?.message || "Failed event traction");

        if (cancelled) return;

        setOverview(ov);
        setTraction(pickArray<TractionRow>(tr, ["rows", "data", "events", "traction"]));
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

  // extra “intelligence” metrics derived from what you already track
  const conversion = useMemo(() => {
    const needs = toNum(totals?.needs_posted);
    const reqs = toNum(totals?.match_requests);
    const msgs = toNum(totals?.messages_sent);

    return {
      requestsPerNeed: needs ? reqs / needs : 0,
      messagesPerRequest: reqs ? msgs / reqs : 0,
    };
  }, [totals]);

  const topEvents = useMemo(() => {
    // sort by demand+interest (traction) and keep top 25
    const copy = [...traction];
    copy.sort((a, b) => {
      const aScore = toNum(a.coach_needs) + toNum(a.athlete_interest);
      const bScore = toNum(b.coach_needs) + toNum(b.athlete_interest);
      return bScore - aScore;
    });
    return copy.slice(0, 25);
  }, [traction]);

  const card: React.CSSProperties = {
    border: "1px solid #334155",
    borderRadius: 14,
    padding: 14,
    background: "rgba(2,6,23,0.35)",
  };

  return (
    <main style={{ padding: 20, maxWidth: 1300, margin: "0 auto", color: "#e5e7eb" }}>
      <div style={{ marginBottom: 10 }}>
        <Link href={"/admin" as Route} style={{ color: "#cbd5e1", textDecoration: "underline" }}>
          ← Back to Admin
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#fff" }}>
            Event Intelligence
          </h1>
          <p style={{ marginTop: 6, color: "#94a3b8" }}>
            Signals to help you plan events: demand, supply, engagement, and conversion.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            marginTop: 12,
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

      {/* KPI row */}
      <section
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {[
          ["New users", toNum(totals?.new_users)],
          ["Active users", toNum(totals?.active_users)],
          ["Needs posted", toNum(totals?.needs_posted)],
          ["Match requests", toNum(totals?.match_requests)],
          ["Messages sent", toNum(totals?.messages_sent)],
          ["Req/Need", conversion.requestsPerNeed],
        ].map(([label, value]) => (
          <div key={String(label)} style={card}>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginTop: 6 }}>
              {loading ? "…" : typeof value === "number" && label === "Req/Need" ? value.toFixed(2) : value}
            </div>
          </div>
        ))}
      </section>

      {/* Conversion helper */}
      <section style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={card}>
          <div style={{ color: "#fff", fontWeight: 900 }}>Conversion signals</div>
          <div style={{ marginTop: 8, color: "#cbd5e1" }}>
            <div>
              <b>Requests per Need:</b>{" "}
              {loading ? "…" : conversion.requestsPerNeed.toFixed(2)}
            </div>
            <div style={{ marginTop: 6 }}>
              <b>Messages per Request:</b>{" "}
              {loading ? "…" : conversion.messagesPerRequest.toFixed(2)}
            </div>
            <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 12 }}>
              Higher values usually mean stronger demand + engagement.
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ color: "#fff", fontWeight: 900 }}>How to use this</div>
          <ul style={{ marginTop: 8, color: "#cbd5e1", lineHeight: 1.6 }}>
            <li>Sort events by total demand + interest to find “hot” events.</li>
            <li>Supply gap helps spot where you need more athletes (or more needs).</li>
            <li>Click an event to drill into the existing event page.</li>
          </ul>
        </div>
      </section>

      {/* Event table */}
      <section style={{ marginTop: 14, border: "1px solid #334155", borderRadius: 14 }}>
        <div style={{ padding: 12, borderBottom: "1px solid #334155" }}>
          <b style={{ color: "#fff" }}>Top events (by demand + interest)</b>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
            Showing up to {topEvents.length} events ({days} days)
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
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
              {topEvents.map((r, idx) => (
                <tr key={`${r.event_name}-${idx}`} style={{ borderTop: "1px solid #334155" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <Link
                      href={`/admin/events/${encodeURIComponent(r.event_name)}`}
                      style={{ color: "#fff", textDecoration: "underline", fontWeight: 800 }}
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

              {!loading && topEvents.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 12, color: "#94a3b8" }}>
                    No event traction data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}