// app/api/admin/coaches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { logAdminEvent } from "@/lib/adminAudit";
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
  const session = (await getServerSession(authConfig as any)) as any;

  if (!session?.user) {
    return jsonError("Not signed in", 401);
  }

  // TEMP RESET: allow any signed-in user so we can test the data/API
  const adminUserId = Number(session.user?.id ?? 0);

  const pool = getPool();

  try {
    const url = new URL(req.url);
    const stateRaw = (url.searchParams.get("state") || "").trim();
    const qRaw = (url.searchParams.get("q") || "").trim();

    const params: any[] = [];
    const where: string[] = [];

    if (stateRaw && stateRaw.toUpperCase() !== "ALL") {
      params.push(stateRaw);
      where.push(`UPPER(TRIM(state)) = UPPER(TRIM($${params.length}))`);
    }

    if (qRaw) {
      params.push(`%${qRaw}%`);
      const p = `$${params.length}`;

      where.push(`(
        COALESCE(firstname, '') ILIKE ${p} OR
        COALESCE(lastname, '') ILIKE ${p} OR
        COALESCE(email, '') ILIKE ${p} OR
        COALESCE(phone, '') ILIKE ${p} OR
        COALESCE(teamname, '') ILIKE ${p} OR
        COALESCE(coach_name, '') ILIKE ${p} OR
        COALESCE(city, '') ILIKE ${p} OR
        COALESCE(state, '') ILIKE ${p}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT *
      FROM public.admin_coaches_directory
      ${whereSql}
      ORDER BY lastname NULLS LAST, firstname NULLS LAST
      LIMIT 1000;
    `;

    const res = await pool.query(sql, params);
    const rows = Array.isArray(res.rows) ? res.rows : [];

    if (Number.isFinite(adminUserId) && adminUserId > 0) {
      try {
        await logAdminEvent({
          adminUserId,
          action: "view_admin_coaches",
          entityType: "coach",
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
      } catch {
        // ignore audit issues
      }
    }

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    console.error("[admin/coaches] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}