// app/parent/wrestlers/[id]/matches/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type MatchStatus = "pending" | "confirmed" | "all";

type MatchRow = {
  id: string | number;
  event_name: string | null;
  event_date: string | null;
  status: "pending" | "confirmed";
  notes: string | null;

  team_name: string | null;
  team_coach_name: string | null;
  team_logo_path: string | null;

  weight_class: string | null;
  age_group: string | null;

  parent_ok: boolean | null;
  coach_ok: boolean | null;
};

type ApiResponse = {
  ok: boolean;
  matches: MatchRow[];
  page: { page: number; limit: number; total: number };
  message?: string;
};

type SortKey = "team" | "coach" | "event" | "weight" | "age" | "status";

export default function ParentWrestlerMatchesPage() {
  const params = useParams<{ id: string }>();
  const wrestlerId = Number(params.id);
  const sp = useSearchParams();
  const router = useRouter();

  const status: MatchStatus =
    (sp.get("status") as MatchStatus | null) || "pending";

  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  // sorting
  const [sortKey, setSortKey] = useState<SortKey>("event");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ---- Load matches for this wrestler & status ----
  useEffect(() => {
    if (!wrestlerId) {
      setRows([]);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const qs = new URLSearchParams();
        qs.set("wrestlerId", String(wrestlerId));
        qs.set("status", status);

        const res = await fetch(`/api/matches?${qs.toString()}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ApiResponse;
        console.log("Parent wrestler matches JSON:", json);

        if (!res.ok || !json.ok) {
          throw new Error(json?.message || "Failed to load matches");
        }

        setRows(Array.isArray(json.matches) ? json.matches : []);
      } catch (e: any) {
        console.error("Error loading matches for wrestler", e);
        setErr(e?.message || "Failed to load matches");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [wrestlerId, status]);

  function changeStatus(nextStatus: MatchStatus) {
    const next = new URLSearchParams(sp.toString());
    next.set("status", nextStatus);
    router.replace(`?${next.toString()}`);
  }

  // ---- Parent confirms a match ----
  async function handleConfirm(matchId: number) {
    setErr(null);
    setConfirmingId(matchId);
    try {
      const res = await fetch(`/api/matches/${matchId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: "parent" }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json?.message || "Failed to confirm match");
      }

      // Optimistically update local state
      setRows((prev) =>
        prev.map((m) => {
          if (Number(m.id) !== matchId) return m;
          const parentOk = true;
          const coachOk = m.coach_ok ?? false;
          const confirmed = parentOk && coachOk;
          return {
            ...m,
            parent_ok: true,
            status: confirmed ? "confirmed" : m.status,
          };
        })
      );
    } catch (e: any) {
      console.error("Error confirming match", e);
      setErr(e?.message || "Failed to confirm match");
    } finally {
      setConfirmingId(null);
    }
  }

  // --------- Sorting helpers ----------
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;

      const getVal = (m: MatchRow) => {
        switch (sortKey) {
          case "team":
            return (m.team_name ?? "").toLowerCase();
          case "coach":
            return (m.team_coach_name ?? "").toLowerCase();
          case "event":
            return (m.event_name ?? "").toLowerCase();
          case "weight":
            return Number(m.weight_class ?? 0);
          case "age":
            return (m.age_group ?? "").toLowerCase();
          case "status": {
            const base = m.status === "confirmed" ? 2 : 1;
            if (m.status === "pending") {
              if (m.coach_ok && !m.parent_ok) return base + 0.1;
              if (m.parent_ok && !m.coach_ok) return base + 0.2;
            }
            return base;
          }
        }
      };

      const va = getVal(a);
      const vb = getVal(b);

      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function getStatusInfo(m: MatchRow): { label: string; classes: string } {
    if (m.status === "confirmed") {
      return {
        label: "Confirmed",
        classes:
          "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40",
      };
    }
    if (m.coach_ok && !m.parent_ok) {
      return {
        label: "Waiting on Parent",
        classes: "bg-amber-500/15 text-amber-300 border border-amber-500/40",
      };
    }
    if (m.parent_ok && !m.coach_ok) {
      return {
        label: "Waiting on Coach",
        classes: "bg-amber-500/15 text-amber-300 border border-amber-500/40",
      };
    }
    return {
      label: "Pending",
      classes: "bg-slate-700/60 text-slate-200 border border-slate-500/60",
    };
  }

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? "▲" : "▼";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Matches (PARENT PAGE)</h1>

        <div className="flex gap-2">
          <button
            onClick={() => changeStatus("pending")}
            className={`px-4 py-2 rounded ${
              status === "pending"
                ? "bg-slate-700 border border-slate-400"
                : "bg-slate-800 border border-slate-600"
            }`}
          >
            Pending
          </button>

          <button
            onClick={() => changeStatus("confirmed")}
            className={`px-4 py-2 rounded ${
              status === "confirmed"
                ? "bg-slate-700 border border-slate-400"
                : "bg-slate-800 border border-slate-600"
            }`}
          >
            Confirmed
          </button>

          <button
            onClick={() => changeStatus("all")}
            className={`px-4 py-2 rounded ${
              status === "all"
                ? "bg-slate-700 border border-slate-400"
                : "bg-slate-800 border border-slate-600"
            }`}
          >
            All
          </button>

          <Link
            href={`/parent/wrestlers/${wrestlerId}` as any}
            className="px-4 py-2 bg-slate-700 rounded border border-slate-500"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded border border-red-600 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      <div className="mb-4 text-xs text-slate-400 flex flex-wrap gap-4">
        <span>
          <span className="inline-block w-3 h-3 rounded-full bg-slate-500 mr-1" />
          Pending
        </span>
        <span>
          <span className="inline-block w-3 h-3 rounded-full bg-amber-400 mr-1" />
          Waiting on Parent / Coach
        </span>
        <span>
          <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 mr-1" />
          Confirmed
        </span>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-800 rounded overflow-hidden">
            <thead className="bg-slate-900 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Logo</th>
                <th
                  className="px-3 py-2 text-left cursor-pointer select-none"
                  onClick={() => toggleSort("team")}
                >
                  Team {sortArrow("team")}
                </th>
                <th
                  className="px-3 py-2 text-left cursor-pointer select-none"
                  onClick={() => toggleSort("coach")}
                >
                  Coach {sortArrow("coach")}
                </th>
                <th
                  className="px-3 py-2 text-left cursor-pointer select-none"
                  onClick={() => toggleSort("event")}
                >
                  Event {sortArrow("event")}
                </th>
                <th
                  className="px-3 py-2 text-left cursor-pointer select-none"
                  onClick={() => toggleSort("weight")}
                >
                  Weight {sortArrow("weight")}
                </th>
                <th
                  className="px-3 py-2 text-left cursor-pointer select-none"
                  onClick={() => toggleSort("age")}
                >
                  Age Group {sortArrow("age")}
                </th>
                <th
                  className="px-3 py-2 text-left cursor-pointer select-none"
                  onClick={() => toggleSort("status")}
                >
                  Status {sortArrow("status")}
                </th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {(sortedRows ?? []).map((m) => {
                const idNum = Number(m.id);

                const canConfirm =
                  m.status === "pending" && !!m.coach_ok && !m.parent_ok;

                const statusInfo = getStatusInfo(m);

                return (
                  <tr key={m.id} className="border-t border-slate-800">
                    <td className="px-3 py-2">
                      {m.team_logo_path ? (
                        <img
                          src={m.team_logo_path}
                          alt={m.team_name ?? "Team logo"}
                          className="w-8 h-8 rounded-full object-cover border border-slate-600"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300 border border-slate-600">
                          {m.team_name
                            ? m.team_name
                                .split(" ")
                                .map((w) => w[0])
                                .join("")
                                .slice(0, 2)
                            : "RR"}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2">{m.team_name ?? "—"}</td>
                    <td className="px-3 py-2">{m.team_coach_name ?? "—"}</td>
                    <td className="px-3 py-2">{m.event_name ?? "—"}</td>
                    <td className="px-3 py-2">{m.weight_class ?? "—"}</td>
                    <td className="px-3 py-2">{m.age_group ?? "—"}</td>

                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.classes}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        {canConfirm && (
                          <button
                            onClick={() => handleConfirm(idNum)}
                            disabled={confirmingId === idNum}
                            className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-60"
                          >
                            {confirmingId === idNum ? "Confirming…" : "Confirm"}
                          </button>
                        )}

                        <Link
                          href={`/messages/${m.id}` as any}
                          className="px-2 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-600 text-xs"
                        >
                          Message
                        </Link>

                        {/* ✅ View button now points to /matches/[id] */}
                        <Link
                          href={`/matches/${m.id}` as any}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedRows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    No matches found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
