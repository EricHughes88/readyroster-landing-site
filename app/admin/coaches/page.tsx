// app/admin/coaches/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CoachRow = {
  id: number; // user id
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;

  teamid: number | null;
  teamname: string | null;
  coach_name: string | null;
  contactemail: string | null;
  logopath: string | null;
  city: string | null;
  state: string | null;
};

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

function exportCsv(rows: CoachRow[]) {
  const headers = [
    "id",
    "firstname",
    "lastname",
    "email",
    "phone",
    "created_at",
    "teamid",
    "teamname",
    "coach_name",
    "contactemail",
    "logopath",
    "city",
    "state",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => escapeCsv((r as any)[h])).join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `coaches_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function fmtCoachName(r: CoachRow) {
  const n = (r.coach_name || "").trim();
  if (n) return n;

  const fn = (r.firstname || "").trim();
  const ln = (r.lastname || "").trim();
  const full = `${fn} ${ln}`.trim();
  return full || "(no name)";
}

/**
 * User display priority:
 * 1) users.firstname+lastname
 * 2) teams.coach_name
 * 3) users.email
 * 4) teams.contactemail
 */
function userDisplay(r: CoachRow) {
  const fn = (r.firstname || "").trim();
  const ln = (r.lastname || "").trim();
  const full = `${fn} ${ln}`.trim();
  if (full) return full;

  const coach = (r.coach_name || "").trim();
  if (coach) return coach;

  const email = (r.email || "").trim();
  if (email) return email;

  const cEmail = (r.contactemail || "").trim();
  if (cEmail) return cEmail;

  return "(unknown)";
}

type EditTeamForm = {
  teamid: number;
  teamname: string;
  coach_name: string;
  contactemail: string;
  city: string;
  state: string;
};

export default function AdminCoachesDbPage() {
  const router = useRouter();

  const [rows, setRows] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditTeamForm | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const qs =
        stateFilter && stateFilter !== "ALL"
          ? `?state=${encodeURIComponent(stateFilter)}`
          : "";

      const res = await fetch(`/api/admin/coaches${qs}`, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to load coaches");
      }

      setRows(data.coaches || []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateFilter]);

  const states = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const st = (r.state || "").trim();
      if (st) s.add(st);
    }
    return Array.from(s).sort();
  }, [rows]);

  const buckets = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const st = (r.state || "").trim() || "Unknown";
      map.set(st, (map.get(st) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([state, count]) => ({ state, count }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const team = (r.teamname || "").toLowerCase();
      const coach = fmtCoachName(r).toLowerCase();
      const user = userDisplay(r).toLowerCase();
      const email = (r.email || "").toLowerCase();
      const contactemail = (r.contactemail || "").toLowerCase();
      const phone = (r.phone || "").toLowerCase();
      const city = (r.city || "").toLowerCase();
      const state = (r.state || "").toLowerCase();

      return (
        team.includes(q) ||
        coach.includes(q) ||
        user.includes(q) ||
        email.includes(q) ||
        contactemail.includes(q) ||
        phone.includes(q) ||
        city.includes(q) ||
        state.includes(q)
      );
    });
  }, [rows, search]);

  function openEdit(r: CoachRow) {
    if (!r.teamid) return;

    setEditErr(null);
    setEditForm({
      teamid: r.teamid,
      teamname: r.teamname || "",
      coach_name: r.coach_name || "",
      contactemail: r.contactemail || "",
      city: r.city || "",
      state: r.state || "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editForm) return;

    setEditSaving(true);
    setEditErr(null);

    try {
      const res = await fetch(`/api/admin/teams/${editForm.teamid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          teamname: editForm.teamname,
          coach_name: editForm.coach_name,
          contactemail: editForm.contactemail,
          city: editForm.city,
          state: editForm.state,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to save");
      }

      // Update local rows for any row that has this teamid
      const updated = data.team as {
        teamid: number;
        teamname: string | null;
        coach_name: string | null;
        contactemail: string | null;
        city: string | null;
        state: string | null;
        logopath: string | null;
      };

      setRows((prev) =>
        prev.map((r) =>
          r.teamid === updated.teamid
            ? {
                ...r,
                teamname: updated.teamname ?? r.teamname,
                coach_name: updated.coach_name ?? r.coach_name,
                contactemail: updated.contactemail ?? r.contactemail,
                city: updated.city ?? r.city,
                state: updated.state ?? r.state,
                logopath: updated.logopath ?? r.logopath,
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
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Coaches Database
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Admin directory for coaches/teams. Filter by state, search, export,
              and edit city/state.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <button
                onClick={() => router.push("/admin")}
                className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 hover:bg-slate-900"
              >
                ← Back to Admin
              </button>

              <Link
                href="/admin/athletes"
                className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 hover:bg-slate-900"
              >
                Athletes DB
              </Link>
            </div>
          </div>

          {/* Controls */}
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

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team, coach, email, city, state…"
                className="w-[320px] max-w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-400"
              />

              <button
                onClick={() => exportCsv(filtered)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
              >
                Export CSV
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Showing <span className="text-slate-200">{filtered.length}</span>{" "}
              of <span className="text-slate-200">{rows.length}</span>
            </div>
          </div>
        </div>

        {/* Buckets */}
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">
              Coaches by State
            </h2>
            <span className="text-xs text-slate-400">(bucketed from results)</span>
          </div>

          {loading ? (
            <div className="mt-4 text-sm text-slate-300">Loading…</div>
          ) : buckets.length === 0 ? (
            <div className="mt-4 text-sm text-slate-300">No coaches found.</div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {buckets.slice(0, 24).map((b) => (
                <button
                  key={b.state}
                  onClick={() =>
                    setStateFilter(b.state === "Unknown" ? "ALL" : b.state)
                  }
                  className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-3 text-left hover:bg-slate-900"
                  title="Click to filter"
                >
                  <div className="text-xs text-slate-400">{b.state}</div>
                  <div className="text-lg font-bold">{b.count}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-200">Directory</h2>
          </div>

          {err ? (
            <div className="p-4 text-sm text-red-300">{err}</div>
          ) : loading ? (
            <div className="p-4 text-sm text-slate-300">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-slate-300">No coaches found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900/60 text-slate-200">
                  <tr className="text-left">
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Coach</th>
                    <th className="px-4 py-3">Contact Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtered.map((r) => (
                    <tr
                      key={`${r.id}-${r.teamid ?? "x"}`}
                      className="hover:bg-slate-900/30"
                    >
                      <td className="px-4 py-3 font-medium">
                        {r.teamname || "—"}
                        <div className="text-xs text-slate-400">
                          TeamID: {r.teamid ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{fmtCoachName(r)}</td>
                      <td className="px-4 py-3">
                        {r.contactemail || r.email || "—"}
                      </td>
                      <td className="px-4 py-3">{r.phone || "—"}</td>
                      <td className="px-4 py-3">{r.city || "—"}</td>
                      <td className="px-4 py-3">{r.state || "—"}</td>
                      <td className="px-4 py-3">
                        {userDisplay(r)}
                        <div className="text-xs text-slate-400">
                          UserID: {r.id}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {r.created_at
                          ? new Date(r.created_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          disabled={!r.teamid}
                          onClick={() => openEdit(r)}
                          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold hover:bg-slate-900 disabled:opacity-50"
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

        {/* Edit Modal */}
        {editOpen && editForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-extrabold">Edit Team</div>
                  <div className="mt-1 text-xs text-slate-400">
                    TeamID: {editForm.teamid}
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
                <label className="text-xs text-slate-300">
                  Team Name
                  <input
                    value={editForm.teamname}
                    onChange={(e) =>
                      setEditForm({ ...editForm, teamname: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white"
                  />
                </label>

                <label className="text-xs text-slate-300">
                  Coach Name
                  <input
                    value={editForm.coach_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, coach_name: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white"
                  />
                </label>

                <label className="text-xs text-slate-300">
                  Contact Email
                  <input
                    value={editForm.contactemail}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        contactemail: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white"
                  />
                </label>

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
                        setEditForm({ ...editForm, state: e.target.value })
                      }
                      placeholder="e.g. MI"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>
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