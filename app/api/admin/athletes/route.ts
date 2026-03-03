// app/api/admin/athletes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { logAdminEvent } from "@/lib/adminAudit";
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

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

function getIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

export async function GET(req: NextRequest) {
  // ✅ Require Admin
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    return jsonError("Not signed in", 401);
  }

  const role = (session.user as any)?.role;
  if (role !== "Admin") {
    // optional: log denied attempts (keeps you aware)
    try {
      const who = Number((session.user as any)?.id);
      if (Number.isFinite(who)) {
        await logAdminEvent({
          adminUserId: who,
          action: "admin_access_denied_athletes",
          metadata: { path: "/api/admin/athletes" },
          ip: getIp(req),
          userAgent: req.headers.get("user-agent"),
        });
      }
    } catch {
      // ignore
    }

    return jsonError("Access denied", 403);
  }

  const adminUserId = Number((session.user as any)?.id);
  if (!Number.isFinite(adminUserId)) {
    return jsonError("Invalid session user id", 400);
  }

  const pool = getPool();

  try {
    const url = new URL(req.url);
    const stateRaw = (url.searchParams.get("state") || "").trim();
    const qRaw = (url.searchParams.get("q") || "").trim();

    const params: any[] = [];
    const where: string[] = [];

    // State filter (treat "All" as no filter)
    if (stateRaw && stateRaw !== "All") {
      params.push(stateRaw);
      where.push(`UPPER(TRIM(state)) = UPPER(TRIM($${params.length}))`);
    }

    // Search filter (search across multiple text-like fields)
    if (qRaw) {
      params.push(`%${qRaw}%`);
      const p = `$${params.length}`;
      where.push(`(
        COALESCE(first_name, '') ILIKE ${p} OR
        COALESCE(last_name,  '') ILIKE ${p} OR
        COALESCE(city,       '') ILIKE ${p} OR
        COALESCE(state,      '') ILIKE ${p} OR
        COALESCE(parent_email,'') ILIKE ${p} OR
        COALESCE(parent_phone,'') ILIKE ${p}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        id,
        first_name,
        last_name,
        city,
        state,
        dob,
        parent_user_id,
        parent_email,
        parent_phone
      FROM public.admin_athletes_directory
      ${whereSql}
      ORDER BY last_name NULLS LAST, first_name NULLS LAST
      LIMIT 1000;
    `;

    const res = await pool.query(sql, params);
    const rows = Array.isArray(res.rows) ? res.rows : [];

    // ✅ Log view (this is Step 5 in action)
    await logAdminEvent({
      adminUserId,
      action: "view_admin_athletes",
      entityType: "athlete",
      metadata: {
        filters: {
          state: stateRaw || null,
          q: qRaw || null,
        },
        returnedCount: rows.length,
      },
      ip: getIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    console.error("[admin/athletes] error:", e);

    // optional: log the failure
    try {
      await logAdminEvent({
        adminUserId,
        action: "view_admin_athletes_error",
        entityType: "athlete",
        metadata: { message: String(e?.message ?? e) },
        ip: getIp(req),
        userAgent: req.headers.get("user-agent"),
      });
    } catch {
      // ignore
    }

    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}