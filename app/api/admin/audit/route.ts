// app/api/admin/audit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- PG pool singleton (avoids many pools during dev HMR) ----
declare global {
  // eslint-disable-next-line no-var
  var __RR_PG_POOL__: pg.Pool | undefined;
}

const { Pool } = pg;

function getPool(): pg.Pool {
  const conn = process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL not set");

  if (!global.__RR_PG_POOL__) {
    global.__RR_PG_POOL__ = new Pool({ connectionString: conn });
  }

  return global.__RR_PG_POOL__;
}

function isMissingTableError(err: any) {
  return String(err?.code) === "42P01";
}

function getSuperAdminEmails(): string[] {
  return String(process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedSuperAdmin(email?: string | null, isSuperAdmin?: boolean) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return false;

  const allowlisted = getSuperAdminEmails();
  return Boolean(isSuperAdmin) || allowlisted.includes(normalized);
}

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authConfig as any)) as any;

  const email = String(session?.user?.email ?? "")
    .trim()
    .toLowerCase();

  const role = String(session?.user?.role ?? "")
    .trim()
    .toLowerCase();

  const sessionIsSuperAdmin = Boolean(session?.user?.isSuperAdmin);
  const superAdmins = getSuperAdminEmails();

  console.log("AUDIT SESSION EMAIL:", email);
  console.log("AUDIT SESSION ROLE:", role);
  console.log("AUDIT SESSION isSuperAdmin:", sessionIsSuperAdmin);
  console.log("AUDIT SUPER ADMINS:", superAdmins);

  if (!email) {
    return NextResponse.json(
      { ok: false, message: "Not signed in" },
      { status: 401 }
    );
  }

  if (!isAllowedSuperAdmin(email, sessionIsSuperAdmin)) {
    return NextResponse.json(
      { ok: false, message: "Access denied" },
      { status: 403 }
    );
  }

  const pool = getPool();

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") || 50), 1),
    200
  );

  try {
    const { rows } = await pool.query(
      `
      SELECT
        l.id,
        l.admin_user_id,
        u.email AS admin_email,
        u.firstname AS admin_firstname,
        u.lastname AS admin_lastname,
        l.action,
        l.entity_type,
        l.entity_id,
        l.metadata,
        l.ip,
        l.user_agent,
        l.created_at
      FROM public.admin_audit_log l
      LEFT JOIN public.users u
        ON u.id = l.admin_user_id
      ORDER BY l.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    return NextResponse.json({
      ok: true,
      items: rows,
    });
  } catch (err: any) {
    if (isMissingTableError(err)) {
      return NextResponse.json({
        ok: true,
        items: [],
        warning: "admin_audit_log_missing",
      });
    }

    console.error("GET /api/admin/audit error:", err);

    return NextResponse.json(
      {
        ok: false,
        message: "Failed to load admin audit log",
        details: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}