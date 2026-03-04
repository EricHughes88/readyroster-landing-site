// app/admin/(super)/admins/page.tsx
"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";

type UserRow = {
  id: number;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  role: string | null;
  created_at: string | null;
};

function safeStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

export default function AdminsManagerPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All" | "Admin" | "Coach" | "Parent" | "Athlete">(
    "All"
  );

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (roleFilter !== "All") params.set("role", roleFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to load users");
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
  }, [roleFilter]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) => {
      const name = `${safeStr(r.firstname)} ${safeStr(r.lastname)}`.toLowerCase();
      const email = safeStr(r.email).toLowerCase();
      return name.includes(qq) || email.includes(qq);
    });
  }, [rows, q]);

  async function setRole(userId: number, role: "Admin" | "Parent") {
    if (!confirm(`Set user #${userId} role to ${role}?`)) return;

    try {
      const res = await fetch("/api/admin/users/role", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to update role");
      }

      await load();
    } catch (e: any) {
      alert(String(e?.message ?? e));
    }
  }

  const card: React.CSSProperties = {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 18,
    borderRadius: 16,
    border: "1px solid rgba(51,65,85,0.8)",
    background: "rgba(2,6,23,0.35)",
    color: "#e5e7eb",
  };

  const btn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 10,
    textDecoration: "none",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
    minHeight: 36,
  };

  return (
    <main style={{ padding: 20 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", marginBottom: 12 }}>
        <Link href={"/admin" as Route} style={{ color: "#cbd5e1", textDecoration: "underline" }}>
          ← Back to Admin
        </Link>
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#fff" }}>
              Manage Admins (Super Admin)
            </h1>
            <p style={{ marginTop: 6, color: "#94a3b8" }}>
              Promote/demote Admin access (Super Admin stays controlled by SUPER_ADMIN_EMAILS).
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              style={{
                border: "1px solid #334155",
                background: "#0b1220",
                color: "#fff",
                padding: "8px 10px",
                borderRadius: 10,
                cursor: "pointer",
                minHeight: 36,
              }}
            >
              <option value="All">All roles</option>
              <option value="Admin">Admin</option>
              <option value="Coach">Coach</option>
              <option value="Parent">Parent</option>
              <option value="Athlete">Athlete</option>
            </select>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or email…"
              style={{
                border: "1px solid #334155",
                background: "#0b1220",
                color: "#fff",
                padding: "8px 10px",
                borderRadius: 10,
                minHeight: 36,
                width: 260,
              }}
            />

            <button onClick={load} style={btn}>
              Refresh
            </button>
          </div>
        </div>

        {err && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #f99",
              borderRadius: 10,
              background: "#fff5f5",
              color: "#111",
            }}
          >
            <b>Error:</b> {err}
          </div>
        )}

        <div style={{ marginTop: 12, color: "#94a3b8", fontSize: 12 }}>
          {loading ? "Loading…" : `${filtered.length} user(s)`}
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "10px 12px" }}>Name</th>
                <th style={{ padding: "10px 12px" }}>Email</th>
                <th style={{ padding: "10px 12px" }}>Role</th>
                <th style={{ padding: "10px 12px" }}>Created</th>
                <th style={{ padding: "10px 12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const name = `${safeStr(u.firstname)} ${safeStr(u.lastname)}`.trim() || "(no name)";
                const role = safeStr(u.role) || "Parent";
                return (
                  <tr key={u.id} style={{ borderTop: "1px solid #334155" }}>
                    <td style={{ padding: "10px 12px", color: "#fff", fontWeight: 700 }}>{name}</td>
                    <td style={{ padding: "10px 12px" }}>{safeStr(u.email)}</td>
                    <td style={{ padding: "10px 12px" }}>{role}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {u.created_at ? new Date(u.created_at).toLocaleString() : ""}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {role === "Admin" ? (
                        <button
                          onClick={() => setRole(u.id, "Parent")}
                          style={{ ...btn, background: "#111827" }}
                        >
                          Remove Admin
                        </button>
                      ) : (
                        <button onClick={() => setRole(u.id, "Admin")} style={btn}>
                          Make Admin
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 12, color: "#94a3b8" }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, color: "#94a3b8", fontSize: 12 }}>
          Tip: Add a Super Admin link on your dashboard only for you (we can do that after you test).
        </div>
      </div>
    </main>
  );
}