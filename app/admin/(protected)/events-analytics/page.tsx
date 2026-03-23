"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type EventRow = {
  event_name: string;
  total_athletes: number;
  avg_travel_miles: number | null;
  max_travel_miles: number | null;
  out_of_state_count: number;
  event_score: number; // 🔥 NEW
};

function formatMiles(v?: number | null) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) {
    return "—";
  }
  return `${Math.round(Number(v))} mi`;
}

function getScoreColor(score: number) {
  if (score > 500) return "#22c55e"; // green
  if (score > 200) return "#facc15"; // yellow
  return "#94a3b8"; // gray
}

export default function AdminEventsAnalyticsPage() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch("/api/admin/events/analytics", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || "Failed to load event analytics");
        }

        if (!cancelled) {
          setRows(Array.isArray(data.rows) ? data.rows : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(String(e?.message || e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        padding: 20,
        maxWidth: 1200,
        margin: "0 auto",
        color: "#e5e7eb",
      }}
    >
      {/* HEADER */}
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
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              margin: 0,
              color: "#fff",
            }}
          >
            Event Travel Intelligence
          </h1>
          <p style={{ marginTop: 6, color: "#94a3b8" }}>
            Travel analytics across all events.
          </p>
        </div>

        <Link
          href="/admin"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #334155",
            background: "#0b1220",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          ← Back to Admin
        </Link>
      </div>

      {/* TABLE */}
      <section
        style={{
          marginTop: 16,
          border: "1px solid #334155",
          borderRadius: 12,
          overflow: "hidden",
          background: "rgba(2,6,23,0.35)",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #334155" }}>
          <b style={{ color: "#fff" }}>Event Analytics</b>
        </div>

        {err ? (
          <div style={{ padding: 12, color: "#fca5a5" }}>{err}</div>
        ) : loading ? (
          <div style={{ padding: 12, color: "#94a3b8" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 12, color: "#94a3b8" }}>
            No event analytics found.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                  <th style={{ padding: "10px 12px" }}>Event</th>
                  <th style={{ padding: "10px 12px" }}>Athletes</th>
                  <th style={{ padding: "10px 12px" }}>Avg Travel</th>
                  <th style={{ padding: "10px 12px" }}>Max Travel</th>
                  <th style={{ padding: "10px 12px" }}>Out-of-State</th>
                  <th style={{ padding: "10px 12px" }}>Score</th> {/* 🔥 NEW */}
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.event_name}-${i}`}
                    style={{ borderTop: "1px solid #334155" }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "#fff",
                        fontWeight: 700,
                      }}
                    >
                      {r.event_name || "Unknown event"}
                    </td>

                    <td style={{ padding: "10px 12px" }}>
                      {r.total_athletes ?? 0}
                    </td>

                    <td style={{ padding: "10px 12px" }}>
                      {formatMiles(r.avg_travel_miles)}
                    </td>

                    <td style={{ padding: "10px 12px" }}>
                      {formatMiles(r.max_travel_miles)}
                    </td>

                    <td style={{ padding: "10px 12px" }}>
                      {r.out_of_state_count ?? 0}
                    </td>

                    {/* 🔥 SCORE COLUMN */}
                    <td
                      style={{
                        padding: "10px 12px",
                        fontWeight: 900,
                        color: getScoreColor(r.event_score ?? 0),
                      }}
                    >
                      {r.event_score ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}