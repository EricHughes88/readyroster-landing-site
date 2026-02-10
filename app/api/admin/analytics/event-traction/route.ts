import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

// Use a single PG pool (avoids many pools during dev hot reload)
declare global {
  // eslint-disable-next-line no-var
  var __RR_ADMIN_PG_POOL__: Pool | undefined;
}

function getPool(): Pool | null {
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;

  if (!global.__RR_ADMIN_PG_POOL__) {
    global.__RR_ADMIN_PG_POOL__ = new Pool({ connectionString: conn });
  }
  return global.__RR_ADMIN_PG_POOL__;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!session?.user || role !== "Admin") {
      return jsonError("Unauthorized", 401);
    }

    const url = new URL(req.url);
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 30)));
    const limit = Math.max(5, Math.min(200, Number(url.searchParams.get("limit") || 50)));

    const pool = getPool();
    if (!pool) return jsonError("Database not configured", 500);

    const { rows } = await pool.query(
      `
      with since as (
        select now() - ($1::int || ' days')::interval as ts
      ),
      coach as (
        select
          event_name,
          count(*)::int as coach_needs,
          count(distinct user_id)::int as unique_coaches
        from public.event_interests, since
        where created_at >= since.ts
          and actor_role = 'Coach'
          and action_type = 'NEED_POSTED'
          and event_name is not null
          and event_name <> ''
        group by event_name
      ),
      ath as (
        select
          event_name,
          count(*)::int as athlete_interest,
          count(distinct user_id)::int as unique_athletes
        from public.event_interests, since
        where created_at >= since.ts
          and actor_role = 'Athlete'
          and action_type = 'ATHLETE_INTEREST'
          and event_name is not null
          and event_name <> ''
        group by event_name
      )
      select
        coalesce(coach.event_name, ath.event_name) as event_name,
        coalesce(coach.coach_needs, 0) as coach_needs,
        coalesce(coach.unique_coaches, 0) as unique_coaches,
        coalesce(ath.athlete_interest, 0) as athlete_interest,
        coalesce(ath.unique_athletes, 0) as unique_athletes,
        (coalesce(coach.coach_needs, 0) - coalesce(ath.athlete_interest, 0)) as supply_gap
      from coach
      full join ath on ath.event_name = coach.event_name
      order by coach_needs desc, athlete_interest desc, event_name asc
      limit $2
      `,
      [days, limit]
    );

    return NextResponse.json({ ok: true, days, items: rows }, { status: 200 });
  } catch (e: any) {
    console.error("[event-traction] error", e);
    return jsonError("Failed to load event traction", 500, String(e?.message || e));
  }
}
