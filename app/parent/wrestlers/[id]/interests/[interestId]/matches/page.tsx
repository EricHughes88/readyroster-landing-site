// app/parent/wrestlers/[id]/interests/[interestId]/matches/page.tsx
"use client";

import Link from "next/link";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Interest = {
  id: number;
  wrestler_id: number;
  event_name: string | null;
  event_date: string | null;
  weight_class: string;
  age_group: string;
  notes: string | null;
};

type MatchRow = {
  id: number; // coach_need id
  event_name: string;
  event_date: string | null;
  weight_class: string;
  age_group: string;
  city: string | null;
  state: string | null;
  notes: string | null;
  coach_name: string | null;
  coach_email: string | null;
  team_name: string | null;

  // surfaced by the API from public.matches (if one already exists)
  match_id?: number | null;
  match_status?: "pending" | "confirmed" | "declined" | null;
  parent_ok?: boolean | null;
  coach_ok?: boolean | null;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function MatchesPage() {
  const { id: wrestlerId, interestId } = useParams<{
    id: string;
    interestId: string;
  }>();
  const router = useRouter();

  const [interest, setInterest] = useState<Interest | null>(null);
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyNeedId, setBusyNeedId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/interests/${interestId}/matches`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.message || "Failed to load matches.");
      } else {
        setInterest(data.interest ?? null);
        setRows(Array.isArray(data.matches) ? data.matches : []);
      }
    } catch {
      setError("Network error loading matches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interestId]);

  async function handleCreateMatch(needId: number) {
    try {
      setBusyNeedId(needId);
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interestId: Number(interestId),
          needId,
          // server sets parent_ok=true, coach_ok=false, status='pending'
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        alert(data?.message || "Could not create match.");
        return;
      }
      await load(); // refresh list to show "Pending"
    } finally {
      setBusyNeedId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between text-sm text-slate-300 mb-4">
          <button
            className="hover:text-white"
            onClick={() => router.push("/parent" as Route)}
          >
            ← Back to dashboard
          </button>
          <Link
            href={`/parent/wrestlers/${wrestlerId}/interests` as Route}
            className="hover:text-white"
          >
            Back to interests
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-semibold">Potential Matches</h1>
          <button
            className="rounded bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {interest && (
          <p className="mb-6 text-slate-300">
            Looking for{" "}
            <span className="font-semibold">{interest.weight_class}</span> –{" "}
            <span className="font-semibold">{interest.age_group}</span> at{" "}
            <span className="font-semibold">
              {interest.event_name || "Event"}
            </span>{" "}
            on <span className="font-semibold">{fmtDate(interest.event_date)}</span>
          </p>
        )}

        {error && (
          <div className="mb-6 rounded-md bg-red-900/40 border border-red-800 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-300">
              <tr>
                <th className="text-left px-3 py-2">Team</th>
                <th className="text-left px-3 py-2">Coach</th>
                <th className="text-left px-3 py-2">Event</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Weight</th>
                <th className="text-left px-3 py-2">Age Group</th>
                <th className="text-left px-3 py-2">Location</th>
                <th className="text-left px-3 py-2">Notes</th>
                <th className="text-left px-3 py-2">Contact</th>
                <th className="text-left px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    No matching coach needs found yet.
                  </td>
                </tr>
              )}

              {rows.map((m) => {
                const hasMatch = !!m.match_id;
                const isConfirmed = m.match_status === "confirmed";
                const isPending = m.match_status === "pending";

                return (
                  <tr
                    key={`${m.id}-${m.match_id ?? "new"}`}
                    className="border-t border-slate-800"
                  >
                    <td className="px-3 py-2">{m.team_name || "—"}</td>
                    <td className="px-3 py-2">{m.coach_name || "—"}</td>
                    <td className="px-3 py-2">{m.event_name}</td>
                    <td className="px-3 py-2">{fmtDate(m.event_date)}</td>
                    <td className="px-3 py-2">{m.weight_class}</td>
                    <td className="px-3 py-2">{m.age_group}</td>
                    <td className="px-3 py-2">
                      {[m.city, m.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{m.notes || "—"}</td>
                    <td className="px-3 py-2">
                      {m.coach_email ? (
                        <a
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500"
                          href={`mailto:${m.coach_email}?subject=${encodeURIComponent(
                            `Ready Roster: ${interest?.event_name ?? "Match"}`
                          )}`}
                        >
                          Email
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isConfirmed ? (
                        <Link
                          href={`/matches/${m.match_id}/chat` as Route}
                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500"
                        >
                          Message
                        </Link>
                      ) : hasMatch && isPending ? (
                        <span className="inline-block px-3 py-1 rounded bg-amber-600/70 text-white">
                          Pending
                        </span>
                      ) : (
                        <button
                          className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50"
                          disabled={busyNeedId === m.id}
                          onClick={() => handleCreateMatch(m.id)}
                        >
                          {busyNeedId === m.id ? "Creating…" : "Create Match"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
