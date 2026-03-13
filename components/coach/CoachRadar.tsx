"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FollowAthleteButton from "@/components/athlete/FollowAthleteButton";

type RadarAthlete = {
  interest_id: number;
  wrestler_id: number;
  event_name: string | null;
  event_date: string | null;
  weight_class: string | null;
  age_group: string | null;
  notes: string | null;
  created_at: string | null;

  firstname: string | null;
  lastname: string | null;
  city: string | null;
  state: string | null;
  dob: string | null;
  athlete_user_id: number | null;

  coach_need_id: number | null;
  need_event_name: string | null;
  need_weight_class: string | null;
  need_age_group: string | null;

  already_following: boolean;
  is_new: boolean;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  athletes: RadarAthlete[];
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function athleteName(row: RadarAthlete) {
  const full = `${row.firstname ?? ""} ${row.lastname ?? ""}`.trim();
  return full || "Unknown athlete";
}

function locationText(city?: string | null, state?: string | null) {
  return [city, state].filter(Boolean).join(", ") || "—";
}

export default function CoachRadar() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RadarAthlete[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/coach/radar", {
        cache: "no-store",
      });

      const data: ApiResponse = await res.json();

      if (!data?.ok) {
        setMessage(data?.message ?? "Failed to load coach radar");
        setRows([]);
        return;
      }

      setRows(Array.isArray(data.athletes) ? data.athletes : []);
    } catch (error) {
      console.error("Failed to load coach radar:", error);
      setMessage("Failed to load coach radar");
      setRows([]);
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
            Athlete Availability Radar
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Athletes matching your current open team needs.
          </p>
        </div>

        <div className="rounded-full bg-red-600/15 px-3 py-1 text-xs font-medium text-red-300">
          {rows.length} match{rows.length === 1 ? "" : "es"}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-300">
          Loading radar...
        </div>
      ) : message ? (
        <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-red-200">
          {message}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-400">
          No matching athletes found for your open needs yet.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <div
              key={`${row.interest_id}-${row.wrestler_id}`}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {athleteName(row)}
                  </h3>
                  <div className="mt-1 text-sm text-slate-400">
                    {locationText(row.city, row.state)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {row.is_new ? (
                    <span className="rounded-full bg-red-600/20 px-3 py-1 text-xs font-medium text-red-300">
                      NEW
                    </span>
                  ) : null}

                  <span className="rounded-full bg-emerald-600/20 px-3 py-1 text-xs font-medium text-emerald-300">
                    Match
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">Event:</span>{" "}
                  {row.event_name || "—"}
                </div>
                <div>
                  <span className="text-slate-500">Date:</span>{" "}
                  {formatDate(row.event_date)}
                </div>
                <div>
                  <span className="text-slate-500">Age Group:</span>{" "}
                  {row.age_group || "—"}
                </div>
                <div>
                  <span className="text-slate-500">Weight:</span>{" "}
                  {row.weight_class || "—"}
                </div>
              </div>

              {row.notes ? (
                <div className="mt-4 text-sm text-slate-400">{row.notes}</div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={`/coach/athletes/${row.wrestler_id}` as const}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                >
                  View Profile
                </Link>

                <Link
                  href={`/coach/needs/${row.coach_need_id}/matches` as const}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  View Need Matches
                </Link>

                <FollowAthleteButton athleteId={row.wrestler_id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}