"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type NeedRow = {
  id: number | string;
  coach_user_id: number | string | null;
  team_name?: string | null;

  event_name: string | null;
  event_date: string | null;
  weight_class: string | null;
  age_group: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  is_open: boolean | null;
  created_at: string | null;
};

type InterestRow = {
  id: number | string;
  wrestler_id: number | string | null;

  parent_user_id: number | string | null;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  state: string | null;

  age_group: string | null;
  weight_class: string | null;
  event_name: string | null;
  event_date: string | null;
  notes: string | null;
  created_at: string | null;
};

type ApiResponse =
  | { ok: true; event: string; needs: NeedRow[]; interests: InterestRow[] }
  | { ok: false; message?: string };

export default function AdminEventDetailsPage() {
  const params = useParams<{ eventName: string }>();
  const eventName = decodeURIComponent(params.eventName || "");

  const [tab, setTab] = useState<"needs" | "interests">("needs");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [interests, setInterests] = useState<InterestRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(
          `/api/admin/analytics/event-details?event=${encodeURIComponent(eventName)}`,
          { cache: "no-store" }
        );
        const data: ApiResponse = await res.json();

        if (!res.ok || !data.ok) throw new Error((data as any)?.message || "Failed to load");

        if (!cancelled) {
          setNeeds(Array.isArray((data as any).needs) ? (data as any).needs : []);
          setInterests(Array.isArray((data as any).interests) ? (data as any).interests : []);
        }
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (eventName) load();

    return () => {
      cancelled = true;
    };
  }, [eventName]);

  // ✅ Only count real wrestler ids (ignore null)
  const uniqueAthletes = useMemo(() => {
    const ids = interests
      .map((i) => i.wrestler_id)
      .filter((x): x is string | number => x !== null && x !== undefined);
    return new Set(ids).size;
  }, [interests]);

  const openNeeds = useMemo(() => needs.filter((n) => n.is_open !== false), [needs]);

  // ✅ Defensive: "interests" table should NEVER show rows that don't have created_at.
  // This makes it impossible for "Open/Closed" to appear in Submitted.
  const interestsOnly = useMemo(
    () => interests.filter((i) => !!i.created_at),
    [interests]
  );

  return (
    <main style={{ padding: 20, maxWidth: 1100, margin: "0 auto", color: "#e5e7eb" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href={"/admin" as any} style={{ color: "#94a3b8", textDecoration: "none" }}>
          ← Back to Admin Dashboard
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#fff" }}>{eventName}</h1>
          <p style={{ marginTop: 6, color: "#94a3b8" }}>
            Drilldown: coach needs + athlete interest for this event.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setTab("needs")}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #334155",
              background: tab === "needs" ? "#111827" : "transparent",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Coach needs ({needs.length})
          </button>

          <button
            onClick={() => setTab("interests")}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #334155",
              background: tab === "interests" ? "#111827" : "transparent",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Athlete interest ({interests.length})
          </button>
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #f99", borderRadius: 10, background: "#fff5f5", color: "#111" }}>
          <b>Error:</b> {err}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 16, color: "#94a3b8" }}>Loading…</div>
      ) : tab === "needs" ? (
        <section style={{ marginTop: 16, border: "1px solid #334155", borderRadius: 12 }}>
          <div style={{ padding: 12, borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between" }}>
            <b style={{ color: "#fff" }}>Coach needs</b>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>
              Open: {openNeeds.length}/{needs.length}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                  <th style={{ padding: "8px 10px" }}>Team</th>
                  <th style={{ padding: "8px 10px" }}>Age</th>
                  <th style={{ padding: "8px 10px" }}>Weight</th>
                  <th style={{ padding: "8px 10px" }}>City</th>
                  <th style={{ padding: "8px 10px" }}>Open</th>
                  <th style={{ padding: "8px 10px" }}>Notes</th>
                </tr>
              </thead>

              <tbody>
                {needs.map((n) => (
                  <tr key={String(n.id)} style={{ borderTop: "1px solid #334155" }}>
                    <td style={{ padding: "8px 10px", color: "#fff" }}>{n.team_name || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{n.age_group || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{n.weight_class || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {(n.city || "—") + (n.state ? `, ${n.state}` : "")}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {n.is_open === false ? "Closed" : "Open"}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{n.notes || ""}</td>
                  </tr>
                ))}

                {needs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 12, color: "#94a3b8" }}>
                      No coach needs found for this event.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section style={{ marginTop: 16, border: "1px solid #334155", borderRadius: 12 }}>
          <div style={{ padding: 12, borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between" }}>
            <b style={{ color: "#fff" }}>Athlete interest</b>
            <span style={{ color: "#94a3b8", fontSize: 12 }}>Unique athletes: {uniqueAthletes}</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                  <th style={{ padding: "8px 10px" }}>Athlete</th>
                  <th style={{ padding: "8px 10px" }}>Age</th>
                  <th style={{ padding: "8px 10px" }}>Weight</th>
                  <th style={{ padding: "8px 10px" }}>Location</th>
                  <th style={{ padding: "8px 10px" }}>Submitted</th>
                </tr>
              </thead>

              <tbody>
                {/* ✅ ONLY interests, never needs */}
                {interestsOnly.map((i) => (
                  <tr key={String(i.id)} style={{ borderTop: "1px solid #334155" }}>
                    <td style={{ padding: "8px 10px", color: "#fff" }}>
                      {`${i.first_name ?? ""} ${i.last_name ?? ""}`.trim() ||
                        `Wrestler #${i.wrestler_id ?? "?"}`}
                    </td>
                    <td style={{ padding: "8px 10px" }}>{i.age_group || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{i.weight_class || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {(i.city || "—") + (i.state ? `, ${i.state}` : "")}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>
                      {i.created_at ? new Date(i.created_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}

                {interestsOnly.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 12, color: "#94a3b8" }}>
                      No athlete interest found for this event.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}