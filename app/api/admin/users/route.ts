// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __RR_PG_POOL__: pg.Pool | undefined;
}
const { Pool } = pg;

function getPool(): pg.Pool {
  const conn = process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL not set");
  if (!global.__RR_PG_POOL__) global.__RR_PG_POOL__ = new Pool({ connectionString: conn });
  return global.__RR_PG_POOL__;
}

function getSuperAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS || "";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    return NextResponse.json({ ok: false, message: "Not signed in" }, { status: 401 });
  }
  const role = (session.user as any)?.role;
  if (role !== "Admin") {
    return NextResponse.json({ ok: false, message: "Access denied" }, { status: 403 });
  }

  // ✅ Super Admin only
  const email = String((session.user as any)?.email ?? "").trim().toLowerCase();
  const supers = getSuperAdminEmails();
  if (!supers.length || !supers.includes(email)) {
    return NextResponse.json({ ok: false, message: "Access denied" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const roleFilter = (url.searchParams.get("role") || "").trim();

  const params: any[] = [];
  const where: string[] = [];

  if (roleFilter) {
    params.push(roleFilter);
    where.push(`LOWER(COALESCE(role,'')) = LOWER($${params.length})`);
  }

  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    where.push(`(
      COALESCE(email,'') ILIKE ${p} OR
      COALESCE(firstname,'') ILIKE ${p} OR
      COALESCE(lastname,'') ILIKE ${p}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const pool = getPool();
  const { rows } = await pool.query(
    `
    SELECT id, email, firstname, lastname, role, created_at
    FROM public.users
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT 500
    `,
    params
  );

  return NextResponse.json({ ok: true, rows });
}