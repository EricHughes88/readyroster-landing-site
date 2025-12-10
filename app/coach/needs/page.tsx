// app/coach/needs/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { getSessionUser } from "@/lib/session";

type Need = {
  id: number;
  event_name: string | null;
  event_date: string | null;
  weight_class: string | null;
  age_group: string | null;
  city?: string | null;
  state?: string | null;
  created_at?: string | null;
};

// Simple helper to make ISO dates look like 12/29/2025
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr; // fallback if it's not a real date
  return d.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

const PAGE_SIZE = 10;

type SortOption = "date-soonest" | "date-latest" | "event-name" | "weight";

export default function CoachNeedsPage() {
  const router = useRouter();

  const [needs, setNeeds] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date-soonest");

  // Adjust page if list size changes
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(needs.length / PAGE_SIZE));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [needs.length, page]);

  useEffect(() => {
    const u = getSessionUser();

    // Not logged in → go to login
    if (!u) {
      router.replace("/login");
      return;
    }

    // TS-safe non-null user
    const user = u as NonNullable<typeof u>;

    // Only coaches should see this page
    const role = String(user.role || "").toLowerCase();
    if (role !== "coach") {
      router.replace("/parent");
      return;
    }

    async function loadNeeds() {
      const coachId = user.id; // safe now

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/coach/needs?coachUserId=${encodeURIComponent(coachId)}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const list: Need[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.needs)
          ? (data as any).needs
          : [];

        setNeeds(list);
      } catch (err: any) {
        setError(String(err?.message ?? err));
      } finally {
        setLoading(false);
      }
    }

    loadNeeds();
  }, [router]);

  // Filter + sort
  const filteredAndSortedNeeds = useMemo(() => {
    let list = [...needs];

    // 🔍 Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((n) => {
        const fields = [
          n.event_name,
          n.city,
          n.state,
          n.weight_class,
          n.age_group,
        ]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase());

        return fields.some((f) => f.includes(q));
      });
    }

    // 🔽 Sorting
    list.sort((a, b) => {
      switch (sortBy) {
        case "date-soonest": {
          const da = a.event_date ? new Date(a.event_date).getTime() : Infinity;
          const db = b.event_date ? new Date(b.event_date).getTime() : Infinity;
          return da - db;
        }
        case "date-latest": {
          const da = a.event_date ? new Date(a.event_date).getTime() : -Infinity;
          const db = b.event_date ? new Date(b.event_date).getTime() : -Infinity;
          return db - da;
        }
        case "event-name": {
          const ea = (a.event_name ?? "").toLowerCase();
          const eb = (b.event_name ?? "").toLowerCase();
          return ea.localeCompare(eb);
        }
        case "weight": {
          const wa = (a.weight_class ?? "").toLowerCase();
          const wb = (b.weight_class ?? "").toLowerCase();
          return wa.localeCompare(wb);
        }
        default:
          return 0;
      }
    });

    return list;
  }, [needs, search, sortBy]);

  // Reset to first page when search or sort changes
  useEffect(() => {
    setPage(1);
  }, [search, sortBy]);

  const totalItems = filteredAndSortedNeeds.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const pageNeeds = filteredAndSortedNeeds.slice(startIndex, endIndex);

  // 🔄 Export current filtered list as CSV
  function handleExportCsv() {
    if (!filteredAndSortedNeeds.length) return;

    const headers = [
      "Event",
      "Event Date",
      "Age Group",
      "Weight Class",
      "City",
      "State",
      "Created At",
    ];

    const rows = filteredAndSortedNeeds.map((n) => [
      n.event_name ?? "",
      formatDate(n.event_date),
      n.age_group ?? "",
      n.weight_class ?? "",
      n.city ?? "",
      n.state ?? "",
      n.created_at ? formatDate(n.created_at) : "",
    ]);

    const escapeCell = (val: string) =>
      `"${val.replace(/"/g, '""')}"`; // CSV-safe

    const csvContent =
      headers.map(escapeCell).join(",") +
      "\n" +
      rows.map((row) => row.map(escapeCell).join(",")).join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "readyroster_needs_export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Your Team Needs</h1>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!filteredAndSortedNeeds.length}
            className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export CSV
          </button>
          <Link
            href={"/coach/needs/new" as Route}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Post a Need
          </Link>
        </div>
      </div>

      {/* Controls row: search + sort */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search by event, city, state, age, weight…"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date-soonest">Event date (soonest first)</option>
            <option value="date-latest">Event date (latest first)</option>
            <option value="event-name">Event name (A–Z)</option>
            <option value="weight">Weight class (A–Z)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          Loading your needs…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-900/20 p-4 text-red-300">
          Error: {error}
        </div>
      ) : totalItems === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          <p>
            No needs found. Try adjusting your search or click{" "}
            <span className="font-medium">Post a Need</span> to add one.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {pageNeeds.map((n) => (
              <li
                key={n.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {n.event_name ?? "Event"}{" "}
                    {n.event_date ? (
                      <span className="text-slate-300">
                        • {formatDate(n.event_date)}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-slate-300">
                    {n.age_group ?? "Age ?"} • {n.weight_class ?? "Weight ?"}
                    {n.city || n.state ? (
                      <>
                        {" "}
                        • {n.city ?? ""}
                        {n.city && n.state ? ", " : ""}
                        {n.state ?? ""}
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={
                      `/coach/needs/${n.id}/matches` as Route<
                        `/coach/needs/${number}/matches`
                      >
                    }
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
                  >
                    View Matches
                  </Link>

                  <Link
                    href={
                      `/coach/needs/${n.id}/edit` as Route<
                        `/coach/needs/${number}/edit`
                      >
                    }
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {/* Pagination controls */}
          <div className="mt-6 flex flex-col items-center justify-between gap-3 text-sm text-slate-400 sm:flex-row">
            <div>
              Showing{" "}
              <span className="font-medium">
                {startIndex + 1}-{endIndex}
              </span>{" "}
              of <span className="font-medium">{totalItems}</span> needs
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
              >
                Prev
              </button>
              <span>
                Page <span className="font-medium">{page}</span> of{" "}
                <span className="font-medium">{totalPages}</span>
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
