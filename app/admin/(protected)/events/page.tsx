// app/admin/(protected)/events/page.tsx
"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";

type EventRow = {
  event_name: string;
  coach_needs: number;
  unique_coaches: number;
  athlete_interest: number;
  unique_athletes: number;
  supply_gap: number;
};

type ApiResp =
  | { ok: true; days: number; limit: number; rows: EventRow[] }
  | { ok: false; message?: string; details?: unknown };

function safeStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

function escapeCsv(v: any) {
  const s = safeStr(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportCsv(rows: EventRow[]) {
  const headers = [
    "event_name",
    "coach_needs",
    "unique_coaches",
    "athlete_interest",
    "unique_athletes",
    "supply_gap",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        escapeCsv(r.event_name),
        r.coach_needs,
        r.unique_coaches,
        r.athlete_interest,
        r.unique_athletes,
        r.supply_gap,
      ].join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `events_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminEventsPage() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // UI state
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<keyof EventRow>("coach_needs");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // edit state
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // merge state
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  const [mergeTo, setMergeTo] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(
        "/api/admin/analytics/event-traction?days=365&limit=200",
        { cache: "no-store" }
      );
      const data: ApiResp = await res.json();

      if (!res.ok || !data.ok) {
        setErr((data as any)?.message ?? `Failed to load (HTTP ${res.status})`);
        setRows([]);
        return;
      }

      setRows(Array.isArray((data as any).rows) ? (data as any).rows : []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load events");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredSorted = useMemo(() => {
    const qq = q.trim().toLowerCase();

    let out = rows;
    if (qq) {
      out = out.filter((r) => String(r.event_name ?? "").toLowerCase().includes(qq));
    }

    out = [...out].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];

      if (sortKey === "event_name") {
        const cmp = String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      }

      const na = Number(av);
      const nb = Number(bv);
      const cmp = na === nb ? 0 : na < nb ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return out;
  }, [rows, q, sortKey, sortDir]);

  function toggleSort(k: keyof EventRow) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "event_name" ? "asc" : "desc");
    }
  }

  function startEdit(name: string) {
    setEditing(name);
    setEditValue(name);
  }

  function cancelEdit() {
    setEditing(null);
    setEditValue("");
  }

  async function saveEdit(oldName: string) {
    const newName = editValue.trim();
    if (!newName) return alert("Event name cannot be blank.");
    if (newName === oldName) return cancelEdit();

    const ok = confirm(
      `Rename event everywhere?\n\n"${oldName}" → "${newName}"\n\nThis will update coach needs + athlete interests.`
    );
    if (!ok) return;

    try {
      const res = await fetch("/api/admin/events/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        alert(data?.message ?? `Rename failed (HTTP ${res.status})`);
        return;
      }
      cancelEdit();
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Rename failed");
    }
  }

  async function runMerge() {
    if (!mergeFrom || !mergeTo) return alert("Pick both Merge FROM and Merge TO.");
    if (mergeFrom === mergeTo) return alert("Merge FROM and TO must be different.");

    const ok = confirm(
      `Merge "${mergeFrom}" into "${mergeTo}"?\n\nThis will update coach needs + athlete interests so the FROM name becomes the TO name.`
    );
    if (!ok) return;

    try {
      const res = await fetch("/api/admin/events/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromName: mergeFrom, toName: mergeTo }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        alert(data?.message ?? `Merge failed (HTTP ${res.status})`);
        return;
      }
      setMergeFrom(null);
      setMergeTo(null);
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Merge failed");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin • Normalize Events</h1>
            <p className="mt-1 text-sm text-slate-300">
              Rename/merge event names so analytics don’t split counts (example:
              “Nuway nationals” vs “Nuway Nationals”).
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={"/admin" as Route}
              prefetch={false}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
            >
              Back
            </Link>

            <button
              onClick={() => exportCsv(filteredSorted)}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
              disabled={loading}
            >
              Export CSV
            </button>

            <button
              onClick={load}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 lg:col-span-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search events..."
                  className="w-full md:w-80 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-red-500"
                />
                <div className="text-sm text-slate-400">
                  {filteredSorted.length} shown
                </div>
              </div>

              <div className="text-xs text-slate-400">
                Tip: Use <span className="text-slate-200">Rename</span> for typos
                (“Cheeshead”), and <span className="text-slate-200">Merge</span>{" "}
                to consolidate duplicates.
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="text-left text-slate-300">
                  <tr className="border-b border-slate-800">
                    <th
                      className="py-2 pr-3 cursor-pointer select-none"
                      onClick={() => toggleSort("event_name")}
                      title="Sort"
                    >
                      Event{" "}
                      {sortKey === "event_name"
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </th>

                    <th
                      className="py-2 pr-3 cursor-pointer select-none"
                      onClick={() => toggleSort("coach_needs")}
                    >
                      Coach needs{" "}
                      {sortKey === "coach_needs"
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </th>

                    <th
                      className="py-2 pr-3 cursor-pointer select-none"
                      onClick={() => toggleSort("unique_coaches")}
                    >
                      Unique coaches{" "}
                      {sortKey === "unique_coaches"
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </th>

                    <th
                      className="py-2 pr-3 cursor-pointer select-none"
                      onClick={() => toggleSort("athlete_interest")}
                    >
                      Athlete interest{" "}
                      {sortKey === "athlete_interest"
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </th>

                    <th
                      className="py-2 pr-3 cursor-pointer select-none"
                      onClick={() => toggleSort("unique_athletes")}
                    >
                      Unique athletes{" "}
                      {sortKey === "unique_athletes"
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </th>

                    <th
                      className="py-2 pr-3 cursor-pointer select-none"
                      onClick={() => toggleSort("supply_gap")}
                    >
                      Supply gap{" "}
                      {sortKey === "supply_gap"
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </th>

                    <th className="py-2 pl-2">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-slate-400">
                        Loading…
                      </td>
                    </tr>
                  ) : err ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-red-300">
                        {err}
                      </td>
                    </tr>
                  ) : filteredSorted.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-slate-400">
                        No events found.
                      </td>
                    </tr>
                  ) : (
                    filteredSorted.map((r) => {
                      const isEditing = editing === r.event_name;

                      return (
                        <tr
                          key={r.event_name}
                          className="border-b border-slate-900 hover:bg-slate-900/30"
                        >
                          <td className="py-3 pr-3 font-semibold">
                            {isEditing ? (
                              <input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm outline-none focus:border-red-500"
                              />
                            ) : (
                              r.event_name
                            )}
                          </td>

                          <td className="py-3 pr-3">{r.coach_needs}</td>
                          <td className="py-3 pr-3">{r.unique_coaches}</td>
                          <td className="py-3 pr-3">{r.athlete_interest}</td>
                          <td className="py-3 pr-3">{r.unique_athletes}</td>
                          <td className="py-3 pr-3">{r.supply_gap}</td>

                          <td className="py-3 pl-2">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveEdit(r.event_name)}
                                  className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold hover:bg-red-500"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEdit(r.event_name)}
                                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
                                >
                                  Rename
                                </button>
                                <button
                                  onClick={() => {
                                    setMergeFrom(r.event_name);
                                    if (!mergeTo) setMergeTo(r.event_name);
                                  }}
                                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
                                  title="Set as Merge FROM"
                                >
                                  From
                                </button>
                                <button
                                  onClick={() => setMergeTo(r.event_name)}
                                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
                                  title="Set as Merge TO"
                                >
                                  To
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-lg font-semibold">Merge Events</h2>
            <p className="mt-1 text-sm text-slate-300">
              Use this to combine duplicates (case differences, extra spaces,
              etc.). “Merge FROM” will be updated into “Merge TO”.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-slate-400">Merge FROM</div>
                <div className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                  {mergeFrom ?? <span className="text-slate-500">Not set</span>}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400">Merge TO</div>
                <div className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                  {mergeTo ?? <span className="text-slate-500">Not set</span>}
                </div>
              </div>

              <button
                onClick={runMerge}
                className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
                disabled={loading}
              >
                Merge
              </button>

              <button
                onClick={() => {
                  setMergeFrom(null);
                  setMergeTo(null);
                }}
                className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
              >
                Clear
              </button>

              <div className="pt-2 text-xs text-slate-400">
                <div className="font-semibold text-slate-300">How to use:</div>
                <ol className="mt-1 list-decimal pl-4 space-y-1">
                  <li>Click <b>From</b> on the bad/typo event name</li>
                  <li>Click <b>To</b> on the correct event name</li>
                  <li>Click <b>Merge</b></li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
          <h3 className="font-semibold">Important</h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-300 space-y-1">
            <li>
              Rename/Merge updates both <code>coach_needs</code> and{" "}
              <code>wrestler_interests</code>.
            </li>
            <li>
              After normalizing, your analytics table will stop splitting
              identical events.
            </li>
            <li>
              Next step (best practice): move to an <code>events</code> table +
              event_id foreign keys to prevent typos forever.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}