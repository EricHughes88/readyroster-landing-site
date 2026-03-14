"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MatchAlert = {
  match_id: number;
  created_at: string | null;
  status: string | null;

  coach_need_id: number;
  event_name: string | null;
  weight_class: string | null;
  age_group: string | null;

  wrestler_id: number;
  firstname: string | null;
  lastname: string | null;
  city: string | null;
  state: string | null;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  alerts: MatchAlert[];
};

function athleteName(row: MatchAlert) {
  const full = `${row.firstname ?? ""} ${row.lastname ?? ""}`.trim();
  return full || "Unknown athlete";
}

function timeAgo(value?: string | null) {
  if (!value) return "";
  const now = Date.now();
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";

  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";

  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function locationText(city?: string | null, state?: string | null) {
  return [city, state].filter(Boolean).join(", ") || "—";
}

export default function CoachMatchAlerts() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MatchAlert[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/coach/match-alerts", {
        cache: "no-store",
      });

      const data: ApiResponse = await res.json();

      if (!data?.ok) {
        setRows([]);
        setMessage(data?.message ?? "Failed to load match alerts");
        return;
      }

      setRows(Array.isArray(data.alerts) ? data.alerts : []);
    } catch (error) {
      console.error("Failed to load match alerts:", error);
      setRows([]);
      setMessage("Failed to load match alerts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Ready Roster
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            New Match Alerts
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Recent athlete matches for your team needs.
          </p>
        </div>

        <div className="rounded-full bg-red-600/15 px-3 py-1 text-xs font-medium text-red-300">
          {rows.length} alert{rows.length === 1 ? "" : "s"}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-300">
          Loading match alerts...
        </div>
      ) : message ? (
        <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-red-200">
          {message}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-400">
          No recent match alerts yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.match_id}
              className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-white">
                  {athleteName(row)} matched your {row.event_name || "event"} need
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {row.weight_class || "—"} • {row.age_group || "—"} • {locationText(row.city, row.state)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {timeAgo(row.created_at)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/coach/athletes/${row.wrestler_id}` as const}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  View Athlete
                </Link>

                <Link
                  href={`/coach/needs/${row.coach_need_id}/matches` as const}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Open Matches
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}