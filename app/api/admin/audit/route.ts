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
  // Postgres undefined_table
  return String(err?.code) === "42P01";
}

function getSuperAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    return NextResponse.json(
      { ok: false, message: "Not signed in" },
      { status: 401 }
    );
  }

  const role = (session.user as any)?.role;
  if (role !== "Admin") {
    return NextResponse.json(
      { ok: false, message: "Access denied" },
      { status: 403 }
    );
  }

  // ✅ Super Admin gate: ONLY allow the allowlisted emails to read audit log
  const email = String((session.user as any)?.email ?? "")
    .trim()
    .toLowerCase();

  const superAdmins = getSuperAdminEmails();

  // If SUPER_ADMIN_EMAILS isn't set, default to deny (safer)
  if (!superAdmins.length || !superAdmins.includes(email)) {
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
      select
        l.id,
        l.admin_user_id,
        u.email as admin_email,
        u.firstname as admin_firstname,
        u.lastname as admin_lastname,
        l.action,
        l.entity_type,
        l.entity_id,
        l.metadata,
        l.ip,
        l.user_agent,
        l.created_at
      from public.admin_audit_log l
      left join public.users u on u.id = l.admin_user_id
      order by l.created_at desc
      limit $1
      `,
      [limit]
    );

    // ✅ Intentionally DO NOT log "view_admin_activity_feed"
    // This endpoint is the audit feed itself; logging it creates spam and hides real actions.
    return NextResponse.json({ ok: true, items: rows });
  } catch (err: any) {
    if (isMissingTableError(err)) {
      // Table not created yet → return empty feed instead of 500
      return NextResponse.json({
        ok: true,
        items: [],
        warning: "admin_audit_log_missing",
      });
    }

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