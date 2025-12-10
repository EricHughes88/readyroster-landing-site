// app/_shared/MatchesTablePage.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  buildMatchesQS,
  getSessionUser,
  userIsCoach,
  userIsParent,
} from "@/lib/session";

type MatchStatus = "pending" | "confirmed" | "all";

type MatchRow = {
  id: number;
  event_name: string | null;
  event_date: string | null;
  weight_class: string | null;
  age_group: string | null;
  notes: string | null;
  status: "pending" | "confirmed";

  // wrestler info
  wrestler_first_name?: string | null;
  wrestler_last_name?: string | null;

  // team info
  team_id?: number | null; // from t.teamid in /api/matches
  team_name?: string | null;
  team_coach_name?: string | null;
  team_logo_path?: string | null;
};

type ApiResponse = {
  ok: boolean;
  matches: MatchRow[];
  page: {
    page: number; // 1-based (we still treat everything as one big page from the API)
    limit: number;
    total: number;
  };
  message?: string;
};

type SortKey = "team" | "coach" | "event" | "status";

/* ---- CSV helpers ---- */

function formatCsvDate(raw: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function MatchesTablePage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [userLoaded, setUserLoaded] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [isCoach, setIsCoach] = useState(false);
  const [isParentUser, setIsParentUser] = useState(false);

  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // pagination state (mirrors URL)
  const [page, setPage] = useState<number>(
    Number(params.get("page") ?? "1") || 1
  );
  const [limit, setLimit] = useState<number>(
    Number(params.get("limit") ?? "10") || 10
  );

  // status tabs
  const status: MatchStatus =
    (params.get("status") as MatchStatus | null) ?? "pending";

  // search + filters
  const [searchText, setSearchText] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [ageFilter, setAgeFilter] = useState<string>("all");
  const [weightFilter, setWeightFilter] = useState<string>("all");

  // sorting
  const [sortKey, setSortKey] = useState<SortKey>("event");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [exporting, setExporting] = useState(false);

  // keep page/limit in sync with URL for back/forward navigation
  useEffect(() => {
    const p = Number(params.get("page") ?? "1") || 1;
    const l = Number(params.get("limit") ?? "10") || 10;
    setPage(p);
    setLimit(l);
  }, [params]);

  // Load session
  useEffect(() => {
    (async () => {
      try {
        const u = await getSessionUser();
        if (!u) {
          router.push("/login");
          return;
        }
        setUser(u);
        setIsCoach(userIsCoach(u));
        setIsParentUser(userIsParent(u));
      } catch (e) {
        console.error("getSessionUser error", e);
      } finally {
        setUserLoaded(true);
      }
    })();
  }, [router]);

  // Build query string for /api/matches
  const qs = useMemo(() => {
    if (!user) return "";
    const base = buildMatchesQS({ user, status }); // helper decides coach vs parent
    const sp = new URLSearchParams(
      base.startsWith("?") ? base.slice(1) : base
    );
    // We still send page/limit in case you later support it server-side.
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    const s = sp.toString();
    return s ? `?${s}` : "";
  }, [user, status, page, limit]);

  // Load matches whenever status/page/limit change and user is ready
  useEffect(() => {
    if (!userLoaded || !user) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/matches${qs}`, { cache: "no-store" });
        const data = (await res.json()) as ApiResponse;
        if (!res.ok || !data.ok) {
          throw new Error(data?.message || "Failed to load matches");
        }
        setRows(data.matches ?? []);
        // We treat the API as returning "all rows", so keep local page/limit.
      } catch (e: any) {
        console.error("load matches error", e);
        setErr(e?.message || "Failed to load matches");
      } finally {
        setLoading(false);
      }
    })();
  }, [qs, userLoaded, user]);

  // Update URL helper
  const updateUrl = (updates: Record<string, string | null>) => {
    const current = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) current.delete(k);
      else current.set(k, v);
    }
    const q = current.toString();
    const dest = q ? `${pathname}?${q}` : pathname;
    router.replace(dest as any, { scroll: false });
  };

  const setStatus = (s: MatchStatus) => {
    updateUrl({
      status: s === "pending" ? null : s, // default is pending, so omit it
      page: "1",
    });
  };

  const changePage = (nextPage: number) => {
    updateUrl({
      page: String(nextPage),
    });
  };

  const changeLimit = (nextLimit: number) => {
    updateUrl({
      limit: String(nextLimit),
      page: "1",
    });
  };

  // --- Search + filter options derived from current data ---

  const eventOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => r.event_name ?? "")
            .filter((n) => n && n.trim().length > 0)
        )
      ).sort(),
    [rows]
  );

  const teamOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => r.team_name ?? "")
            .filter((n) => n && n.trim().length > 0)
        )
      ).sort(),
    [rows]
  );

  const ageOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => r.age_group ?? "")
            .filter((n) => n && n.trim().length > 0)
        )
      ).sort(),
    [rows]
  );

  const weightOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => r.weight_class ?? "")
            .filter((n) => n && n.trim().length > 0)
        )
      ).sort(),
    [rows]
  );

  // --- Apply search, filters, and sorting ---

  const filteredAndSortedRows = useMemo(() => {
    let list = [...rows];

    // Search across several fields
    const q = searchText.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const fields = [
          r.team_name,
          r.team_coach_name,
          r.event_name,
          r.wrestler_first_name,
          r.wrestler_last_name,
          r.weight_class,
          r.age_group,
          r.notes,
        ];
        return fields.some((f) => (f ?? "").toLowerCase().includes(q));
      });
    }

    if (eventFilter !== "all") {
      list = list.filter((r) => r.event_name === eventFilter);
    }
    if (teamFilter !== "all") {
      list = list.filter((r) => r.team_name === teamFilter);
    }
    if (ageFilter !== "all") {
      list = list.filter((r) => r.age_group === ageFilter);
    }
    if (weightFilter !== "all") {
      list = list.filter((r) => r.weight_class === weightFilter);
    }

    // Sorting
    const dir = sortDir === "asc" ? 1 : -1;

    const getField = (r: MatchRow): string => {
      switch (sortKey) {
        case "team":
          return (r.team_name ?? "").toLowerCase();
        case "coach":
          return (r.team_coach_name ?? "").toLowerCase();
        case "status":
          return (r.status ?? "").toLowerCase();
        case "event":
        default:
          return (r.event_name ?? "").toLowerCase();
      }
    };

    list.sort((a, b) => {
      const av = getField(a);
      const bv = getField(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return list;
  }, [
    rows,
    searchText,
    eventFilter,
    teamFilter,
    ageFilter,
    weightFilter,
    sortKey,
    sortDir,
  ]);

  // Pagination (client-side over filtered rows)
  const total = filteredAndSortedRows.length;
  const startIndex = (page - 1) * limit;
  const pagedRows = filteredAndSortedRows.slice(
    startIndex,
    startIndex + limit
  );
  const canGoNext = startIndex + limit < total;

  const isAll = status === "all";

  // 🔧 IMPORTANT FIX: always use /matches/[id]
  const viewHrefFor = (m: MatchRow) => `/matches/${m.id}`;

  const backHref = isCoach ? "/coach" : isParentUser ? "/parent" : "/";

  const confirmedForExport = useMemo(
    () => filteredAndSortedRows.filter((r) => r.status === "confirmed"),
    [filteredAndSortedRows]
  );

  // --- Handlers ---

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    changePage(1);
  };

  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    changePage(1);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  const handleExportConfirmed = () => {
    if (exporting || confirmedForExport.length === 0) return;
    try {
      setExporting(true);

      const header = [
        "Team",
        "Coach",
        "Event",
        "Event Date",
        "Wrestler First Name",
        "Wrestler Last Name",
        "Age Group",
        "Weight Class",
        "Status",
        "Notes",
      ];

      const lines = confirmedForExport.map((m) => {
        const cells = [
          m.team_name ?? "",
          m.team_coach_name ?? "",
          m.event_name ?? "",
          formatCsvDate(m.event_date),
          m.wrestler_first_name ?? "",
          m.wrestler_last_name ?? "",
          m.age_group ?? "",
          m.weight_class ?? "",
          m.status ?? "",
          (m.notes ?? "").replace(/\r?\n/g, " "),
        ];

        return cells
          .map((c) => {
            const s = String(c).replace(/"/g, '""');
            return `"${s}"`;
          })
          .join(",");
      });

      const csvBody = [header.join(","), ...lines].join("\r\n");

      // Add UTF-8 BOM so Excel reads UTF-8 correctly (fixes Brittanyâ€™s)
      const csvWithBom = "\uFEFF" + csvBody;

      const blob = new Blob([csvWithBom], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "ready-roster-confirmed-matches.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // --- Render ---

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header + status tabs + export/back */}
        <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
          <h1 className="text-2xl font-semibold">Matches (NEW UI TEST)</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatus("pending")}
              className={`px-3 py-1 text-xs rounded border ${
                status === "pending"
                  ? "bg-amber-500 text-slate-900 border-amber-500"
                  : "border-slate-700 text-slate-200"
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatus("confirmed")}
              className={`px-3 py-1 text-xs rounded border ${
                status === "confirmed"
                  ? "bg-emerald-500 text-slate-900 border-emerald-500"
                  : "border-slate-700 text-slate-200"
              }`}
            >
              Confirmed
            </button>
            <button
              onClick={() => setStatus("all")}
              className={`px-3 py-1 text-xs rounded border ${
                isAll
                  ? "bg-slate-100 text-slate-900 border-slate-100"
                  : "border-slate-700 text-slate-200"
              }`}
            >
              All
            </button>

            <button
              onClick={handleExportConfirmed}
              disabled={confirmedForExport.length === 0 || exporting}
              className={`ml-2 px-3 py-1.5 text-xs rounded border border-slate-700 ${
                confirmedForExport.length === 0 || exporting
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                  : "bg-slate-900 text-slate-100 hover:bg-slate-800"
              }`}
            >
              {exporting ? "Exporting…" : "Export Confirmed CSV"}
            </button>

            <Link
              href={backHref as any}
              className="ml-2 px-3 py-1.5 text-xs rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        {/* Search + filters */}
        <div className="mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs text-slate-400 mb-1">
              Search (team, coach, wrestler, event, notes…)
            </label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Type to search…"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <div className="min-w-[160px]">
            <label className="block text-xs text-slate-400 mb-1">
              Event
            </label>
            <select
              value={eventFilter}
              onChange={(e) =>
                handleFilterChange(setEventFilter, e.target.value)
              }
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            >
              <option value="all">All events</option>
              {eventOptions.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[160px]">
            <label className="block text-xs text-slate-400 mb-1">
              Team
            </label>
            <select
              value={teamFilter}
              onChange={(e) =>
                handleFilterChange(setTeamFilter, e.target.value)
              }
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            >
              <option value="all">All teams</option>
              {teamOptions.map((tm) => (
                <option key={tm} value={tm}>
                  {tm}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[140px]">
            <label className="block text-xs text-slate-400 mb-1">
              Age group
            </label>
            <select
              value={ageFilter}
              onChange={(e) =>
                handleFilterChange(setAgeFilter, e.target.value)
              }
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            >
              <option value="all">All ages</option>
              {ageOptions.map((ag) => (
                <option key={ag} value={ag}>
                  {ag}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[140px]">
            <label className="block text-xs text-slate-400 mb-1">
              Weight class
            </label>
            <select
              value={weightFilter}
              onChange={(e) =>
                handleFilterChange(setWeightFilter, e.target.value)
              }
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
            >
              <option value="all">All weights</option>
              {weightOptions.map((wc) => (
                <option key={wc} value={wc}>
                  {wc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {err && (
          <div className="mb-4 rounded border border-red-600 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {/* Page size + info */}
        <div className="flex items-center justify-between gap-4 mb-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-300">Rows per page</span>
            <select
              value={limit}
              onChange={(e) => changeLimit(Number(e.target.value))}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="text-slate-400">
            Showing {pagedRows.length} of {total}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">
            Loading matches…
          </div>
        ) : total === 0 ? (
          <div className="py-12 text-center text-slate-400">
            No matches found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-900/80 text-slate-200">
                <tr>
                  <th
                    className="px-3 py-2 text-left cursor-pointer select-none"
                    onClick={() => toggleSort("team")}
                  >
                    Team{sortIndicator("team")}
                  </th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer select-none"
                    onClick={() => toggleSort("coach")}
                  >
                    Coach{sortIndicator("coach")}
                  </th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer select-none"
                    onClick={() => toggleSort("event")}
                  >
                    Event{sortIndicator("event")}
                  </th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer select-none"
                    onClick={() => toggleSort("status")}
                  >
                    Status{sortIndicator("status")}
                  </th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((m) => (
                  <tr key={m.id} className="border-t border-slate-800">
                    <td className="px-3 py-2">
                      {m.team_name ?? "TBD"}
                    </td>
                    <td className="px-3 py-2">
                      {m.team_coach_name ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {m.event_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 capitalize">
                      {m.status}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Link
                          href={`${viewHrefFor(m)}?tab=messages` as any}
                          className="px-2 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700"
                        >
                          Message
                        </Link>
                        <Link
                          href={viewHrefFor(m) as any}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pager */}
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-400">
          <button
            disabled={page <= 1}
            onClick={() => changePage(page - 1)}
            className={`px-2 py-1 rounded border border-slate-700 bg-slate-900 ${
              page <= 1
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-slate-800"
            }`}
          >
            Prev
          </button>
          <span>Page {page}</span>
          <button
            disabled={!canGoNext}
            onClick={() => changePage(page + 1)}
            className={`px-2 py-1 rounded border border-slate-700 bg-slate-900 ${
              !canGoNext
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-slate-800"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
