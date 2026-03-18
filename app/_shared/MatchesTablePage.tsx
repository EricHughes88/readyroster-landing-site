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
import TeamLogo from "@/components/team/TeamLogo";

type MatchStatus = "pending" | "confirmed" | "all";

type MatchRow = {
  id: number;
  event_name: string | null;
  event_date: string | null;
  weight_class: string | null;
  age_group: string | null;
  notes: string | null;
  status: "pending" | "confirmed";

  wrestler_first_name?: string | null;
  wrestler_last_name?: string | null;

  team_id?: number | null;
  team_name?: string | null;
  team_coach_name?: string | null;
  team_logo_path?: string | null;
};

type ApiResponse = {
  ok: boolean;
  matches: MatchRow[];
  page: {
    page: number;
    limit: number;
    total: number;
  };
  message?: string;
};

type SortKey = "team" | "coach" | "event" | "status";

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

function formatEventDate(raw?: string | null): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadgeClasses(status?: string | null) {
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
  if (!s) return "Pending";
  return s.charAt(0).toUpperCase() + s.slice(1);
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

  const [page, setPage] = useState<number>(
    Number(params.get("page") ?? "1") || 1
  );
  const [limit, setLimit] = useState<number>(
    Number(params.get("limit") ?? "10") || 10
  );

  const status: MatchStatus =
    (params.get("status") as MatchStatus | null) ?? "pending";

  const [searchText, setSearchText] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [ageFilter, setAgeFilter] = useState<string>("all");
  const [weightFilter, setWeightFilter] = useState<string>("all");

  const [sortKey, setSortKey] = useState<SortKey>("event");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const p = Number(params.get("page") ?? "1") || 1;
    const l = Number(params.get("limit") ?? "10") || 10;
    setPage(p);
    setLimit(l);
  }, [params]);

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

  const qs = useMemo(() => {
    if (!user) return "";
    const base = buildMatchesQS({ user, status });
    const sp = new URLSearchParams(
      base.startsWith("?") ? base.slice(1) : base
    );
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    const s = sp.toString();
    return s ? `?${s}` : "";
  }, [user, status, page, limit]);

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
      } catch (e: any) {
        console.error("load matches error", e);
        setErr(e?.message || "Failed to load matches");
      } finally {
        setLoading(false);
      }
    })();
  }, [qs, userLoaded, user]);

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
      status: s === "pending" ? null : s,
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

  const filteredAndSortedRows = useMemo(() => {
    let list = [...rows];

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

  const total = filteredAndSortedRows.length;
  const startIndex = (page - 1) * limit;
  const pagedRows = filteredAndSortedRows.slice(
    startIndex,
    startIndex + limit
  );
  const canGoNext = startIndex + limit < total;

  const isAll = status === "all";

  const viewHrefFor = (m: MatchRow) => `/matches/${m.id}`;

  const backHref = isCoach ? "/coach" : isParentUser ? "/parent" : "/";

  const confirmedForExport = useMemo(
    () => filteredAndSortedRows.filter((r) => r.status === "confirmed"),
    [filteredAndSortedRows]
  );

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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Matches</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatus("pending")}
              className={`rounded border px-3 py-1 text-xs ${
                status === "pending"
                  ? "border-amber-500 bg-amber-500 text-slate-900"
                  : "border-slate-700 text-slate-200"
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatus("confirmed")}
              className={`rounded border px-3 py-1 text-xs ${
                status === "confirmed"
                  ? "border-emerald-500 bg-emerald-500 text-slate-900"
                  : "border-slate-700 text-slate-200"
              }`}
            >
              Confirmed
            </button>
            <button
              onClick={() => setStatus("all")}
              className={`rounded border px-3 py-1 text-xs ${
                isAll
                  ? "border-slate-100 bg-slate-100 text-slate-900"
                  : "border-slate-700 text-slate-200"
              }`}
            >
              All
            </button>

            <button
              onClick={handleExportConfirmed}
              disabled={confirmedForExport.length === 0 || exporting}
              className={`ml-2 rounded border border-slate-700 px-3 py-1.5 text-xs ${
                confirmedForExport.length === 0 || exporting
                  ? "cursor-not-allowed bg-slate-800 text-slate-500 opacity-50"
                  : "bg-slate-900 text-slate-100 hover:bg-slate-800"
              }`}
            >
              {exporting ? "Exporting…" : "Export Confirmed CSV"}
            </button>

            <Link
              href={backHref as any}
              className="ml-2 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs hover:bg-slate-700"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs text-slate-400">
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
            <label className="mb-1 block text-xs text-slate-400">Event</label>
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
            <label className="mb-1 block text-xs text-slate-400">Team</label>
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
            <label className="mb-1 block text-xs text-slate-400">
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
            <label className="mb-1 block text-xs text-slate-400">
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

        <div className="mb-3 flex items-center justify-between gap-4 text-sm">
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
            <table className="w-full overflow-hidden rounded-lg border border-slate-800 text-sm">
              <thead className="bg-slate-900/80 text-slate-200">
                <tr>
                  <th
                    className="cursor-pointer select-none px-3 py-2 text-left"
                    onClick={() => toggleSort("team")}
                  >
                    Team{sortIndicator("team")}
                  </th>
                  <th
                    className="cursor-pointer select-none px-3 py-2 text-left"
                    onClick={() => toggleSort("event")}
                  >
                    Event{sortIndicator("event")}
                  </th>
                  <th
                    className="cursor-pointer select-none px-3 py-2 text-left"
                    onClick={() => toggleSort("status")}
                  >
                    Status{sortIndicator("status")}
                  </th>
                  <th
                    className="cursor-pointer select-none px-3 py-2 text-left"
                    onClick={() => toggleSort("coach")}
                  >
                    Coach{sortIndicator("coach")}
                  </th>
                  <th className="px-3 py-2 text-left">Event Date</th>
                  <th className="px-3 py-2 text-left">Division</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((m) => (
                  <tr key={m.id} className="border-t border-slate-800 align-top">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <TeamLogo
                          logoPath={m.team_logo_path ?? null}
                          teamName={m.team_name ?? "Team"}
                          size={40}
                          rounded={false}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-white">
                            {m.team_name ?? "TBD"}
                          </div>
                          <div className="text-xs text-slate-400">
                            {m.team_coach_name ?? "No coach listed"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{m.event_name ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClasses(
                          m.status
                        )}`}
                      >
                        {statusLabel(m.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">{m.team_coach_name ?? "—"}</td>
                    <td className="px-3 py-3">{formatEventDate(m.event_date)}</td>
                    <td className="px-3 py-3">
                      <div className="text-white">
                        {m.age_group ?? "—"} • {m.weight_class ?? "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`${viewHrefFor(m)}?tab=messages` as any}
                          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 hover:bg-slate-700"
                        >
                          Message
                        </Link>
                        <Link
                          href={viewHrefFor(m) as any}
                          className="rounded bg-emerald-600 px-2 py-1 text-slate-950 hover:bg-emerald-500"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}

                {pagedRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                      No matches found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-400">
          <button
            disabled={page <= 1}
            onClick={() => changePage(page - 1)}
            className={`rounded border border-slate-700 bg-slate-900 px-2 py-1 ${
              page <= 1
                ? "cursor-not-allowed opacity-40"
                : "hover:bg-slate-800"
            }`}
          >
            Prev
          </button>
          <span>Page {page}</span>
          <button
            disabled={!canGoNext}
            onClick={() => changePage(page + 1)}
            className={`rounded border border-slate-700 bg-slate-900 px-2 py-1 ${
              !canGoNext
                ? "cursor-not-allowed opacity-40"
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