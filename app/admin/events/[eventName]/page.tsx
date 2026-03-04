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
  | {
      ok: true;
      event_name: string;
      event_key: string;
      needs: NeedRow[];
      interests: InterestRow[];
    }
  | { ok: false; message?: string };

function safeStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

function escapeCsv(v: any) {
  const s = safeStr(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(filename: string, headers: string[], rows: any[]) {
  const csv =
    headers.join(",") +
    "\n" +
    rows
      .map((r) => headers.map((h) => escapeCsv((r as any)[h])).join(","))
      .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Convert slug -> key (what the API uses)
 * "cheesehead-duals" -> "cheesehead duals"
 * + strips punctuation to match backend normalization tighter
 */
function slugToEventKey(slug: string) {
  return String(slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AdminEventDetailsPage() {
  // Folder param is [eventName] (treat it as a slug)
  const params = useParams<{ eventName: string }>();
  const eventSlug = decodeURIComponent(params.eventName || "");
  const eventKey = slugToEventKey(eventSlug);

  const [tab, setTab] = useState<"needs" | "interests">("needs");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [eventTitle, setEventTitle] = useState<string>("");
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [interests, setInterests] = useState<InterestRow[]>([]);

  const [qNeeds, setQNeeds] = useState("");
  const [qInterests, setQInterests] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(
          `/api/admin/analytics/event-details?event_key=${encodeURIComponent(
            eventKey
          )}`,
          { cache: "no-store" }
        );
        const data: ApiResponse = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error((data as any)?.message || "Failed to load");
        }

        if (!cancelled) {
          setEventTitle((data as any).event_name || "");
          setNeeds(Array.isArray((data as any).needs) ? (data as any).needs : []);
          setInterests(
            Array.isArray((data as any).interests)
              ? (data as any).interests
              : []
          );
        }
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (eventKey) load();

    return () => {
      cancelled = true;
    };
  }, [eventKey]);

  const openNeeds = useMemo(
    () => needs.filter((n) => n.is_open !== false),
    [needs]
  );

  const interestsOnly = useMemo(
    () => interests.filter((i) => !!i.created_at),
    [interests]
  );

  const uniqueAthletes = useMemo(() => {
    const ids = interestsOnly
      .map((i) => i.wrestler_id)
      .filter((x): x is string | number => x !== null && x !== undefined);
    return new Set(ids).size;
  }, [interestsOnly]);

  const needsFiltered = useMemo(() => {
    const needle = qNeeds.trim().toLowerCase();
    if (!needle) return needs;
    return needs.filter((n) => {
      const hay = [
        n.team_name,
        n.age_group,
        n.weight_class,
        n.city,
        n.state,
        n.notes,
      ]
        .map((x) => String(x ?? ""))
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [needs, qNeeds]);

  const interestsFiltered = useMemo(() => {
    const needle = qInterests.trim().toLowerCase();
    if (!needle) return interestsOnly;
    return interestsOnly.filter((i) => {
      const hay = [
        i.first_name,
        i.last_name,
        i.age_group,
        i.weight_class,
        i.city,
        i.state,
        i.notes,
        i.wrestler_id,
      ]
        .map((x) => String(x ?? ""))
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [interestsOnly, qInterests]);

  const btn: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800,
  };

  return (
    <main style={{ padding: 20, maxWidth: 1100, margin: "0 auto", color: "#e5e7eb" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href={"/admin" as any} style={{ color: "#94a3b8", textDecoration: "none" }}>
          ← Back to Admin Dashboard
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#fff" }}>
            {eventTitle || eventKey || "Event"}
          </h1>
          <p style={{ marginTop: 6, color: "#94a3b8" }}>
            Drilldown: coach needs + athlete interest for this event.
          </p>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>
            Key: <span style={{ color: "#cbd5e1" }}>{eventKey || "—"}</span>
            {" • "}
            Needs: <span style={{ color: "#cbd5e1" }}>{loading ? "…" : needs.length}</span>
            {" • "}
            Open: <span style={{ color: "#cbd5e1" }}>{loading ? "…" : `${openNeeds.length}/${needs.length}`}</span>
            {" • "}
            Interest: <span style={{ color: "#cbd5e1" }}>{loading ? "…" : interestsOnly.length}</span>
            {" • "}
            Unique athletes: <span style={{ color: "#cbd5e1" }}>{loading ? "…" : uniqueAthletes}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setTab("needs")}
            style={{ ...btn, background: tab === "needs" ? "#111827" : "#0b1220" }}
          >
            Coach needs ({needs.length})
          </button>

          <button
            onClick={() => setTab("interests")}
            style={{ ...btn, background: tab === "interests" ? "#111827" : "#0b1220" }}
          >
            Athlete interest ({interestsOnly.length})
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
          <div
            style={{
              padding: 12,
              borderBottom: "1px solid #334155",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <b style={{ color: "#fff" }}>Coach needs</b>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                Showing {needsFiltered.length} of {needs.length}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={qNeeds}
                onChange={(e) => setQNeeds(e.target.value)}
                placeholder="Search needs…"
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

              <button
                style={btn}
                onClick={() =>
                  downloadCsv(
                    `${eventKey || "event"}-coach-needs.csv`,
                    [
                      "id",
                      "team_name",
                      "age_group",
                      "weight_class",
                      "city",
                      "state",
                      "is_open",
                      "notes",
                      "created_at",
                    ],
                    needsFiltered
                  )
                }
              >
                Export CSV
              </button>
            </div>
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
                {needsFiltered.map((n) => (
                  <tr key={String(n.id)} style={{ borderTop: "1px solid #334155" }}>
                    <td style={{ padding: "8px 10px", color: "#fff" }}>{n.team_name || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{n.age_group || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>{n.weight_class || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {(n.city || "—") + (n.state ? `, ${n.state}` : "")}
                    </td>
                    <td style={{ padding: "8px 10px" }}>{n.is_open === false ? "Closed" : "Open"}</td>
                    <td style={{ padding: "8px 10px", color: "#cbd5e1" }}>{n.notes || ""}</td>
                  </tr>
                ))}

                {needsFiltered.length === 0 && (
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
          <div
            style={{
              padding: 12,
              borderBottom: "1px solid #334155",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <b style={{ color: "#fff" }}>Athlete interest</b>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                Showing {interestsFiltered.length} of {interestsOnly.length} • Unique athletes: {uniqueAthletes}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={qInterests}
                onChange={(e) => setQInterests(e.target.value)}
                placeholder="Search interest…"
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

              <button
                style={btn}
                onClick={() =>
                  downloadCsv(
                    `${eventKey || "event"}-athlete-interest.csv`,
                    [
                      "id",
                      "wrestler_id",
                      "first_name",
                      "last_name",
                      "age_group",
                      "weight_class",
                      "city",
                      "state",
                      "notes",
                      "created_at",
                    ],
                    interestsFiltered
                  )
                }
              >
                Export CSV
              </button>
            </div>
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
                {interestsFiltered.map((i) => (
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

                {interestsFiltered.length === 0 && (
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