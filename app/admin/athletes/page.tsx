// app/admin/athletes/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AthleteRow = {
  id: number;

  // common variants (your API may return any of these)
  firstname?: string | null;
  lastname?: string | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;

  email?: string | null;

  role?: string | null;
  city?: string | null;
  state?: string | null;

  event_name?: string | null;
  age_group?: string | null;
  weight_class?: string | null;

  created_at?: string | null;
};

type AthletesApiResponse = {
  ok: boolean;
  athletes?: AthleteRow[];
  rows?: AthleteRow[];
  data?: AthleteRow[];
  message?: string;
};

function pickArray<T>(obj: any, keys: string[]): T[] {
  for (const k of keys) {
    if (Array.isArray(obj?.[k])) return obj[k] as T[];
  }
  return [];
}

function safe(v: any) {
  return (v ?? "").toString();
}

/**
 * Best-effort field getter for multiple naming conventions:
 * - firstname / lastname
 * - first_name / last_name
 * - firstName / lastName
 */
function getFirstName(a: AthleteRow) {
  return (
    a.firstname ??
    a.first_name ??
    a.firstName ??
    a["First Name"] ??
    a["first name"] ??
    null
  );
}

function getLastName(a: AthleteRow) {
  return (
    a.lastname ??
    a.last_name ??
    a.lastName ??
    a["Last Name"] ??
    a["last name"] ??
    null
  );
}

function fullName(a: AthleteRow) {
  const fn = safe(getFirstName(a)).trim();
  const ln = safe(getLastName(a)).trim();
  const name = `${fn} ${ln}`.trim();
  return name || "(no name)";
}

function normState(a: AthleteRow) {
  return safe(a.state).trim().toUpperCase();
}

function toCsvValue(v: any) {
  const s = safe(v);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function downloadCsv(filename: string, rows: AthleteRow[]) {
  const header = [
    "id",
    "first_name",
    "last_name",
    "email",
    "role",
    "city",
    "state",
    "event_name",
    "age_group",
    "weight_class",
    "created_at",
  ];

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.id,
        getFirstName(r),
        getLastName(r),
        r.email,
        r.role,
        r.city,
        normState(r),
        r.event_name,
        r.age_group,
        r.weight_class,
        r.created_at,
      ]
        .map(toCsvValue)
        .join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export default function AdminAthletesPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [athletes, setAthletes] = useState<AthleteRow[]>([]);

  // filters
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        // EXPECTED API:
        // GET /api/admin/athletes -> { ok: true, athletes|rows|data: AthleteRow[] }
        const res = await fetch("/api/admin/athletes", { cache: "no-store" });
        const json: AthletesApiResponse = await res.json();

        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || "Failed to load athletes");
        }

        if (cancelled) return;

        const rows = pickArray<AthleteRow>(json, ["athletes", "rows", "data"]);
        setAthletes(rows);
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const states = useMemo(() => {
    const set = new Set<string>();
    for (const a of athletes) {
      const st = normState(a);
      if (st) set.add(st);
    }
    return ["ALL", ...Array.from(set).sort()];
  }, [athletes]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    for (const a of athletes) {
      const r = safe(a.role).trim();
      if (r) set.add(r);
    }
    return ["ALL", ...Array.from(set).sort()];
  }, [athletes]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return athletes.filter((a) => {
      const name = fullName(a).toLowerCase();
      const email = safe(a.email).toLowerCase();
      const city = safe(a.city).toLowerCase();
      const st = normState(a);
      const role = safe(a.role).trim();

      const matchesQuery =
        !query ||
        name.includes(query) ||
        email.includes(query) ||
        city.includes(query) ||
        st.toLowerCase().includes(query) ||
        safe(a.event_name).toLowerCase().includes(query) ||
        safe(a.age_group).toLowerCase().includes(query) ||
        safe(a.weight_class).toLowerCase().includes(query);

      const matchesState = stateFilter === "ALL" || st === stateFilter;
      const matchesRole = roleFilter === "ALL" || role === roleFilter;

      return matchesQuery && matchesState && matchesRole;
    });
  }, [athletes, q, stateFilter, roleFilter]);

  return (
    <main
      style={{
        padding: 20,
        maxWidth: 1200,
        margin: "0 auto",
        color: "#e5e7eb",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{ fontSize: 30, fontWeight: 900, margin: 0, color: "#fff" }}
          >
            Athletes Database
          </h1>
          <p style={{ marginTop: 6, color: "#94a3b8" }}>
            Search, filter by state, and export athlete rows.
          </p>
        </div>

        {/* Right side actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={"/admin" as any}
            style={{
              border: "1px solid #334155",
              background: "#0b1220",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            ← Admin Dashboard
          </Link>

          <Link
            href={"/admin/coaches" as any}
            style={{
              border: "1px solid #334155",
              background: "#0b1220",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Coaches DB →
          </Link>

          <button
            onClick={() =>
              downloadCsv(`readyroster_athletes_${Date.now()}.csv`, filtered)
            }
            disabled={loading || filtered.length === 0}
            style={{
              border: "1px solid #334155",
              background: filtered.length ? "#111827" : "#0b1220",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 10,
              fontWeight: 800,
              cursor:
                loading || filtered.length === 0 ? "not-allowed" : "pointer",
              opacity: loading || filtered.length === 0 ? 0.6 : 1,
            }}
          >
            Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      {err && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #f99",
            borderRadius: 10,
            background: "#fff5f5",
            color: "#111",
          }}
        >
          <b>Error:</b> {err}
          <div style={{ marginTop: 6, fontSize: 13 }}>
            If you don’t have <code>/api/admin/athletes</code> yet, tell me and
            I’ll send that route next.
          </div>
        </div>
      )}

      {/* Filters */}
      <section
        style={{
          marginTop: 14,
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 12,
          background: "rgba(2,6,23,0.35)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 0.7fr 0.7fr auto",
            gap: 10,
            alignItems: "center",
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, city, state, event, age group, weight class…"
            style={{
              width: "100%",
              border: "1px solid #334155",
              background: "#0b1220",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: 10,
              outline: "none",
            }}
          />

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={{
              border: "1px solid #334155",
              background: "#0b1220",
              color: "#fff",
              padding: "10px 10px",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            {states.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All states" : s}
              </option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              border: "1px solid #334155",
              background: "#0b1220",
              color: "#fff",
              padding: "10px 10px",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r === "ALL" ? "All roles" : r}
              </option>
            ))}
          </select>

          <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "right" }}>
            {loading ? "Loading…" : `${filtered.length} shown / ${athletes.length} total`}
          </div>
        </div>
      </section>

      {/* Table */}
      <section
        style={{
          marginTop: 14,
          border: "1px solid #334155",
          borderRadius: 12,
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#94a3b8" }}>
              <th style={{ padding: "10px 12px" }}>Name</th>
              <th style={{ padding: "10px 12px" }}>Email</th>
              <th style={{ padding: "10px 12px" }}>City</th>
              <th style={{ padding: "10px 12px" }}>State</th>
              <th style={{ padding: "10px 12px" }}>Event</th>
              <th style={{ padding: "10px 12px" }}>Age</th>
              <th style={{ padding: "10px 12px" }}>Weight</th>
              <th style={{ padding: "10px 12px" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((a, idx) => (
              <tr
                key={`${a.id}-${idx}`}
                style={{ borderTop: "1px solid #334155" }}
              >
                <td
                  style={{
                    padding: "10px 12px",
                    color: "#fff",
                    fontWeight: 800,
                  }}
                >
                  {fullName(a)}
                </td>
                <td style={{ padding: "10px 12px" }}>{a.email ?? ""}</td>
                <td style={{ padding: "10px 12px" }}>{a.city ?? ""}</td>
                <td style={{ padding: "10px 12px" }}>{normState(a)}</td>
                <td style={{ padding: "10px 12px" }}>{a.event_name ?? ""}</td>
                <td style={{ padding: "10px 12px" }}>{a.age_group ?? ""}</td>
                <td style={{ padding: "10px 12px" }}>{a.weight_class ?? ""}</td>
                <td style={{ padding: "10px 12px" }}>
                  <Link
                    href={(`/admin/athletes/${a.id}` as any)}
                    style={{
                      border: "1px solid #334155",
                      background: "#0b1220",
                      color: "#fff",
                      padding: "6px 10px",
                      borderRadius: 10,
                      textDecoration: "none",
                      fontWeight: 800,
                      display: "inline-block",
                    }}
                  >
                    Open profile
                  </Link>
                </td>
              </tr>
            ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 12, color: "#94a3b8" }}>
                  No athletes match your filters.
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={8} style={{ padding: 12, color: "#94a3b8" }}>
                  Loading athletes…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}