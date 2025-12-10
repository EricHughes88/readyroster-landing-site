// app/parent/wrestlers/[id]/interests/page.tsx
"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";

type InterestRow = {
  id: number;
  event_name: string | null;
  event_date: string | null; // "YYYY-MM-DD" or null
  weight_class: string | null;
  age_group: string | null;
  notes: string | null;
  // Hide these two cols if you didn't add them to the DB yet:
  parent_ok?: boolean | null;
  coach_ok?: boolean | null;
  created_at?: string | null;

  // ✅ optional match info (if joined in your API)
  match_id?: number | null;
  match_status?: "pending" | "confirmed" | "declined" | null;
};

type ApiResponse = {
  ok: boolean;
  interests: InterestRow[];
  page: { limit: number; offset: number; total: number };
  message?: string;
};

type Interest = {
  id: number;
  eventName: string;
  eventDate: string | null;
  weightClass: string;
  ageGroup: string | null;
  notes: string | null;
  // optional in UI:
  parentOk?: boolean | null;
  coachOk?: boolean | null;
  createdAt?: string | null;

  // ✅ mapped match info for UI
  matchId?: number | null;
  matchStatus?: "pending" | "confirmed" | "declined" | null;
};

function fmtDate(raw?: string | null) {
  if (!raw) return "—";
  const d = new Date(raw);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
}

function useNumberParam(sp: URLSearchParams, key: string, fallback: number) {
  const v = sp.get(key);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export default function WrestlerInterestsPage() {
  const params = useParams<{ id: string }>();
  const wrestlerId = Number(params.id);
  const router = useRouter();
  const sp = useSearchParams();

  // ---- Query params (with defaults) ----
  const qEventName = sp.get("eventName") ?? "";
  const qAgeGroup = sp.get("ageGroup") ?? "";
  const qOnlyOk = sp.get("onlyOk") ?? ""; // "parent" | "coach" | ""
  const qSort = sp.get("sort") ?? ""; // e.g., "event_date:desc"
  const qLimit = useNumberParam(sp, "limit", 10);
  const qOffset = useNumberParam(sp, "offset", 0);

  // ---- Local state for filters/form ----
  const [eventName, setEventName] = useState(qEventName);
  const [ageGroup, setAgeGroup] = useState(qAgeGroup);
  const [onlyOk, setOnlyOk] = useState(qOnlyOk);
  const [limit, setLimit] = useState(qLimit);
  const [sort, setSort] = useState(qSort);

  // keep inputs in sync with URL if the user navigates back/forward
  useEffect(() => setEventName(qEventName), [qEventName]);
  useEffect(() => setAgeGroup(qAgeGroup), [qAgeGroup]);
  useEffect(() => setOnlyOk(qOnlyOk), [qOnlyOk]);
  useEffect(() => setLimit(qLimit), [qLimit]);
  useEffect(() => setSort(qSort), [qSort]);

  // ---- Data state ----
  const [list, setList] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [page, setPage] = useState<{ limit: number; offset: number; total: number }>({
    limit: qLimit,
    offset: qOffset,
    total: 0,
  });

  // ✅ loading state just for confirm/reject buttons
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // ---- Form state (create/edit) ----
  const [eventNameForm, setEventNameForm] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [weightClass, setWeightClass] = useState("");
  const [ageGroupForm, setAgeGroupForm] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const updateUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      router.replace(`?${next.toString()}`);
    },
    [router, sp]
  );

  const buildApiUrl = useCallback(() => {
    const url = new URL(
      `/api/wrestlers/${wrestlerId}/interests`,
      typeof window !== "undefined" ? window.location.origin : "http://localhost"
    );
    const p = new URLSearchParams();
    if (qEventName) p.set("eventName", qEventName);
    if (qAgeGroup) p.set("ageGroup", qAgeGroup);
    if (qOnlyOk) p.set("onlyOk", qOnlyOk);
    if (qSort) p.set("sort", qSort);
    p.set("limit", String(qLimit));
    p.set("offset", String(qOffset));
    url.search = p.toString();
    return url.toString();
  }, [wrestlerId, qEventName, qAgeGroup, qOnlyOk, qSort, qLimit, qOffset]);

  const load = useCallback(async () => {
    if (!wrestlerId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(buildApiUrl(), { cache: "no-store" });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.ok) throw new Error(data?.message || "Failed to load interests");

      const mapped: Interest[] = (data.interests ?? []).map((r: InterestRow) => ({
        id: r.id,
        eventName: r.event_name ?? "",
        eventDate: r.event_date,
        weightClass: r.weight_class ?? "",
        ageGroup: r.age_group,
        notes: r.notes,
        parentOk: r.parent_ok ?? null,
        coachOk: r.coach_ok ?? null,
        createdAt: r.created_at ?? null,
        // ✅ map optional match info if present
        matchId: r.match_id ?? null,
        matchStatus: r.match_status ?? null,
      }));
      setList(mapped);
      setPage(data.page || { limit: qLimit, offset: qOffset, total: mapped.length });
    } catch (e: any) {
      setErr(e?.message || "Failed to load interests");
    } finally {
      setLoading(false);
    }
  }, [wrestlerId, buildApiUrl, qLimit, qOffset]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setEventNameForm("");
    setEventDate("");
    setWeightClass("");
    setAgeGroupForm("");
    setNotes("");
    setEditingId(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSaving(true);

    try {
      if (editingId) {
        // Update existing interest
        const res = await fetch(`/api/interests/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName: eventNameForm,
            eventDate,
            weightClass,
            ageGroup: ageGroupForm,
            notes,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data?.message || "Update failed");
        setMsg("Interest updated.");
      } else {
        // Create new interest
        const res = await fetch(`/api/wrestlers/${wrestlerId}/interests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName: eventNameForm,
            eventDate,
            weightClass,
            ageGroup: ageGroupForm,
            notes,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.message || "Create failed");
        setMsg("Interest added.");
      }
      resetForm();
      // Reset to first page after a write
      updateUrl({ offset: "0" });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: Interest) {
    setEditingId(row.id);
    setEventNameForm(row.eventName || "");
    setEventDate(row.eventDate ? row.eventDate.slice(0, 10) : "");
    setWeightClass(row.weightClass || "");
    setAgeGroupForm(row.ageGroup || "");
    setNotes(row.notes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: number) {
    if (!confirm("Delete this interest?")) return;
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/interests/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setErr(data?.message || "Delete failed");
    } else {
      setMsg("Interest deleted.");
      updateUrl({ offset: "0" });
      await load();
    }
  }

  // ✅ Parent confirm / reject match
  async function confirmMatch(matchId: number) {
    try {
      setActionLoadingId(matchId);
      setErr(null);
      setMsg(null);

      const res = await fetch(`/api/matches/${matchId}/confirm-parent`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Failed to confirm match");
      }

      setMsg("Match confirmed! You’re locked in for this event.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to confirm match");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function rejectMatch(matchId: number) {
    if (!window.confirm("Are you sure you want to reject this match request?")) {
      return;
    }

    try {
      setActionLoadingId(matchId);
      setErr(null);
      setMsg(null);

      const res = await fetch(`/api/matches/${matchId}/reject`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Failed to reject match");
      }

      setMsg("Match request rejected.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to reject match");
    } finally {
      setActionLoadingId(null);
    }
  }

  const canPrev = page.offset > 0;
  const canNext = page.offset + page.limit < page.total;

  const toggleSort = (col: string) => {
    const [curCol, curDir = ""] = (sort || ":").split(":");
    const nextDir = curCol === col && curDir.toLowerCase() === "asc" ? "desc" : "asc";
    const next = `${col}:${nextDir}`;
    setSort(next);
    updateUrl({ sort: next, offset: "0" });
  };

  const arrowFor = useCallback(
    (col: string) => {
      const [curCol, curDir = ""] = (sort || ":").split(":");
      if (curCol !== col) return "";
      return curDir.toLowerCase() === "asc" ? "▲" : "▼";
    },
    [sort]
  );

  // columns you can sort by (must match API whitelist)
  const sortableCols = useMemo(
    () => ({
      event_name: "Event",
      event_date: "Date",
      age_group: "Age Group",
      weight_class: "Weight",
      created_at: "Created",
    }),
    []
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white flex justify-center py-16 px-4">
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl shadow-lg p-8 max-w-6xl w-full">
        <div className="mb-4">
          <Link href="/parent" className="text-slate-300 hover:underline">
            ← Back to dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6 text-center">Event Interests</h1>

        {/* ------ Filters / Sorting controls ------ */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6 items-end">
          <div className="md:col-span-2">
            <label className="mb-1 text-sm font-medium text-slate-300">Event name</label>
            <input
              className="w-full p-2 rounded bg-slate-800 border border-slate-700"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., duals"
            />
          </div>

          <div>
            <label className="mb-1 text-sm font-medium text-slate-300">Age group</label>
            <input
              className="w-full p-2 rounded bg-slate-800 border border-slate-700"
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              placeholder="e.g., 12U, Girls HS"
            />
          </div>

          {/* Hide this whole block if you didn't add parent_ok/coach_ok columns yet */}
          <div>
            <label className="mb-1 text-sm font-medium text-slate-300">Confirmed by</label>
            <select
              className="w-full p-2 rounded bg-slate-800 border border-slate-700"
              value={onlyOk}
              onChange={(e) => setOnlyOk(e.target.value)}
            >
              <option value="">Anyone</option>
              <option value="parent">Parent</option>
              <option value="coach">Coach</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                updateUrl({
                  eventName: eventName || null,
                  ageGroup: ageGroup || null,
                  onlyOk: onlyOk || null,
                  offset: "0",
                  limit: String(limit),
                  sort: sort || null,
                });
              }}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700"
            >
              Apply
            </button>
            <button
              onClick={() => {
                setEventName("");
                setAgeGroup("");
                setOnlyOk("");
                setLimit(10);
                setSort("");
                updateUrl({
                  eventName: null,
                  ageGroup: null,
                  onlyOk: null,
                  sort: null,
                  offset: "0",
                  limit: "10",
                });
              }}
              className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700"
            >
              Clear
            </button>
          </div>
        </div>

        {/* ------ Create / Edit form ------ */}
        <form onSubmit={save} className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="flex flex-col">
            <label className="mb-1 text-sm font-medium text-slate-300">Event Name</label>
            <input
              className="p-2 rounded bg-slate-800 border border-slate-700"
              value={eventNameForm}
              onChange={(e) => setEventNameForm(e.target.value)}
              placeholder="e.g., Test Nationals"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-sm font-medium text-slate-300">Event Date</label>
            <input
              type="date"
              className="p-2 rounded bg-slate-800 border border-slate-700"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-sm font-medium text-slate-300">Weight Class</label>
            <input
              className="p-2 rounded bg-slate-800 border border-slate-700"
              value={weightClass}
              onChange={(e) => setWeightClass(e.target.value)}
              placeholder="e.g., 55"
              required
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-sm font-medium text-slate-300">Age Group</label>
            <input
              className="p-2 rounded bg-slate-800 border border-slate-700"
              value={ageGroupForm}
              onChange={(e) => setAgeGroupForm(e.target.value)}
              placeholder="e.g., K-3, 12U, Girls 8U"
              required
            />
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="mb-1 text-sm font-medium text-slate-300">Notes</label>
            <textarea
              rows={3}
              className="p-2 rounded bg-slate-800 border border-slate-700"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specifics (style, day-only, etc.)"
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            {err && (
              <p className="text-red-400 bg-red-950/30 border border-red-800 rounded px-3 py-2">
                {err}
              </p>
            )}
            {msg && (
              <p className="text-green-400 bg-green-950/30 border border-green-800 rounded px-3 py-2">
                {msg}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 transition-colors text-white font-semibold px-6 py-2 rounded-lg shadow-md"
            >
              {editingId
                ? saving
                  ? "Updating…"
                  : "Update Interest"
                : saving
                ? "Saving…"
                : "Add Interest"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <hr className="border-slate-700 mb-4" />

        {/* ------ List ------ */}
        <h2 className="text-xl font-semibold mb-3">Saved Interests</h2>

        {/* Page size + pager */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-300">Rows per page</span>
            <select
              value={limit}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLimit(v);
                updateUrl({ limit: String(v), offset: "0" });
              }}
              className="rounded border border-slate-700 bg-slate-800 px-2 py-1"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-slate-400">
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
              onClick={() =>
                updateUrl({ offset: String(Math.max(0, page.offset - page.limit)) })
              }
              className={`rounded px-3 py-2 border border-slate-700 bg-slate-800 text-sm ${
                canPrev ? "" : "opacity-40 cursor-not-allowed"
              }`}
            >
              Prev
            </button>
            <button
              disabled={!canNext}
              onClick={() => updateUrl({ offset: String(page.offset + page.limit) })}
              className={`rounded px-3 py-2 border border-slate-700 bg-slate-800 text-sm ${
                canNext ? "" : "opacity-40 cursor-not-allowed"
              }`}
            >
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-slate-400">No interests found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-700 rounded-lg overflow-hidden">
              <thead className="bg-slate-800/70 text-slate-300">
                <tr>
                  <Th
                    label={sortableCols.event_name}
                    col="event_name"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <Th
                    label={sortableCols.event_date}
                    col="event_date"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <Th
                    label={sortableCols.weight_class}
                    col="weight_class"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <Th
                    label={sortableCols.age_group}
                    col="age_group"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  {/* Hide the next two <th> if you don't have parent_ok/coach_ok columns */}
                  <th className="text-left px-3 py-2">Parent ✓</th>
                  <th className="text-left px-3 py-2">Coach ✓</th>
                  <Th
                    label={sortableCols.created_at}
                    col="created_at"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <th className="text-left px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const showConfirmButtons =
                    r.matchId &&
                    r.coachOk &&
                    !r.parentOk &&
                    (r.matchStatus === null ||
                      r.matchStatus === undefined ||
                      r.matchStatus === "pending");

                  const isActionLoading =
                    actionLoadingId !== null && actionLoadingId === r.matchId;

                  return (
                    <tr key={r.id} className="border-t border-slate-700">
                      <td className="px-3 py-2">{r.eventName || "—"}</td>
                      <td className="px-3 py-2">{fmtDate(r.eventDate)}</td>
                      <td className="px-3 py-2">{r.weightClass || "—"}</td>
                      <td className="px-3 py-2">{r.ageGroup ?? "—"}</td>
                      {/* Hide these if columns don't exist */}
                      <td className="px-3 py-2">
                        {r.parentOk ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2">{r.coachOk ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2 items-center">
                          <button
                            onClick={() => startEdit(r)}
                            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => remove(r.id)}
                            className="px-2 py-1 rounded bg-red-600 hover:bg-red-500"
                          >
                            Delete
                          </button>

                          <Link
                            href={`/parent/wrestlers/${wrestlerId}/interests/${r.id}/matches`}
                            className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500"
                          >
                            Matches
                          </Link>

                          {/* ✅ Confirm / Reject buttons when coach has requested match */}
                          {showConfirmButtons && (
                            <>
                              <button
                                disabled={isActionLoading}
                                onClick={() => r.matchId && confirmMatch(r.matchId)}
                                className="px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60"
                              >
                                {isActionLoading ? "Confirming…" : "Confirm Match"}
                              </button>
                              <button
                                disabled={isActionLoading}
                                onClick={() => r.matchId && rejectMatch(r.matchId)}
                                className="px-2 py-1 rounded bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
                              >
                                {isActionLoading ? "Rejecting…" : "Reject"}
                              </button>
                            </>
                          )}
                        </div>

                        {showConfirmButtons && (
                          <div className="mt-1 text-xs text-slate-400">
                            Coach has requested this match. Confirm to lock it in.
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
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
  onSort: (c: string) => void;
}) {
  const [curCol, curDir = ""] = (sort || ":").split(":");
  const active = curCol === col;
  const arrow = !active ? "" : curDir.toLowerCase() === "asc" ? "▲" : "▼";
  return (
    <th
      className="text-left px-3 py-2 select-none cursor-pointer"
      onClick={() => onSort(col)}
      title={active ? `Sorted ${curDir}` : "Click to sort"}
    >
      <span className="inline-flex items-center gap-1">
        {label} {arrow && <span className="text-xs">{arrow}</span>}
      </span>
    </th>
  );
}
