// app/coach/needs/[needId]/matches/page.tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type MatchStatus = "pending" | "confirmed" | "declined" | "cancelled" | "all";

type Need = {
  id: number;
  event_name: string;
  event_date: string | null;
  weight_class: string;
  age_group: string;
  city: string | null;
  state: string | null;
};

type Candidate = {
  id: number; // wrestler_interest id
  wrestler_id: number | null;
  first_name: string | null;
  last_name: string | null;
  event_name: string | null;
  event_date: string | null;
  weight_class: string;
  age_group: string;
  notes: string | null;
  match_id?: number | null;
  match_status?: "pending" | "confirmed" | "declined" | "cancelled" | null;
  parent_ok?: boolean | null;
  coach_ok?: boolean | null;
};

type ApiResponse = {
  ok: boolean;
  need: Need;
  candidates: Candidate[];
  message?: string;
};

function fmtDate(raw: string | null) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getWrestlerName(c: Candidate): string {
  const first = c.first_name ?? "";
  const last = c.last_name ?? "";
  const full = `${first} ${last}`.trim();
  return full || "Unknown wrestler";
}

function normalizeStatus(c: Candidate): MatchStatus {
  const s = c.match_status ?? "pending";
  if (s === "confirmed") return "confirmed";
  if (s === "pending") return "pending";
  if (s === "declined") return "declined";
  if (s === "cancelled") return "cancelled";
  return "pending";
}

type SortKey = "wrestler" | "event" | "date" | "status";

export default function NeedMatchesPage() {
  const params = useParams<{ needId: string }>();
  const needId = Number(params.needId);

  const [need, setNeed] = useState<Need | null>(null);
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // UI controls
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MatchStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("wrestler");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Load need + candidates
  useEffect(() => {
    if (!needId) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/coach/needs/${needId}/matches`, {
          cache: "no-store",
        });
        const data = (await res.json()) as ApiResponse;
        if (!res.ok || !data.ok) {
          throw new Error(data?.message || "Failed to load matches");
        }
        setNeed(data.need);
        setRows(data.candidates ?? []);
      } catch (e: any) {
        console.error("NeedMatchesPage load error", e);
        setErr(e?.message || "Failed to load matches for this need");
      } finally {
        setLoading(false);
      }
    })();
  }, [needId]);

  // Filter + search + sort
  const filteredSorted = useMemo(() => {
    let items = [...rows];

    // Status filter
    if (statusFilter !== "all") {
      items = items.filter((c) => normalizeStatus(c) === statusFilter);
    }

    // Search (wrestler name, event name, notes)
    const term = search.trim().toLowerCase();
    if (term) {
      items = items.filter((c) => {
        const name = getWrestlerName(c).toLowerCase();
        const event = (c.event_name ?? "").toLowerCase();
        const notes = (c.notes ?? "").toLowerCase();
        return (
          name.includes(term) ||
          event.includes(term) ||
          notes.includes(term)
        );
      });
    }

    // Sort
    items.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;

      if (sortKey === "wrestler") {
        return getWrestlerName(a).localeCompare(getWrestlerName(b)) * dir;
      }

      if (sortKey === "event") {
        const ea = (a.event_name ?? "").toLowerCase();
        const eb = (b.event_name ?? "").toLowerCase();
        return ea.localeCompare(eb) * dir;
      }

      if (sortKey === "date") {
        const da = a.event_date ? new Date(a.event_date).getTime() : 0;
        const db = b.event_date ? new Date(b.event_date).getTime() : 0;
        return (da - db) * dir;
      }

      if (sortKey === "status") {
        const sa = normalizeStatus(a);
        const sb = normalizeStatus(b);
        return sa.localeCompare(sb) * dir;
      }

      return 0;
    });

    return items;
  }, [rows, search, statusFilter, sortKey, sortDir]);

  // Pagination
  const total = filteredSorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const pageRows = filteredSorted.slice(startIndex, endIndex);

  // Reset page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleExportConfirmed = () => {
    const confirmed = filteredSorted.filter(
      (c) => normalizeStatus(c) === "confirmed"
    );
    if (!confirmed.length) {
      alert("No confirmed matches to export for this need.");
      return;
    }

    const header = [
      "Wrestler",
      "Event",
      "Date",
      "Weight",
      "Age Group",
      "Status",
      "Notes",
    ];

    const lines = confirmed.map((c) => {
      const fields = [
        getWrestlerName(c),
        c.event_name ?? "",
        fmtDate(c.event_date),
        c.weight_class ?? "",
        c.age_group ?? "",
        normalizeStatus(c),
        (c.notes ?? "").replace(/\r?\n/g, " "),
      ];

      return fields
        .map((f) => `"${String(f).replace(/"/g, '""')}"`)
        .join(",");
    });

    const csv = [header.join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const titleParts = [
      need?.event_name || "need",
      need?.age_group || "",
      need?.weight_class || "",
    ]
      .join("_")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .toLowerCase();

    a.download = `readyroster_confirmed_${titleParts || "matches"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const headingLine = need
    ? `${need.event_name} • ${fmtDate(need.event_date)} • ${need.age_group} • ${need.weight_class}`
    : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Top heading + nav */}
        <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">
              Matches for Need
            </h1>
            {headingLine && (
              <p className="text-sm text-slate-300">{headingLine}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportConfirmed}
              className="px-3 py-1.5 text-xs rounded border border-slate-700 bg-slate-900 hover:bg-slate-800"
            >
              Export Confirmed CSV
            </button>

            <Link
              href="/coach/needs"
              className="px-3 py-1.5 text-xs rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
            >
              Back to needs
            </Link>

            <Link
              href="/coach"
              className="px-3 py-1.5 text-xs rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        {/* Filters / search */}
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-300">Status</span>
            <div className="flex rounded border border-slate-700 bg-slate-900 overflow-hidden">
              {(["all", "pending", "confirmed"] as MatchStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 text-xs border-r border-slate-700 last:border-r-0 ${
                    statusFilter === s
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-200"
                  }`}
                >
                  {s === "all"
                    ? "All"
                    : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-slate-300">Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Wrestler, event, or notes…"
              className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-300">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="text-slate-400 ml-auto">
            Showing {total === 0 ? 0 : startIndex + 1}–{endIndex} of {total}
          </div>
        </div>

        {/* Error / loading / table */}
        {err && (
          <div className="mb-4 rounded border border-red-600 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-slate-400">
            Loading matches…
          </div>
        ) : total === 0 ? (
          <div className="py-12 text-center text-slate-400">
            No wrestler matches yet for this need.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-900/80 text-slate-200">
                <tr>
                  <th
                    className="px-3 py-2 text-left cursor-pointer select-none"
                    onClick={() => toggleSort("wrestler")}
                  >
                    Wrestler{" "}
                    {sortKey === "wrestler" &&
                      (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer select-none"
                    onClick={() => toggleSort("event")}
                  >
                    Event{" "}
                    {sortKey === "event" &&
                      (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer select-none"
                    onClick={() => toggleSort("date")}
                  >
                    Date{" "}
                    {sortKey === "date" &&
                      (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-3 py-2 text-left">Weight</th>
                  <th className="px-3 py-2 text-left">Age Group</th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer select-none"
                    onClick={() => toggleSort("status")}
                  >
                    Status{" "}
                    {sortKey === "status" &&
                      (sortDir === "asc" ? "▲" : "▼")}
                  </th>
                  <th className="px-3 py-2 text-left">Notes</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((c) => {
                  const matchId = c.match_id ?? null;
                  const status = normalizeStatus(c);
                  return (
                    <tr key={c.id} className="border-t border-slate-800">
                      <td className="px-3 py-2">
                        {getWrestlerName(c)}
                      </td>
                      <td className="px-3 py-2">
                        {c.event_name ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {fmtDate(c.event_date)}
                      </td>
                      <td className="px-3 py-2">{c.weight_class}</td>
                      <td className="px-3 py-2">{c.age_group}</td>
                      <td className="px-3 py-2 capitalize">
                        {status}
                      </td>
                      <td className="px-3 py-2 max-w-xs">
                        <span className="line-clamp-2">
                          {c.notes ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {matchId ? (
                          <div className="flex gap-2">
                            {/* Message button → same messages UI as parent side */}
                            <Link
                              href={`/messages/match/${matchId}` as any}
                              className="px-2 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs"
                            >
                              Message
                            </Link>
                            {/* View match details */}
                            <Link
                              href={`/coach/matches/${matchId}` as any}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs"
                            >
                              View Match
                            </Link>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">
                            No match yet
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pager */}
        {total > 0 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-400">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={`px-2 py-1 rounded border border-slate-700 bg-slate-900 ${
                currentPage <= 1
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-slate-800"
              }`}
            >
              Prev
            </button>
            <span>
              Page {currentPage} of {pageCount}
            </span>
            <button
              disabled={currentPage >= pageCount}
              onClick={() =>
                setPage((p) => Math.min(pageCount, p + 1))
              }
              className={`px-2 py-1 rounded border border-slate-700 bg-slate-900 ${
                currentPage >= pageCount
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-slate-800"
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
