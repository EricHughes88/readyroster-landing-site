// components/InterestsTableClient.tsx
// Drop this file into your Next.js app (App Router). It renders a full UI for
// listing a wrestler's interests with filtering, sorting, and pagination that
// syncs to the URL query string and calls your API:
//   GET /api/wrestlers/:wrestlerId/interests?eventName&ageGroup&onlyOk&limit&offset&sort

"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Types matching your API response
type Interest = {
  id: number;
  wrestler_id: number;
  event_name: string | null;
  event_date: string | null; // YYYY-MM-DD or null
  weight_class: string | null;
  age_group: string | null;
  notes: string | null;
  parent_ok: boolean | null;
  coach_ok: boolean | null;
  created_at: string | null;
};

type ApiResponse = {
  ok: boolean;
  interests: Interest[];
  page: { limit: number; offset: number; total: number };
};

function useDebounced<T>(value: T, delay = 400) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function numberOr<T>(n: string | null, fallback: T): number | T {
  if (n == null) return fallback;
  const parsed = Number(n);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : (fallback as any);
}

function buildQuery(
  params: URLSearchParams,
  updates: Record<string, string | null | undefined>
) {
  const next = new URLSearchParams(params.toString());
  Object.entries(updates).forEach(([k, v]) => {
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
  });
  return next;
}

export default function InterestsTableClient({
  wrestlerId,
  defaultPageSize = 10,
}: {
  wrestlerId: number;
  defaultPageSize?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Read current query params
  const q_eventName = sp.get("eventName") ?? "";
  const q_ageGroup = sp.get("ageGroup") ?? "";
  const q_onlyOk = sp.get("onlyOk") ?? ""; // "parent" | "coach" | ""
  const q_sort = sp.get("sort") ?? ""; // e.g. "event_date:desc"
  const q_limit = numberOr(sp.get("limit"), defaultPageSize) as number;
  const q_offset = numberOr(sp.get("offset"), 0) as number;

  // Local state for inputs
  const [eventName, setEventName] = React.useState(q_eventName);
  const [ageGroup, setAgeGroup] = React.useState(q_ageGroup);
  const [onlyOk, setOnlyOk] = React.useState(q_onlyOk);
  const [limit, setLimit] = React.useState(q_limit);
  const [sort, setSort] = React.useState(q_sort || "");

  // Keep inputs in sync if URL changes via back/forward
  React.useEffect(() => setEventName(q_eventName), [q_eventName]);
  React.useEffect(() => setAgeGroup(q_ageGroup), [q_ageGroup]);
  React.useEffect(() => setOnlyOk(q_onlyOk), [q_onlyOk]);
  React.useEffect(() => setLimit(q_limit), [q_limit]);
  React.useEffect(() => setSort(q_sort), [q_sort]);

  const debouncedEventName = useDebounced(eventName, 400);

  // Fetch data when params change
  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    const url = new URL(
      `/api/wrestlers/${wrestlerId}/interests`,
      window.location.origin
    );
    const p = new URLSearchParams();
    if (debouncedEventName) p.set("eventName", debouncedEventName);
    if (ageGroup) p.set("ageGroup", ageGroup);
    if (onlyOk) p.set("onlyOk", onlyOk);
    if (sort) p.set("sort", sort);
    p.set("limit", String(limit));

    // If filters changed, reset offset to 0 unless URL already had 0
    const currentOffset = sp.get("offset");
    const offset = currentOffset ? Number(currentOffset) : 0;
    p.set("offset", String(offset));

    url.search = p.toString();

    setLoading(true);
    setError(null);
    fetch(url.toString(), { signal: controller.signal })
      .then(async (r) => {
        const j = (await r.json()) as ApiResponse;
        if (!j.ok) throw new Error("Request failed");
        setData(j);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message || "Error");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
    // We listen to debouncedEventName (not eventName), and raw others
  }, [wrestlerId, debouncedEventName, ageGroup, onlyOk, sort, limit, sp]);

  // Push updates to URL (so the page is shareable/bookmarkable)
  const updateUrl = (updates: Record<string, string | null | undefined>) => {
    const next = buildQuery(sp, updates);
    router.replace(`${pathname}?${next.toString()}`);
  };

  // Handlers
  const onApplyFilters = () => {
    updateUrl({
      eventName: eventName || null,
      ageGroup: ageGroup || null,
      onlyOk: onlyOk || null,
      offset: "0", // reset paging when filters change
      limit: String(limit),
      sort: sort || null,
    });
  };

  const onClear = () => {
    setEventName("");
    setAgeGroup("");
    setOnlyOk("");
    setLimit(defaultPageSize);
    setSort("");
    updateUrl({ eventName: null, ageGroup: null, onlyOk: null, sort: null, offset: "0", limit: String(defaultPageSize) });
  };

  const page = data?.page ?? { limit, offset: q_offset, total: 0 };
  const canPrev = page.offset > 0;
  const canNext = page.offset + page.limit < page.total;

  const gotoPage = (dir: -1 | 1) => {
    const nextOffset = Math.max(0, page.offset + dir * page.limit);
    updateUrl({ offset: String(nextOffset), limit: String(page.limit) });
  };

  const toggleSort = (col: string) => {
    // sort format: "col:asc|desc"
    const [curCol, curDir] = (sort || ":").split(":");
    const nextDir = curCol === col && curDir.toLowerCase() === "asc" ? "desc" : "asc";
    const next = `${col}:${nextDir}`;
    updateUrl({ sort: next, offset: "0" });
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Interests</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Event name</label>
          <input
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Search (e.g., duals)"
            className="w-full rounded-xl border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Age group</label>
          <input
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            placeholder="12U, Girls HS..."
            className="w-full rounded-xl border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirmed by</label>
          <select
            value={onlyOk}
            onChange={(e) => setOnlyOk(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
          >
            <option value="">Anyone</option>
            <option value="parent">Parent</option>
            <option value="coach">Coach</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={onApplyFilters}
            className="rounded-xl px-4 py-2 border shadow text-sm"
          >
            Apply
          </button>
          <button
            onClick={onClear}
            className="rounded-xl px-4 py-2 border text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th label="Event" col="event_name" sort={sort} onSort={toggleSort} />
              <Th label="Date" col="event_date" sort={sort} onSort={toggleSort} />
              <Th label="Age" col="age_group" sort={sort} onSort={toggleSort} />
              <Th label="Weight" col="weight_class" sort={sort} onSort={toggleSort} />
              <th className="text-left p-3">Parent ✓</th>
              <th className="text-left p-3">Coach ✓</th>
              <Th label="Created" col="created_at" sort={sort} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-red-600">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && (data?.interests?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No interests found
                </td>
              </tr>
            )}
            {data?.interests?.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="p-3">{it.event_name ?? "—"}</td>
                <td className="p-3">{it.event_date ?? "—"}</td>
                <td className="p-3">{it.age_group ?? "—"}</td>
                <td className="p-3">{it.weight_class ?? "—"}</td>
                <td className="p-3">{it.parent_ok ? "Yes" : "No"}</td>
                <td className="p-3">{it.coach_ok ? "Yes" : "No"}</td>
                <td className="p-3">{it.created_at ? new Date(it.created_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination & page size */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page</span>
          <select
            value={limit}
            onChange={(e) => {
              const v = Number(e.target.value);
              setLimit(v);
              updateUrl({ limit: String(v), offset: "0" });
            }}
            className="rounded-xl border px-2 py-1 text-sm"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-600">
          {page.total > 0
            ? `${page.offset + 1}–${Math.min(
                page.offset + page.limit,
                page.total
              )} of ${page.total}`
            : "0 of 0"}
        </div>
        <div className="flex gap-2">
          <button
            disabled={!canPrev}
            onClick={() => gotoPage(-1)}
            className={`rounded-xl px-3 py-2 border text-sm ${
              canPrev ? "" : "opacity-40 cursor-not-allowed"
            }`}
          >
            Prev
          </button>
          <button
            disabled={!canNext}
            onClick={() => gotoPage(1)}
            className={`rounded-xl px-3 py-2 border text-sm ${
              canNext ? "" : "opacity-40 cursor-not-allowed"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({
  label,
  col,
  sort,
  onSort,
}: {
  label: string;
  col: string;
  sort: string;
  onSort: (col: string) => void;
}) {
  const [curCol, curDir] = (sort || ":").split(":");
  const active = curCol === col;
  const arrow = !active ? "" : curDir.toLowerCase() === "asc" ? "▲" : "▼";
  return (
    <th
      className="text-left p-3 select-none cursor-pointer"
      onClick={() => onSort(col)}
      title={active ? `Sorted ${curDir}` : "Click to sort"}
    >
      <span className="inline-flex items-center gap-1">
        {label} {arrow && <span className="text-xs">{arrow}</span>}
      </span>
    </th>
  );
}

// ---------------------------------------------------------------------
// Example server page wrapper (optional): paste this into a page like
// app/parent/wrestlers/[id]/interests/page.tsx and adjust the path
// to the component above. This wrapper passes the dynamic route id.
// ---------------------------------------------------------------------

/*
// app/parent/wrestlers/[id]/interests/page.tsx
import InterestsTableClient from "@/components/InterestsTableClient";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next 15: params is Promise
  const wrestlerId = Number(id);
  return (
    <div className="max-w-5xl mx-auto">
      <InterestsTableClient wrestlerId={wrestlerId} defaultPageSize={10} />
    </div>
  );
}
*/
