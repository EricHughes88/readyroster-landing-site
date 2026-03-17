// app/admin/(protected)/coaches/page.tsx
"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type CoachesApiResponse = {
  ok: boolean;
  rows?: CoachRow[];
  message?: string;
  details?: any;
};

function safeStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

function uniqUpper(xs: (string | null | undefined)[]) {
  const s = new Set<string>();
  for (const x of xs) {
    const v = String(x ?? "").trim().toUpperCase();
    if (v) s.add(v);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

function displayName(r: CoachRow) {
  const n = [r.firstname, r.lastname].filter(Boolean).join(" ").trim();
  return n || r.coach_name || `Coach #${r.id}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function AdminCoachesPage() {
  const [rows, setRows] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [stateFilter, setStateFilter] = useState<string>("All");
  const [q, setQ] = useState<string>("");

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const params = new URLSearchParams();

      if (stateFilter && stateFilter !== "All") {
        params.set("state", stateFilter);
      }

      const qs = params.toString() ? `?${params.toString()}` : "";

      const res = await fetch(`/api/admin/coaches${qs}`, { cache: "no-store" });
      const data: CoachesApiResponse = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to load coaches");
      }

      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateFilter]);

  const states = useMemo(() => {
    const list = uniqUpper(rows.map((r) => r.state));
    return ["All", ...list];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((r) => {
      const hay = [
        displayName(r),
        r.email,
        r.phone,
        r.teamname,
        r.coach_name,
        r.city,
        r.state,
      ]
        .map((x) => safeStr(x).toLowerCase())
        .join(" | ");

      return hay.includes(needle);
    });
  }, [rows, q]);

  function downloadCoachesCsv() {
    const params = new URLSearchParams();

    if (stateFilter && stateFilter !== "All") {
      params.set("state", stateFilter);
    }

    const qs = params.toString() ? `?${params.toString()}` : "";
    window.location.href = `/api/admin/coaches/export${qs}`;
  }

  return (
    <main
      style={{
        padding: 20,
        maxWidth: 1400,
        margin: "0 auto",
        color: "#e5e7eb",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <Link
          href={"/admin" as Route}
          className="text-sm text-slate-400 hover:text-white underline"
        >
          ← Back to Admin
        </Link>

        <div
          style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
        >
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="rr-input"
            style={{ maxWidth: 180 }}
          >
            {states.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All states" : s}
              </option>
            ))}
          </select>

          <input
            className="rr-input"
            placeholder="Search name, email, team, city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 320, maxWidth: "60vw" }}
          />

          <button
            type="button"
            className="rr-btn rr-btn-primary"
            onClick={downloadCoachesCsv}
            disabled={loading}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="rr-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 className="text-2xl font-semibold mb-2">Coaches DB</h1>
            <p className="text-slate-300">
              View coaches and team details. Filter by state, search, and export.
            </p>
          </div>

          <div className="text-sm text-slate-400" style={{ alignSelf: "flex-end" }}>
            {loading ? "Loading…" : `${filtered.length} coach records`}
          </div>
        </div>

        {err ? <div className="rr-alert rr-alert-error mt-4">{err}</div> : null}

        <div className="mt-4 overflow-auto border border-slate-800 rounded-lg">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-slate-950/40 text-slate-300">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-left p-3">Team</th>
                <th className="text-left p-3">City</th>
                <th className="text-left p-3">State</th>
                <th className="text-left p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="p-3 text-white font-semibold">
                    <Link
                      href={`/admin/coaches/${r.id}` as Route}
                      className="hover:underline"
                      style={{ color: "#fff", textUnderlineOffset: 2 }}
                    >
                      {displayName(r)}
                    </Link>
                  </td>
                  <td className="p-3 text-slate-200">{safeStr(r.email)}</td>
                  <td className="p-3 text-slate-200">{safeStr(r.phone)}</td>
                  <td className="p-3 text-slate-200">{safeStr(r.teamname)}</td>
                  <td className="p-3 text-slate-200">{safeStr(r.city)}</td>
                  <td className="p-3 text-slate-200">{safeStr(r.state)}</td>
                  <td className="p-3 text-slate-400">{formatDateTime(r.created_at)}</td>
                </tr>
              ))}

              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-3 text-slate-400">
                    No coaches found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}