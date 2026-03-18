// components/coach/CoachMatchAlerts.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TeamLogo from "@/components/team/TeamLogo";

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

  team_name?: string | null;
  team_logo_path?: string | null;
  logoPath?: string | null;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  alerts: MatchAlert[];
};

async function fetchWithRetry(url: string, attempts = 2) {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || `Request failed: ${res.status}`);
      }

      return data;
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

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

function badgeClasses(status?: string | null) {
  const s = String(status ?? "").toLowerCase();

  if (s === "confirmed") {
    return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
  }

  if (s === "pending") {
    return "bg-amber-500/15 text-amber-300 border border-amber-500/30";
  }

  return "bg-slate-700/60 text-slate-200 border border-slate-600/60";
}

function statusLabel(status?: string | null) {
  const s = String(status ?? "").trim();
  if (!s) return "New";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function CoachMatchAlerts() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MatchAlert[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setLoading(true);
      setMessage("");

      const data = (await fetchWithRetry("/api/coach/match-alerts")) as ApiResponse;
      setRows(Array.isArray(data.alerts) ? data.alerts : []);
    } catch (error: any) {
      console.error("Failed to load match alerts:", error);
      setRows([]);
      setMessage(error?.message || "Failed to load match alerts");
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
          No new matches in the last 7 days.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const displayTeamName =
              row.team_name?.trim() || row.event_name?.trim() || "Team";
            const displayLogoPath = row.logoPath ?? row.team_logo_path ?? null;

            return (
              <div
                key={row.match_id}
                className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-3">
                  <TeamLogo
                    logoPath={displayLogoPath}
                    teamName={displayTeamName}
                    size={52}
                    rounded={false}
                  />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-white">
                        {athleteName(row)} matched your {row.event_name || "event"} need
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClasses(
                          row.status
                        )}`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </div>

                    <div className="mt-1 text-sm text-slate-400">
                      {row.weight_class || "—"} • {row.age_group || "—"} •{" "}
                      {locationText(row.city, row.state)}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {displayTeamName}
                      {timeAgo(row.created_at) ? ` • ${timeAgo(row.created_at)}` : ""}
                    </div>
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
            );
          })}
        </div>
      )}
    </section>
  );
}