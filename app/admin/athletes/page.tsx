// app/admin/athletes/page.tsx
"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";

type AthleteRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  state: string | null;
  dob: string | null;
  parent_user_id: number | null;
  avg_travel_miles?: number | null;

  parent_firstname?: string | null;
  parent_lastname?: string | null;
  parent_email?: string | null;
  parent_phone?: string | null;

  created_at?: string | null;
};

function pickArray<T>(obj: any, keys: string[]): T[] {
  for (const k of keys) {
    if (Array.isArray(obj?.[k])) return obj[k] as T[];
  }
  return [];
}

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

function exportCsv(rows: AthleteRow[]) {
  const headers = [
    "id",
    "first_name",
    "last_name",
    "city",
    "state",
    "dob",
    "avg_travel_miles",
    "parent_user_id",
    "parent_firstname",
    "parent_lastname",
    "parent_email",
    "parent_phone",
    "created_at",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escapeCsv((r as any)[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `athletes_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function fmtName(first?: string | null, last?: string | null) {
  const fn = (first || "").trim();
  const ln = (last || "").trim();
  return `${fn} ${ln}`.trim() || "(no name)";
}

function fmtDob(dob: string | null) {
  if (!dob) return "—";
  return String(dob).slice(0, 10);
}

function fmtMiles(v?: number | null) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  return `${Math.round(Number(v))} mi`;
}

type EditAthleteForm = {
  id: number;
  first_name: string;
  last_name: string;
  city: string;
  state: string;
  dob: string;
};

export default function AdminAthletesDbPage() {
  const [rows, setRows] = useState<AthleteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("default");

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditAthleteForm | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const qsParams = new URLSearchParams();

      if (stateFilter && stateFilter !== "ALL") {
        qsParams.set("state", stateFilter);
      }

      if (sortBy && sortBy !== "default") {
        qsParams.set("sort", sortBy);
      }

      const qs = qsParams.toString() ? `?${qsParams.toString()}` : "";

      const res = await fetch(`/api/admin/athletes${qs}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to load athletes");
      }

      const list = pickArray<AthleteRow>(data, [
        "athletes",
        "rows",
        "data",
        "items",
      ]);
      setRows(list);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateFilter, sortBy]);

  const stateCounts = useMemo(() => {
    const map = new Map<string, number>();

    rows.forEach((r) => {
      const st = (r.state || "").trim().toUpperCase();
      if (!st) return;
      map.set(st, (map.get(st) || 0) + 1);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([state, count]) => ({ state, count }));
  }, [rows]);

  const states = useMemo(() => stateCounts.map((x) => x.state), [stateCounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const name = fmtName(r.first_name, r.last_name).toLowerCase();
      const city = (r.city || "").toLowerCase();
      const state = (r.state || "").toLowerCase();
      const dob = (r.dob || "").toLowerCase();
      const avgTravel = fmtMiles(r.avg_travel_miles).toLowerCase();

      const pName = fmtName(
        r.parent_firstname || "",
        r.parent_lastname || ""
      ).toLowerCase();
      const pEmail = (r.parent_email || "").toLowerCase();
      const pPhone = (r.parent_phone || "").toLowerCase();

      return (
        name.includes(q) ||
        city.includes(q) ||
        state.includes(q) ||
        dob.includes(q) ||
        avgTravel.includes(q) ||
        pName.includes(q) ||
        pEmail.includes(q) ||
        pPhone.includes(q)
      );
    });
  }, [rows, search]);

  function openEdit(r: AthleteRow) {
    setEditErr(null);
    setEditForm({
      id: r.id,
      first_name: r.first_name || "",
      last_name: r.last_name || "",
      city: r.city || "",
      state: (r.state || "").toUpperCase(),
      dob: r.dob ? String(r.dob).slice(0, 10) : "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editForm) return;

    setEditSaving(true);
    setEditErr(null);

    try {
      const res = await fetch(`/api/admin/athletes/${editForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          city: editForm.city,
          state: editForm.state,
          dob: editForm.dob || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to save");
      }

      const updated = data.athlete as AthleteRow;

      setRows((prev) =>
        prev.map((r) =>
          r.id === updated.id
            ? {
                ...r,
                first_name: updated.first_name,
                last_name: updated.last_name,
                city: updated.city,
                state: updated.state,
                dob: updated.dob,
              }
            : r
        )
      );

      setEditOpen(false);
      setEditForm(null);
    } catch (e: any) {
      setEditErr(String(e?.message || e));
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Athletes Database
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Admin directory for athletes. Filter by state, search, export, edit, and sort by travel.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Link
                href={"/admin" as Route}
                className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 hover:bg-slate-900"
              >
                ← Back to Admin
              </Link>

              <Link
                href={"/admin/coaches" as Route}
                className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 hover:bg-slate-900"
              >
                Coaches DB
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white"
              >
                <option value="ALL">All states</option>
                {states.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white"
              >
                <option value="default">Sort: Default</option>
                <option value="travel_desc">Sort: Avg Travel High → Low</option>
                <option value="travel_asc">Sort: Avg Travel Low → High</option>
              </select>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search athlete, parent, city, state, DOB…"
                className="w-[340px] max-w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-400"
              />

              <button
                onClick={() => exportCsv(filtered)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
              >
                Export CSV
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Showing <span className="text-slate-200">{filtered.length}</span> of{" "}
              <span className="text-slate-200">{rows.length}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-200">State summary</h2>

            <div className="text-xs text-slate-400">
              {loading ? (
                <>Loading…</>
              ) : stateFilter === "ALL" ? (
                <>
                  Showing <span className="text-slate-200">{rows.length}</span> total athletes across{" "}
                  <span className="text-slate-200">{states.length}</span> states
                </>
              ) : (
                <>
                  Filter: <span className="text-slate-200">{stateFilter}</span> •{" "}
                  <span className="text-slate-200">{rows.length}</span> athletes
                </>
              )}
            </div>
          </div>

          {!loading && stateCounts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setStateFilter("ALL")}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  stateFilter === "ALL"
                    ? "border-red-500 bg-red-600 text-white"
                    : "border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-900"
                }`}
              >
                All ({rows.length})
              </button>

              {stateCounts.map(({ state, count }) => (
                <button
                  key={state}
                  onClick={() => setStateFilter(state)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    stateFilter === state
                      ? "border-red-500 bg-red-600 text-white"
                      : "border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  {state} ({count})
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-200">Directory</h2>
          </div>

          {err ? (
            <div className="p-4 text-sm text-red-300">{err}</div>
          ) : loading ? (
            <div className="p-4 text-sm text-slate-300">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-slate-300">No athletes found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/60 text-slate-200">
                  <tr className="text-left">
                    <th className="px-4 py-3">Athlete</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">DOB</th>
                    <th className="px-4 py-3">Avg Travel</th>
                    <th className="px-4 py-3">Parent</th>
                    <th className="px-4 py-3">Parent Email</th>
                    <th className="px-4 py-3">Parent Phone</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Edit</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-900/30">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/admin/athletes/${r.id}` as Route}
                          className="text-white underline decoration-slate-500 underline-offset-2 hover:text-red-300"
                        >
                          {fmtName(r.first_name, r.last_name)}
                        </Link>
                        <div className="text-xs text-slate-400">
                          AthleteID: {r.id}
                        </div>
                      </td>

                      <td className="px-4 py-3">{r.city || "—"}</td>
                      <td className="px-4 py-3">{r.state || "—"}</td>
                      <td className="px-4 py-3">{fmtDob(r.dob)}</td>
                      <td className="px-4 py-3">{fmtMiles(r.avg_travel_miles)}</td>

                      <td className="px-4 py-3">
                        {fmtName(r.parent_firstname || "", r.parent_lastname || "")}
                        <div className="text-xs text-slate-400">
                          ParentUserID: {r.parent_user_id ?? "—"}
                        </div>
                      </td>

                      <td className="px-4 py-3">{r.parent_email || "—"}</td>
                      <td className="px-4 py-3">{r.parent_phone || "—"}</td>

                      <td className="px-4 py-3 text-xs text-slate-300">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </td>

                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEdit(r)}
                          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold hover:bg-slate-900"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {editOpen && editForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-extrabold">Edit Athlete</div>
                  <div className="mt-1 text-xs text-slate-400">
                    AthleteID: {editForm.id}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditOpen(false);
                    setEditForm(null);
                    setEditErr(null);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs hover:bg-slate-900"
                >
                  Close
                </button>
              </div>

              {editErr && (
                <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                  {editErr}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-slate-300">
                    First Name
                    <input
                      value={editForm.first_name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, first_name: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white"
                    />
                  </label>

                  <label className="text-xs text-slate-300">
                    Last Name
                    <input
                      value={editForm.last_name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, last_name: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-slate-300">
                    City
                    <input
                      value={editForm.city}
                      onChange={(e) =>
                        setEditForm({ ...editForm, city: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white"
                    />
                  </label>

                  <label className="text-xs text-slate-300">
                    State
                    <input
                      value={editForm.state}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          state: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="e.g. MI"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>

                <label className="text-xs text-slate-300">
                  DOB (YYYY-MM-DD)
                  <input
                    value={editForm.dob}
                    onChange={(e) =>
                      setEditForm({ ...editForm, dob: e.target.value })
                    }
                    placeholder="2014-06-21"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setEditOpen(false);
                    setEditForm(null);
                    setEditErr(null);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm hover:bg-slate-900"
                  disabled={editSaving}
                >
                  Cancel
                </button>

                <button
                  onClick={saveEdit}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-60"
                  disabled={editSaving}
                >
                  {editSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}