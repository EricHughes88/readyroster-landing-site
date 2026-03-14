"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MapAthlete = {
  interest_id: number;
  event_name: string | null;
  event_date: string | null;
  weight_class: string | null;
  age_group: string | null;
  wrestler_id: number;
  firstname: string | null;
  lastname: string | null;
  city: string | null;
  state: string | null;
  dob: string | null;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  athletes: MapAthlete[];
};

function athleteName(row: MapAthlete) {
  const full = `${row.firstname ?? ""} ${row.lastname ?? ""}`.trim();
  return full || "Unknown athlete";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function RecruitingMap() {
  const [eventName, setEventName] = useState("");
  const [weightClass, setWeightClass] = useState("");
  const [ageGroup, setAgeGroup] = useState("");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MapAthlete[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setLoading(true);
      setMessage("");

      const qs = new URLSearchParams();
      if (eventName.trim()) qs.set("event", eventName.trim());
      if (weightClass.trim()) qs.set("weight", weightClass.trim());
      if (ageGroup.trim()) qs.set("age", ageGroup.trim());

      const res = await fetch(`/api/coach/map?${qs.toString()}`, {
        cache: "no-store",
      });

      const data: ApiResponse = await res.json();

      if (!data?.ok) {
        setRows([]);
        setMessage(data?.message ?? "Failed to load recruiting map");
        return;
      }

      setRows(Array.isArray(data.athletes) ? data.athletes : []);
    } catch (error) {
      console.error("Failed to load recruiting map:", error);
      setRows([]);
      setMessage("Failed to load recruiting map");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupedByState = useMemo(() => {
    const map = new Map<string, MapAthlete[]>();

    for (const row of rows) {
      const state = (row.state ?? "").trim() || "Unknown";
      if (!map.has(state)) {
        map.set(state, []);
      }
      map.get(state)!.push(row);
    }

    return Array.from(map.entries()).sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return a[0].localeCompare(b[0]);
    });
  }, [rows]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Ready Roster
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Recruiting Map
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Filter athletes by event, weight class, and age group, then view them by state.
          </p>
        </div>

        <div className="rounded-full bg-blue-600/15 px-3 py-1 text-xs font-medium text-blue-300">
          {rows.length} athlete{rows.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Event Name
          </label>
          <input
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="e.g. Test Nationals"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-slate-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Weight Class
          </label>
          <input
            value={weightClass}
            onChange={(e) => setWeightClass(e.target.value)}
            placeholder="e.g. 99"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-slate-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Age Group
          </label>
          <input
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            placeholder="e.g. 12U"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-slate-500"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Apply"}
          </button>

          <button
            onClick={() => {
              setEventName("");
              setWeightClass("");
              setAgeGroup("");
              setTimeout(() => load(), 0);
            }}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Clear
          </button>
        </div>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-red-200">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-300">
          Loading recruiting map...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-slate-400">
          No athletes found for the current filters.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByState.map(([state, athletes]) => (
            <div
              key={state}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">{state}</h3>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                  {athletes.length} athlete{athletes.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {athletes.map((row) => (
                  <div
                    key={`${row.interest_id}-${row.wrestler_id}`}
                    className="rounded-lg border border-slate-800 bg-slate-900/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold text-white">
                          {athleteName(row)}
                        </div>
                        <div className="mt-1 text-sm text-slate-400">
                          {[row.city, row.state].filter(Boolean).join(", ") || "—"}
                        </div>
                      </div>

                      <div className="rounded-full bg-emerald-600/20 px-3 py-1 text-xs font-medium text-emerald-300">
                        Match
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300">
                      Matches Need: {row.event_name || "—"} • {row.weight_class || "—"} •{" "}
                      {row.age_group || "—"}
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                      <div>
                        <span className="text-slate-500">Event:</span>{" "}
                        {row.event_name || "—"}
                      </div>
                      <div>
                        <span className="text-slate-500">Date:</span>{" "}
                        {formatDate(row.event_date)}
                      </div>
                      <div>
                        <span className="text-slate-500">Weight:</span>{" "}
                        {row.weight_class || "—"}
                      </div>
                      <div>
                        <span className="text-slate-500">Age Group:</span>{" "}
                        {row.age_group || "—"}
                      </div>
                    </div>

                    <div className="mt-4">
                      <Link
                        href={`/coach/athletes/${row.wrestler_id}` as const}
                        className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}