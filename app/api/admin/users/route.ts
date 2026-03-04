// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

function getSuperEmails() {
  return String(process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireSuperAdmin() {
  const session = await getServerSession(authConfig as any);
  const email = String((session as any)?.user?.email ?? "").trim().toLowerCase();
  const supers = getSuperEmails();
  if (!email || supers.length === 0 || !supers.includes(email)) {
    return { ok: false as const, email };
  }
  return { ok: true as const, email };
}

const ALLOWED_ROLE_FILTERS = ["Super Admin", "Admin", "Coach", "Parent", "Athlete"] as const;
type RoleFilter = (typeof ALLOWED_ROLE_FILTERS)[number];

function normalizeRoleFilter(v: string | null): RoleFilter | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return (ALLOWED_ROLE_FILTERS as readonly string[]).includes(s) ? (s as RoleFilter) : null;
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireSuperAdmin();
    if (!gate.ok) return jsonError("Forbidden", 403);

    const url = new URL(req.url);

    const qRaw = (url.searchParams.get("q") || "").trim().toLowerCase();
    const roleRaw = normalizeRoleFilter(url.searchParams.get("role")); // "Admin" | "Super Admin" | ...
    const limitRaw = Number(url.searchParams.get("limit") || 200);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 200;

    // Build WHERE dynamically but safely (parameterized)
    const where: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (qRaw) {
      where.push(`
        (
          LOWER(COALESCE(email,'')) LIKE $${p}
          OR LOWER(COALESCE(firstname,'')) LIKE $${p}
          OR LOWER(COALESCE(lastname,'')) LIKE $${p}
        )
      `);
      params.push(`%${qRaw}%`);
      p += 1;
    }

    if (roleRaw) {
      where.push(`COALESCE(role,'Parent') = $${p}`);
      params.push(roleRaw);
      p += 1;
    }

    params.push(limit);

    const sql = `
      SELECT id, email, firstname, lastname, role, created_at
      FROM public.users
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC NULLS LAST
      LIMIT $${p}
    `;

    const res = await pool.query(sql, params);

    const users = Array.isArray(res.rows) ? res.rows : [];

    // Return under multiple keys so any existing UI won't break
    return NextResponse.json({
      ok: true,
      users,
      rows: users,
      count: users.length,
      limit,
      role: roleRaw ?? null,
      q: qRaw || "",
    });
  } catch (e: any) {
    console.error("[admin/users] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}