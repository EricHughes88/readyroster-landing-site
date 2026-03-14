import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __RR_COACH_MATCH_ALERTS_POOL__: Pool | undefined;
}

function getPool(): Pool | null {
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;

  if (!global.__RR_COACH_MATCH_ALERTS_POOL__) {
    global.__RR_COACH_MATCH_ALERTS_POOL__ = new Pool({
      connectionString: conn,
    });
  }

  return global.__RR_COACH_MATCH_ALERTS_POOL__;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, message, alerts: [] }, { status });
}

export async function GET() {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user?.id) {
      return jsonError("Unauthorized", 401);
    }

    const coachUserId = Number(session.user.id);
    if (!Number.isFinite(coachUserId) || coachUserId <= 0) {
      return jsonError("Invalid coach user", 400);
    }

    const pool = getPool();
    if (!pool) {
      return jsonError("Database not configured", 500);
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        `
        SELECT
          m.id AS match_id,
          m.created_at,
          m.status,

          cn.id AS coach_need_id,
          cn.event_name,
          cn.weight_class,
          cn.age_group,

          a.athleteid AS wrestler_id,
          a.firstname,
          a.lastname,
          a.city,
          a.state

        FROM public.matches m
        INNER JOIN public.coach_needs cn
          ON cn.id = m.coach_need_id
        INNER JOIN public.wrestler_interests wi
          ON wi.id = m.wrestler_interest_id
        INNER JOIN public.athletes a
          ON a.athleteid = wi.wrestler_id

        WHERE cn.coach_user_id = $1
        AND m.created_at >= NOW() - interval '7 days'

        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 10
        `,
        [coachUserId]
      );

      return NextResponse.json({
        ok: true,
        alerts: result.rows ?? [],
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("GET /api/coach/match-alerts error:", error);
    return jsonError("Failed to load match alerts", 500);
  }
}