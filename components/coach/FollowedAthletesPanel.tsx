"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type FollowedAthlete = {
  wrestler_id: number;
  followed_at: string | null;

  firstname: string | null;
  lastname: string | null;
  city: string | null;
  state: string | null;
  dob: string | null;

  latest_interest_id: number | null;
  latest_event_name: string | null;
  latest_event_date: string | null;
  latest_weight_class: string | null;
  latest_age_group: string | null;
  latest_notes: string | null;
  latest_interest_created_at: string | null;

  is_new_activity: boolean;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  athletes: FollowedAthlete[];
};

function athleteName(row: FollowedAthlete) {
  const full = `${row.firstname ?? ""} ${row.lastname ?? ""}`.trim();
  return full || "Unknown athlete";
}

function locationText(city?: string | null, state?: string | null) {
  return [city, state].filter(Boolean).join(", ") || "—";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function FollowedAthletesPanel() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FollowedAthlete[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/coach/following-athletes", {
        cache: "no-store",
      });

      const data: ApiResponse = await res.json();

      if (!data?.ok) {
        setMessage(data?.message ?? "Failed to load followed athletes");
        setRows([]);
        return;
      }

      setRows(Array.isArray(data.athletes) ? data.athletes : []);
    } catch (error) {
      console.error("Failed to load followed athletes:", error);
      setMessage("Failed to load followed athletes");
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
            Athletes You Follow
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Stay on top of updates from athletes you’re watching.
          </p>
        </div>

        <div className="rounded-full bg-blue-600/15 px-3 py-1 text-xs font-medium text-blue-300">
          {rows.length} athlete{rows.length === 1 ? "" : "s"}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-300">
          Loading followed athletes...
        </div>
      ) : message ? (
        <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-red-200">
          {message}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-400">
          You are not following any athletes yet.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.wrestler_id}
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
                  {row.is_new_activity ? (
                    <span className="rounded-full bg-red-600/20 px-3 py-1 text-xs font-medium text-red-300">
                      NEW
                    </span>
                  ) : null}

                  <span className="rounded-full bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-300">
                    Following
                  </span>
                </div>
              </div>

              <div className="mt-4 text-sm text-slate-300">
                <div>
                  <span className="text-slate-500">Latest event:</span>{" "}
                  {row.latest_event_name || "No interests posted yet"}
                </div>

                {row.latest_interest_id ? (
                  <>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="text-slate-500">Date:</span>{" "}
                        {formatDate(row.latest_event_date)}
                      </div>
                      <div>
                        <span className="text-slate-500">Age Group:</span>{" "}
                        {row.latest_age_group || "—"}
                      </div>
                      <div>
                        <span className="text-slate-500">Weight:</span>{" "}
                        {row.latest_weight_class || "—"}
                      </div>
                      <div>
                        <span className="text-slate-500">Updated:</span>{" "}
                        {formatDate(row.latest_interest_created_at)}
                      </div>
                    </div>

                    {row.latest_notes ? (
                      <div className="mt-3 text-sm text-slate-400">
                        {row.latest_notes}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={`/coach/athletes/${row.wrestler_id}` as const}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                >
                  View Profile
                </Link>

                {row.latest_interest_id ? (
                  <Link
                    href={`/parent/wrestlers/${row.wrestler_id}/interests/${row.latest_interest_id}/matches` as const}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    View Interest
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}