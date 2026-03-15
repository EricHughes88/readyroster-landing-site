// components/admin/RecruitingAlertsRunner.tsx
"use client";

import { useState } from "react";

type RecruitingAlertsResult = {
  ok: boolean;
  totalNeedsScanned: number;
  totalCandidatesMatched: number;
  totalEmailsSent: number;
  totalSkippedAlreadySent: number;
  totalSkippedMissingEmail: number;
};

export default function RecruitingAlertsRunner() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecruitingAlertsResult | null>(null);
  const [error, setError] = useState("");

  async function runAlerts() {
    try {
      setLoading(true);
      setError("");
      setResult(null);

      const res = await fetch("/api/recruiting-alerts/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to run recruiting alerts");
      }

      setResult(data);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 14,
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 12,
        background: "rgba(2,6,23,0.35)",
      }}
    >
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
          <div style={{ color: "#fff", fontWeight: 800 }}>
            Recruiting Alerts
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
            Run event-date-aware recruiting alerts for matching athletes.
          </div>
        </div>

        <button
          onClick={runAlerts}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #991b1b",
            background: loading ? "#7f1d1d" : "#b91c1c",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: 10,
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
            minHeight: 36,
            opacity: loading ? 0.8 : 1,
          }}
        >
          {loading ? "Running..." : "Run Recruiting Alerts"}
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #7f1d1d",
            borderRadius: 10,
            background: "rgba(127,29,29,0.18)",
            color: "#fecaca",
          }}
        >
          <b>Error:</b> {error}
        </div>
      ) : null}

      {result ? (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          {[
            ["Needs scanned", result.totalNeedsScanned],
            ["Candidates matched", result.totalCandidatesMatched],
            ["Emails sent", result.totalEmailsSent],
            ["Skipped already sent", result.totalSkippedAlreadySent],
            ["Skipped missing email", result.totalSkippedMissingEmail],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              style={{
                border: "1px solid #334155",
                borderRadius: 10,
                padding: 12,
                background: "rgba(15,23,42,0.45)",
              }}
            >
              <div style={{ color: "#94a3b8", fontSize: 12 }}>{label}</div>
              <div
                style={{
                  color: "#fff",
                  fontSize: 22,
                  fontWeight: 900,
                  marginTop: 6,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}