"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type RadarRow = {
  wrestler_interest_id: number;
  coach_need_id: number;
  event_name: string | null;
  weight_class: string | null;
  age_group: string | null;
  wrestler_id: number | null;
  first_name: string | null;
  last_name: string | null;
  athlete_city: string | null;
  athlete_state: string | null;
  parent_user_id: number | null;
  parent_name: string | null;
  parent_email: string | null;
  coach_user_id: number | null;
  team_name: string | null;
  coach_name: string | null;
  coach_email: string | null;
  coach_city: string | null;
  coach_state: string | null;
  match_id: number | null;
  match_status: string | null;
  emailed_parent: boolean;
  emailed_coach: boolean;
  notification_created_at: string | null;
  match_score: number;
};

type ApiResponse = {
  ok: boolean;
  count?: number;
  rows?: RadarRow[];
  message?: string;
};

function safe(v: unknown) {
  return v == null ? "" : String(v);
}

export default function AdminMatchRadarPage() {
  const [rows, setRows] = useState<RadarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  const [eventFilter, setEventFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [onlyUnemailed, setOnlyUnemailed] = useState(true);

  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [bulkResult, setBulkResult] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const qs = new URLSearchParams();
      if (eventFilter) qs.set("event_name", eventFilter);
      if (stateFilter) qs.set("state", stateFilter);
      qs.set("limit", "500");

      const res = await fetch(`/api/admin/match-radar?${qs.toString()}`, {
        cache: "no-store",
      });

      const raw = await res.text();
      const data: ApiResponse = raw
        ? JSON.parse(raw)
        : { ok: false, message: "Empty response" };

      if (!res.ok || !data.ok) {
        setRows([]);
        setError(data.message || "Failed to load match radar");
        return;
      }

      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Failed to load match radar");
    } finally {
      setLoading(false);
    }
  }

  async function sendOutreach(row: RadarRow) {
    const key = `${row.wrestler_interest_id}-${row.coach_need_id}`;
    setSendingKey(key);
    setError("");
    setSuccess("");
    setBulkResult("");

    try {
      const res = await fetch("/api/admin/match-radar/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wrestler_interest_id: row.wrestler_interest_id,
          coach_need_id: row.coach_need_id,
        }),
      });

      const raw = await res.text();
      const data = raw
        ? JSON.parse(raw)
        : { ok: false, message: "Empty response" };

      if (!res.ok || !data?.ok) {
        setError(data?.message || "Failed to send outreach");
        return;
      }

      setSuccess("Outreach sent.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to send outreach");
    } finally {
      setSendingKey(null);
    }
  }

  async function sendBulkOutreach() {
    const targets = filteredRows
      .filter((row) => !(row.emailed_parent && row.emailed_coach))
      .map((row) => ({
        wrestler_interest_id: row.wrestler_interest_id,
        coach_need_id: row.coach_need_id,
      }));

    if (targets.length === 0) {
      setBulkResult("No visible matches need outreach.");
      return;
    }

    const confirmed = window.confirm(
      `Send outreach to ${targets.length} visible match${targets.length === 1 ? "" : "es"}?`
    );
    if (!confirmed) return;

    setBulkSending(true);
    setBulkProgress("Sending bulk outreach...");
    setBulkResult("");
    setError("");
    setSuccess("");
    setSendingKey(null);

    try {
      const res = await fetch("/api/admin/match-radar/send-bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pairs: targets,
        }),
      });

      const raw = await res.text();
      const data = raw
        ? JSON.parse(raw)
        : { ok: false, message: "Empty response" };

      if (!res.ok || !data?.ok) {
        setError(data?.message || "Failed to send bulk outreach");
        return;
      }

      setBulkResult(
        `Bulk outreach finished. Sent: ${data.sent ?? 0}. Failed: ${data.failed ?? 0}. Skipped: ${data.skipped ?? 0}.`
      );

      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to send bulk outreach");
    } finally {
      setBulkSending(false);
      setBulkProgress("");
    }
  }

  useEffect(() => {
    load();
  }, [eventFilter, stateFilter]);

  const eventOptions = useMemo(() => {
    return Array.from(
      new Set(rows.map((r) => safe(r.event_name)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const stateOptions = useMemo(() => {
    return Array.from(
      new Set(rows.map((r) => safe(r.athlete_state)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    let base = rows.slice();

    if (onlyUnemailed) {
      base = base.filter((row) => !(row.emailed_parent && row.emailed_coach));
    }

    return base;
  }, [rows, onlyUnemailed]);

  const outreachCount = useMemo(() => {
    return rows.filter((row) => !(row.emailed_parent && row.emailed_coach))
      .length;
  }, [rows]);

  const visibleOutreachCount = useMemo(() => {
    return filteredRows.filter(
      (row) => !(row.emailed_parent && row.emailed_coach)
    ).length;
  }, [filteredRows]);

  return (
    <main
      style={{
        padding: 20,
        maxWidth: 1500,
        margin: "0 auto",
        color: "#e5e7eb",
      }}
    >
      <div
        style={{
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 16,
          background: "rgba(2,6,23,0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#fff" }}
            >
              Admin Match Radar
            </h1>
            <p style={{ marginTop: 6, color: "#94a3b8" }}>
              Live view of every potential athlete/team match in Ready Roster.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "end",
              flexWrap: "wrap",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#94a3b8",
                  marginBottom: 6,
                }}
              >
                Event
              </label>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                style={{
                  border: "1px solid #334155",
                  background: "#0b1220",
                  color: "#fff",
                  padding: "8px 10px",
                  borderRadius: 10,
                  minHeight: 36,
                }}
              >
                <option value="">All Events</option>
                {eventOptions.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "#94a3b8",
                  marginBottom: 6,
                }}
              >
                Athlete State
              </label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                style={{
                  border: "1px solid #334155",
                  background: "#0b1220",
                  color: "#fff",
                  padding: "8px 10px",
                  borderRadius: 10,
                  minHeight: 36,
                }}
              >
                <option value="">All States</option>
                {stateOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid #334155",
                background: "#0b1220",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: 10,
                minHeight: 36,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              <input
                type="checkbox"
                checked={onlyUnemailed}
                onChange={(e) => setOnlyUnemailed(e.target.checked)}
              />
              Only Show Unemailed
            </label>

            <button
              onClick={sendBulkOutreach}
              disabled={bulkSending || visibleOutreachCount === 0}
              style={{
                border: "1px solid #334155",
                background:
                  visibleOutreachCount === 0 ? "#0f172a" : "#16a34a",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: 10,
                fontWeight: 800,
                cursor:
                  bulkSending || visibleOutreachCount === 0
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  bulkSending || visibleOutreachCount === 0 ? 0.7 : 1,
                minHeight: 36,
                whiteSpace: "nowrap",
              }}
            >
              {bulkSending
                ? "Sending Bulk Outreach..."
                : `Send Outreach to Visible (${visibleOutreachCount})`}
            </button>

            <button
              onClick={load}
              style={{
                border: "1px solid #334155",
                background: "#dc2626",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: 10,
                fontWeight: 800,
                cursor: "pointer",
                minHeight: 36,
              }}
            >
              Refresh
            </button>

            <Link
              href="/admin"
              style={{
                border: "1px solid #334155",
                background: "#0b1220",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 800,
                minHeight: 36,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Back to Admin
            </Link>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          color: "#94a3b8",
          fontSize: 14,
        }}
      >
        <div>
          {loading
            ? "Loading match radar..."
            : `${filteredRows.length} shown • ${rows.length} total potential matches`}
        </div>
        <div>{loading ? "" : `${outreachCount} still need outreach`}</div>
      </div>

      {bulkProgress ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #334155",
            borderRadius: 10,
            background: "#0b1220",
            color: "#fff",
          }}
        >
          {bulkProgress}
        </div>
      ) : null}

      {bulkResult ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #14532d",
            borderRadius: 10,
            background: "#052e16",
            color: "#dcfce7",
          }}
        >
          {bulkResult}
        </div>
      ) : null}

      {success ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #14532d",
            borderRadius: 10,
            background: "#052e16",
            color: "#dcfce7",
          }}
        >
          {success}
        </div>
      ) : null}

      {error ? (
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
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          border: "1px solid #334155",
          borderRadius: 12,
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#94a3b8" }}>
              <th style={{ padding: "10px 12px" }}>Score</th>
              <th style={{ padding: "10px 12px" }}>Athlete</th>
              <th style={{ padding: "10px 12px" }}>Parent</th>
              <th style={{ padding: "10px 12px" }}>Team</th>
              <th style={{ padding: "10px 12px" }}>Coach</th>
              <th style={{ padding: "10px 12px" }}>Event</th>
              <th style={{ padding: "10px 12px" }}>Weight</th>
              <th style={{ padding: "10px 12px" }}>Age</th>
              <th style={{ padding: "10px 12px" }}>Athlete State</th>
              <th style={{ padding: "10px 12px" }}>Coach State</th>
              <th style={{ padding: "10px 12px" }}>Parent Emailed</th>
              <th style={{ padding: "10px 12px" }}>Coach Emailed</th>
              <th style={{ padding: "10px 12px" }}>Match Status</th>
              <th style={{ padding: "10px 12px" }}>Outreach</th>
            </tr>
          </thead>

          <tbody>
            {!loading && filteredRows.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ padding: 16, color: "#94a3b8" }}>
                  No potential matches found.
                </td>
              </tr>
            ) : null}

            {filteredRows.map((row) => {
              const athleteName = [row.first_name, row.last_name]
                .filter(Boolean)
                .join(" ");
              const key = `${row.wrestler_interest_id}-${row.coach_need_id}`;
              const alreadySent = row.emailed_parent && row.emailed_coach;
              const isSending = sendingKey === key;

              return (
                <tr key={key} style={{ borderTop: "1px solid #334155" }}>
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "#86efac",
                      fontWeight: 800,
                    }}
                  >
                    {row.match_score}
                  </td>

                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ color: "#fff", fontWeight: 700 }}>
                      {athleteName || "Unknown athlete"}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>
                      {safe(row.athlete_city)}
                      {row.athlete_city && row.athlete_state ? ", " : ""}
                      {safe(row.athlete_state)}
                    </div>
                  </td>

                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ color: "#fff" }}>
                      {safe(row.parent_name) || "—"}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>
                      {safe(row.parent_email) || "—"}
                    </div>
                  </td>

                  <td style={{ padding: "10px 12px", color: "#fff" }}>
                    {safe(row.team_name) || "—"}
                  </td>

                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ color: "#fff" }}>
                      {safe(row.coach_name) || "—"}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>
                      {safe(row.coach_email) || "—"}
                    </div>
                  </td>

                  <td style={{ padding: "10px 12px", color: "#fff" }}>
                    {safe(row.event_name) || "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>
                    {safe(row.weight_class) || "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>
                    {safe(row.age_group) || "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>
                    {safe(row.athlete_state) || "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>
                    {safe(row.coach_state) || "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>
                    {row.emailed_parent ? "Yes" : "No"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>
                    {row.emailed_coach ? "Yes" : "No"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>
                    {safe(row.match_status) || "Candidate"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      onClick={() => sendOutreach(row)}
                      disabled={alreadySent || isSending || bulkSending}
                      style={{
                        border: "1px solid #334155",
                        background: alreadySent ? "#0f172a" : "#16a34a",
                        color: "#fff",
                        padding: "8px 10px",
                        borderRadius: 10,
                        fontWeight: 800,
                        cursor:
                          alreadySent || isSending || bulkSending
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          alreadySent || isSending || bulkSending ? 0.7 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isSending
                        ? "Sending..."
                        : alreadySent
                        ? "Sent"
                        : "Send Outreach"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}