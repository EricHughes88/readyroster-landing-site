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

type SessionUser = {
  id?: string | number;
  email?: string | null;
  role?: string | null;
  name?: string | null;
  isSuperAdmin?: boolean;
};

function safeStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

function normalizeRole(r: any) {
  const s = safeStr(r).trim();
  return s || "Parent";
}

function isAllowedSuperAdmin(user: SessionUser | null) {
  const email = String(user?.email ?? "").trim().toLowerCase();
  const superEmails = [
    "eric@nuwaycombat.com",
    "brittaustin1031@gmail.com",
  ];

  return Boolean(user?.isSuperAdmin) || superEmails.includes(email);
}

type RoleFilter =
  | "All"
  | "Super Admin"
  | "Admin"
  | "Coach"
  | "Parent"
  | "Athlete";

export default function AdminsManagerPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  async function fetchSessionUser(): Promise<SessionUser | null> {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return (data?.user as SessionUser) ?? null;
    } catch {
      return null;
    }
  }

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

      const list = Array.isArray(data.rows)
        ? data.rows
        : Array.isArray(data.users)
        ? data.users
        : [];

      setRows(list);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const user = await fetchSessionUser();
      if (cancelled) return;

      setSessionUser(user);

      const canView = isAllowedSuperAdmin(user);
      setAllowed(canView);

      if (!canView) {
        setLoading(false);
        setErr("Access denied");
        return;
      }

      await load();
    }

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (allowed) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const base =
      roleFilter === "All"
        ? rows
        : rows.filter((r) => normalizeRole(r.role) === roleFilter);

    if (!qq) return base;

    return base.filter((r) => {
      const name = `${safeStr(r.firstname)} ${safeStr(r.lastname)}`.toLowerCase();
      const email = safeStr(r.email).toLowerCase();
      const role = normalizeRole(r.role).toLowerCase();
      return name.includes(qq) || email.includes(qq) || role.includes(qq);
    });
  }, [rows, q, roleFilter]);

  async function setRole(userId: number, role: "Super Admin" | "Admin" | "Parent") {
    if (!confirm(`Set user #${userId} role to "${role}"?`)) return;

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

  const dangerBtn: React.CSSProperties = {
    ...btn,
    background: "#111827",
  };

  return (
    <main style={{ padding: 20 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", marginBottom: 12 }}>
        <Link
          href={"/admin" as Route}
          style={{ color: "#cbd5e1", textDecoration: "underline" }}
        >
          ← Back to Admin
        </Link>
      </div>

      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1
                style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#fff" }}
              >
                Admin Management
              </h1>

              {allowed ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    border: "1px solid #166534",
                    background: "rgba(20,83,45,0.25)",
                    color: "#86efac",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  Super Admin
                </span>
              ) : null}
            </div>

            <p style={{ marginTop: 6, color: "#94a3b8" }}>
              Promote/demote users without SQL. Only Super Admin can use these
              actions.
            </p>

            {sessionUser?.email ? (
              <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                Signed in as {sessionUser.email}
              </div>
            ) : null}
          </div>

          {allowed ? (
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
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
                <option value="Super Admin">Super Admin</option>
                <option value="Admin">Admin</option>
                <option value="Coach">Coach</option>
                <option value="Parent">Parent</option>
                <option value="Athlete">Athlete</option>
              </select>

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, or role…"
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
          ) : null}
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

        {!loading && allowed === false ? (
          <div style={{ marginTop: 12, color: "#94a3b8", fontSize: 14 }}>
            You do not have permission to view this page.
          </div>
        ) : (
          <>
            <div style={{ marginTop: 12, color: "#94a3b8", fontSize: 12 }}>
              {loading ? "Loading…" : `${filtered.length} user(s)`}
            </div>

            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
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
                    const name =
                      `${safeStr(u.firstname)} ${safeStr(u.lastname)}`.trim() ||
                      "(no name)";
                    const role = normalizeRole(u.role);

                    return (
                      <tr key={u.id} style={{ borderTop: "1px solid #334155" }}>
                        <td
                          style={{
                            padding: "10px 12px",
                            color: "#fff",
                            fontWeight: 700,
                          }}
                        >
                          {name}
                        </td>
                        <td style={{ padding: "10px 12px" }}>{safeStr(u.email)}</td>
                        <td style={{ padding: "10px 12px" }}>{role}</td>
                        <td style={{ padding: "10px 12px" }}>
                          {u.created_at
                            ? new Date(u.created_at).toLocaleString()
                            : ""}
                        </td>

                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {role !== "Super Admin" ? (
                              <button
                                onClick={() => setRole(u.id, "Super Admin")}
                                style={btn}
                              >
                                Make Super Admin
                              </button>
                            ) : (
                              <button
                                onClick={() => setRole(u.id, "Admin")}
                                style={dangerBtn}
                              >
                                Remove Super (→ Admin)
                              </button>
                            )}

                            {role === "Admin" || role === "Super Admin" ? (
                              <button
                                onClick={() => setRole(u.id, "Parent")}
                                style={dangerBtn}
                              >
                                Remove Admin
                              </button>
                            ) : (
                              <button
                                onClick={() => setRole(u.id, "Admin")}
                                style={btn}
                              >
                                Make Admin
                              </button>
                            )}
                          </div>
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
              Notes:
              <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 18 }}>
                <li>
                  This page calls <code>/api/admin/users</code> to list users and{" "}
                  <code>/api/admin/users/role</code> (PATCH) to update roles.
                </li>
                <li>
                  Your API enforces Super Admin via <code>SUPER_ADMIN_EMAILS</code>,
                  so the buttons are safe even if someone finds the URL.
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </main>
  );
}