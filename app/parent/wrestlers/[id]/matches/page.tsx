// app/parent/wrestlers/[id]/matches/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TeamLogo from "@/components/team/TeamLogo";

type MatchStatus = "pending" | "confirmed" | "all";

type MatchRow = {
  id: number;
  eventName: string | null;
  eventDate: string | null;
  status: "pending" | "confirmed";
  notes: string | null;

  teamName: string | null;
  teamCoachName: string | null;
  teamLogoPath: string | null;

  weightClass: string | null;
  ageGroup: string | null;

  parentOk: boolean | null;
  coachOk: boolean | null;
};

type ApiResponse = {
  ok: boolean;
  matches: any[];
  page?: { page: number; limit: number; total: number };
  message?: string;
};

type SortKey = "team" | "coach" | "event" | "weight" | "age" | "status";

function formatEventDate(value?: string | null) {
  if (!value) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ParentWrestlerMatchesPage() {
  const params = useParams<{ id: string }>();
  const rawWrestlerId = params?.id;
  const wrestlerId =
    rawWrestlerId && !Number.isNaN(Number(rawWrestlerId))
      ? Number(rawWrestlerId)
      : null;

  const sp = useSearchParams();
  const router = useRouter();

  const status: MatchStatus =
    (sp.get("status") as MatchStatus | null) || "pending";

  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("event");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const qs = new URLSearchParams();
        qs.set("status", status);

        const res = await fetch(`/api/matches?${qs.toString()}`, {
          cache: "no-store",
        });

        const json = (await res.json()) as ApiResponse;

        if (!res.ok || !json.ok) {
          throw new Error(json?.message || "Failed to load matches");
        }

        const normalized: MatchRow[] = (json.matches ?? []).map((m: any) => ({
          id: Number(m.id),
          eventName: m.event_name ?? null,
          eventDate: m.event_date ?? null,
          status: m.status === "confirmed" ? "confirmed" : "pending",
          notes: m.notes ?? null,
          teamName: m.team_name ?? null,
          teamCoachName: m.team_coach_name ?? null,
          teamLogoPath: m.team_logo_path ?? null,
          weightClass: m.weight_class ?? null,
          ageGroup: m.age_group ?? null,
          parentOk: m.parent_ok ?? null,
          coachOk: m.coach_ok ?? null,
        }));

        setRows(normalized);
      } catch (e: any) {
        setErr(e?.message || "Failed to load matches");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  function changeStatus(nextStatus: MatchStatus) {
    const next = new URLSearchParams(sp.toString());
    next.set("status", nextStatus);
    router.replace(`?${next.toString()}`);
  }

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

      setRows((prev) =>
        prev.map((m) => {
          if (m.id !== matchId) return m;

          const nextParentOk = true;
          const nextCoachOk = m.coachOk ?? false;
          const confirmed = nextParentOk && nextCoachOk;

          return {
            ...m,
            parentOk: true,
            status: confirmed ? "confirmed" : m.status,
          };
        })
      );
    } catch (e: any) {
      setErr(e?.message || "Failed to confirm match");
    } finally {
      setConfirmingId(null);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? "▲" : "▼";
  }

  const sortedRows = useMemo(() => {
    const copy = [...rows];

    copy.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;

      const getVal = (m: MatchRow) => {
        switch (sortKey) {
          case "team":
            return (m.teamName ?? "").toLowerCase();
          case "coach":
            return (m.teamCoachName ?? "").toLowerCase();
          case "event":
            return (m.eventName ?? "").toLowerCase();
          case "weight":
            return Number(m.weightClass ?? 0);
          case "age":
            return (m.ageGroup ?? "").toLowerCase();
          case "status": {
            const base = m.status === "confirmed" ? 2 : 1;
            if (m.status === "pending") {
              if (m.coachOk && !m.parentOk) return base + 0.1;
              if (m.parentOk && !m.coachOk) return base + 0.2;
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

    if (m.coachOk && !m.parentOk) {
      return {
        label: "Waiting on Parent",
        classes:
          "bg-amber-500/15 text-amber-300 border border-amber-500/40",
      };
    }

    if (m.parentOk && !m.coachOk) {
      return {
        label: "Waiting on Coach",
        classes:
          "bg-amber-500/15 text-amber-300 border border-amber-500/40",
      };
    }

    return {
      label: "Pending",
      classes: "bg-slate-700/60 text-slate-200 border border-slate-500/60",
    };
  }

  const backHref =
    wrestlerId && wrestlerId > 0
      ? (`/parent/wrestlers/${wrestlerId}` as any)
      : ("/parent" as any);

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-bold">Matches</h1>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => changeStatus("pending")}
            className={`rounded border px-4 py-2 ${
              status === "pending"
                ? "border-slate-400 bg-slate-700"
                : "border-slate-600 bg-slate-800"
            }`}
          >
            Pending
          </button>

          <button
            onClick={() => changeStatus("confirmed")}
            className={`rounded border px-4 py-2 ${
              status === "confirmed"
                ? "border-slate-400 bg-slate-700"
                : "border-slate-600 bg-slate-800"
            }`}
          >
            Confirmed
          </button>

          <button
            onClick={() => changeStatus("all")}
            className={`rounded border px-4 py-2 ${
              status === "all"
                ? "border-slate-400 bg-slate-700"
                : "border-slate-600 bg-slate-800"
            }`}
          >
            All
          </button>

          <Link
            href={backHref}
            className="rounded border border-slate-500 bg-slate-700 px-4 py-2"
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

      <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-400">
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded-full bg-slate-500" />
          Pending
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded-full bg-amber-400" />
          Waiting on Parent / Coach
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded-full bg-emerald-500" />
          Confirmed
        </span>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Logo</th>
                <th
                  className="cursor-pointer select-none px-3 py-2 text-left"
                  onClick={() => toggleSort("team")}
                >
                  Team {sortArrow("team")}
                </th>
                <th
                  className="cursor-pointer select-none px-3 py-2 text-left"
                  onClick={() => toggleSort("coach")}
                >
                  Coach {sortArrow("coach")}
                </th>
                <th
                  className="cursor-pointer select-none px-3 py-2 text-left"
                  onClick={() => toggleSort("event")}
                >
                  Event {sortArrow("event")}
                </th>
                <th className="px-3 py-2 text-left">Event Date</th>
                <th
                  className="cursor-pointer select-none px-3 py-2 text-left"
                  onClick={() => toggleSort("weight")}
                >
                  Weight {sortArrow("weight")}
                </th>
                <th
                  className="cursor-pointer select-none px-3 py-2 text-left"
                  onClick={() => toggleSort("age")}
                >
                  Age Group {sortArrow("age")}
                </th>
                <th
                  className="cursor-pointer select-none px-3 py-2 text-left"
                  onClick={() => toggleSort("status")}
                >
                  Status {sortArrow("status")}
                </th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((m) => {
                const canConfirm =
                  m.status === "pending" && !!m.coachOk && !m.parentOk;

                const statusInfo = getStatusInfo(m);
                const formattedDate = formatEventDate(m.eventDate);

                return (
                  <tr key={m.id} className="border-t border-slate-800">
                    <td className="px-3 py-2">
                      <TeamLogo
                        logoPath={m.teamLogoPath}
                        teamName={m.teamName}
                        size={36}
                      />
                    </td>

                    <td className="px-3 py-2">{m.teamName ?? "—"}</td>
                    <td className="px-3 py-2">{m.teamCoachName ?? "—"}</td>
                    <td className="px-3 py-2">{m.eventName ?? "—"}</td>
                    <td className="px-3 py-2">{formattedDate ?? "—"}</td>
                    <td className="px-3 py-2">{m.weightClass ?? "—"}</td>
                    <td className="px-3 py-2">{m.ageGroup ?? "—"}</td>

                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.classes}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {canConfirm && (
                          <button
                            onClick={() => handleConfirm(m.id)}
                            disabled={confirmingId === m.id}
                            className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                          >
                            {confirmingId === m.id ? "Confirming…" : "Confirm"}
                          </button>
                        )}

                        <Link
                          href={`/messages/${m.id}` as any}
                          className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                        >
                          Message
                        </Link>

                        <Link
                          href={`/matches/${m.id}` as any}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs text-slate-950 hover:bg-emerald-500"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
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