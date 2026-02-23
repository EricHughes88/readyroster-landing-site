// app/api/admin/analytics/event-traction/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const daysRaw = Number(url.searchParams.get("days") || 30);
    const limitRaw = Number(url.searchParams.get("limit") || 50);

    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 30;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

    // Aggregate needs + interests independently, then merge by normalized event name.
    // This avoids event_date/timezone mismatches causing athlete_interest to show 0.
    const q = `
      WITH
      needs AS (
        SELECT
          TRIM(LOWER(cn.event_name)) AS event_key,
          MAX(cn.event_name)         AS event_name,
          COUNT(*)::int             AS coach_needs,
          COUNT(DISTINCT cn.coach_user_id)::int AS unique_coaches
        FROM public.coach_needs cn
        WHERE cn.created_at >= NOW() - ($1::int || ' days')::interval
        GROUP BY TRIM(LOWER(cn.event_name))
      ),
      interests AS (
        SELECT
          TRIM(LOWER(wi.event_name)) AS event_key,
          MAX(wi.event_name)         AS event_name,
          COUNT(*)::int              AS athlete_interest,
          COUNT(DISTINCT wi.wrestler_id)::int AS unique_athletes
        FROM public.wrestler_interests wi
        WHERE wi.created_at >= NOW() - ($1::int || ' days')::interval
        GROUP BY TRIM(LOWER(wi.event_name))
      )
      SELECT
        COALESCE(n.event_name, i.event_name) AS event,
        COALESCE(n.event_name, i.event_name) AS event_name, -- support either UI field
        COALESCE(n.coach_needs, 0) AS coach_needs,
        COALESCE(n.unique_coaches, 0) AS unique_coaches,
        COALESCE(i.athlete_interest, 0) AS athlete_interest,
        COALESCE(i.unique_athletes, 0) AS unique_athletes,
        (COALESCE(n.coach_needs, 0) - COALESCE(i.athlete_interest, 0)) AS supply_gap
      FROM needs n
      FULL OUTER JOIN interests i
        ON i.event_key = n.event_key
      ORDER BY
        (COALESCE(n.coach_needs, 0) + COALESCE(i.athlete_interest, 0)) DESC,
        COALESCE(n.coach_needs, 0) DESC,
        COALESCE(i.athlete_interest, 0) DESC,
        COALESCE(n.event_name, i.event_name) ASC
      LIMIT $2::int;
    `;

    const res = await pool.query(q, [days, limit]);
    const rows = Array.isArray(res.rows) ? res.rows : [];

    // IMPORTANT: return under multiple common keys so the dashboard doesn't break
    // regardless of what it was coded to expect.
    return NextResponse.json({
      ok: true,
      days,
      limit,

      // common payload keys (one of these is what your UI is using)
      rows,
      data: rows,
      events: rows,
      traction: rows,
    });
  } catch (e: any) {
    console.error("[event-traction] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}