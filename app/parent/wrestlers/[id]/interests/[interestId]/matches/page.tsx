// app/parent/wrestlers/[id]/interests/[interestId]/matches/page.tsx
"use client";

import Link from "next/link";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type MatchRow = {
  // API may send coach need id as coach_need_id or id
  id?: number;
  coach_need_id?: number;
  coachNeedId?: number;

  wrestler_interest_id?: number;
  wrestler_id?: number;

  event_name: string;
  event_date: string | null;
  weight_class: string;
  age_group: string;
  city: string | null;
  state: string | null;
  notes: string | null;

  coach_name: string | null;
  contactemail?: string | null;
  coach_email?: string | null;
  team_name?: string | null;
  teamname?: string | null;

  match_id?: number | null;
  match_status?: "pending" | "confirmed" | "declined" | null;
  parent_ok?: boolean | null;
  coach_ok?: boolean | null;
};

type PotentialApiResponse = {
  ok: boolean;
  role?: string;
  potentialMatches?: MatchRow[];
  message?: string;
};

type NormalizedRow = MatchRow & { __needId: number };

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function normalizeNeedId(r: MatchRow): number {
  const maybe =
    (r as any)?.coach_need_id ??
    (r as any)?.coachNeedId ??
    (r as any)?.id ??
    0;

  const n = Number(maybe);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function dedupeAndNormalize(input: unknown): NormalizedRow[] {
  const list = Array.isArray(input) ? (input as MatchRow[]) : [];

  const rank = (r: MatchRow) => {
    const hasMatch = r.match_id ? 1 : 0;
    const statusScore =
      r.match_status === "confirmed"
        ? 3
        : r.match_status === "pending"
        ? 2
        : r.match_status === "declined"
        ? 1
        : 0;
    return hasMatch * 10 + statusScore;
  };

  const byNeed = new Map<number, NormalizedRow>();
  const order: number[] = [];

  for (const r of list) {
    if (!r) continue;

    const needId = normalizeNeedId(r);
    if (!needId) continue;

    const normalized: NormalizedRow = { ...r, __needId: needId };

    if (!byNeed.has(needId)) order.push(needId);

    const prev = byNeed.get(needId);
    if (!prev || rank(normalized) > rank(prev)) {
      byNeed.set(needId, normalized);
    }
  }

  const out: NormalizedRow[] = [];
  for (const needId of order) {
    const row = byNeed.get(needId);
    if (row) out.push(row);
  }
  return out;
}

export default function MatchesPage() {
  const { id: wrestlerId, interestId } = useParams<{
    id: string;
    interestId: string;
  }>();
  const router = useRouter();

  const [rows, setRows] = useState<NormalizedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyNeedId, setBusyNeedId] = useState<number | null>(null);

  const numericInterestId = Number(interestId || 0);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/matches/potential", {
        cache: "no-store",
      });

      const data = (await res
        .json()
        .catch(() => ({ ok: false, message: "Invalid JSON response." }))) as PotentialApiResponse;

      if (!res.ok || !data?.ok) {
        setError(data?.message || "Failed to load potential matches.");
        setRows([]);
        return;
      }

      const allPotential = Array.isArray(data.potentialMatches)
        ? data.potentialMatches
        : [];

      // Only show rows for this specific saved interest
      const filtered = allPotential.filter((row) => {
        const rowInterestId = Number((row as any)?.wrestler_interest_id ?? 0);
        return rowInterestId === numericInterestId;
      });

      setRows(dedupeAndNormalize(filtered));
    } catch {
      setError("Network error loading potential matches.");
      setRows([]);
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
        }),
      });

      const data = await res
        .json()
        .catch(() => ({ ok: false, message: "Invalid JSON response." }));

      if (!res.ok || !data?.ok) {
        alert(data?.message || "Could not create match.");
        return;
      }

      await load();
    } finally {
      setBusyNeedId(null);
    }
  }

  const headerRow = useMemo(() => rows[0] ?? null, [rows]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between text-sm text-slate-300">
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

        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Potential Matches</h1>
          <button
            className="rounded bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700 disabled:opacity-60"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {headerRow && (
          <p className="mb-6 text-slate-300">
            Looking for{" "}
            <span className="font-semibold">{headerRow.weight_class}</span> –{" "}
            <span className="font-semibold">{headerRow.age_group}</span> at{" "}
            <span className="font-semibold">{headerRow.event_name || "Event"}</span>{" "}
            on <span className="font-semibold">{fmtDate(headerRow.event_date)}</span>
          </p>
        )}

        {error && (
          <div className="mb-6 rounded-md border border-red-800 bg-red-900/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-3 py-2 text-left">Coach</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Weight</th>
                <th className="px-3 py-2 text-left">Age Group</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Notes</th>
                <th className="px-3 py-2 text-left">Contact</th>
                <th className="px-3 py-2 text-left">Action</th>
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
                const needId = m.__needId;

                const hasMatch = !!m.match_id;
                const isConfirmed = m.match_status === "confirmed";
                const isPending = m.match_status === "pending";

                const teamName = m.team_name || m.teamname || "—";
                const coachName = m.coach_name || "—";
                const coachEmail = m.coach_email || m.contactemail || null;

                return (
                  <tr
                    key={`need-${needId}`}
                    className="border-t border-slate-800"
                  >
                    <td className="px-3 py-2">{teamName}</td>
                    <td className="px-3 py-2">{coachName}</td>
                    <td className="px-3 py-2">{m.event_name}</td>
                    <td className="px-3 py-2">{fmtDate(m.event_date)}</td>
                    <td className="px-3 py-2">{m.weight_class}</td>
                    <td className="px-3 py-2">{m.age_group}</td>
                    <td className="px-3 py-2">
                      {[m.city, m.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{m.notes || "—"}</td>

                    <td className="px-3 py-2">
                      {coachEmail ? (
                        <a
                          className="rounded bg-emerald-600 px-2 py-1 hover:bg-emerald-500"
                          href={`mailto:${coachEmail}?subject=${encodeURIComponent(
                            `Ready Roster: ${m.event_name ?? "Match"}`
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
                          className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500"
                        >
                          Message
                        </Link>
                      ) : hasMatch && isPending ? (
                        <span className="inline-block rounded bg-amber-600/70 px-3 py-1 text-white">
                          Pending
                        </span>
                      ) : (
                        <button
                          className="rounded bg-red-600 px-3 py-1 hover:bg-red-500 disabled:opacity-50"
                          disabled={busyNeedId === needId}
                          onClick={() => handleCreateMatch(needId)}
                        >
                          {busyNeedId === needId ? "Creating…" : "Create Match"}
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