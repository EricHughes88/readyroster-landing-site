// app/api/views/count/route.ts
import { NextRequest, NextResponse } from "next/server";
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
    global.__RR_PG_POOL__ = new Pool({
      connectionString: conn,
    });
  }

  return global.__RR_PG_POOL__;
}

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const targetType = String(searchParams.get("targetType") ?? "")
      .trim()
      .toLowerCase();
    const targetId = Number(searchParams.get("targetId"));

    if (!["athlete", "coach", "coach_need"].includes(targetType)) {
      return badRequest("Invalid targetType", { targetType });
    }

    if (!Number.isFinite(targetId) || targetId <= 0) {
      return badRequest("Invalid targetId", { targetId });
    }

    const pool = getPool();

    const totalRes = await pool.query(
      `
      SELECT COUNT(*)::int AS total_views
      FROM public.profile_views
      WHERE target_type = $1
        AND target_id = $2
      `,
      [targetType, targetId]
    );

    const recentRes = await pool.query(
      `
      SELECT COUNT(*)::int AS views_last_7_days
      FROM public.profile_views
      WHERE target_type = $1
        AND target_id = $2
        AND viewed_at >= NOW() - INTERVAL '7 days'
      `,
      [targetType, targetId]
    );

    return NextResponse.json({
      ok: true,
      totalViews: totalRes.rows[0]?.total_views ?? 0,
      viewsLast7Days: recentRes.rows[0]?.views_last_7_days ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        message: err?.message ?? "Failed to fetch view counts",
        pg: { code: err?.code ?? null },
      },
      { status: 500 }
    );
  }
}