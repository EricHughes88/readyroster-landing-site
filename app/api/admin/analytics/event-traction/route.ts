// app/api/admin/analytics/event-traction/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

/**
 * Strong SQL-side event normalization:
 * - lower
 * - trim
 * - collapse whitespace
 * - remove punctuation (keep letters/numbers/spaces)
 *
 * This prevents "split buckets" from punctuation or spacing differences.
 */
const EVENT_KEY_SQL = (col: string) => `
  TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        LOWER(COALESCE(${col}, '')),
        '[^a-z0-9\\s]+',  -- strip punctuation/symbols
        '',
        'g'
      ),
      '\\s+',
      ' ',
      'g'
    )
  )
`;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const daysRaw = Number(url.searchParams.get("days") || 30);
    const limitRaw = Number(url.searchParams.get("limit") || 50);
    const stateRaw = (url.searchParams.get("state") || "").trim();

    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 30;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

    // Optional: filter by state if provided (e.g. ?state=NY)
    // NOTE: The join targets here may need to be adjusted to your actual schema.
    // If you paste your teams/wrestlers/athletes schema, I'll wire it perfectly.
    const hasState = Boolean(stateRaw);
    const state = stateRaw.toUpperCase();

    // Parameter positions:
    // $1 = days
    // $2 = limit
    // $3 = state (optional)
    const q = `
      WITH
      needs AS (
        SELECT
          ${EVENT_KEY_SQL("cn.event_name")} AS event_key,
          MAX(cn.event_name)               AS event_name,
          COUNT(*)::int                    AS coach_needs,
          COUNT(DISTINCT cn.coach_user_id)::int AS unique_coaches
        FROM public.coach_needs cn
        ${hasState ? `
        LEFT JOIN public.teams t
          ON t.user_id = cn.coach_user_id
        ` : ``}
        WHERE cn.created_at >= NOW() - ($1::int || ' days')::interval
        ${hasState ? `AND t.state = $3` : ``}
        GROUP BY ${EVENT_KEY_SQL("cn.event_name")}
      ),
      interests AS (
        SELECT
          ${EVENT_KEY_SQL("wi.event_name")} AS event_key,
          MAX(wi.event_name)               AS event_name,
          COUNT(*)::int                    AS athlete_interest,
          COUNT(DISTINCT wi.wrestler_id)::int AS unique_athletes
        FROM public.wrestler_interests wi
        ${hasState ? `
        LEFT JOIN public.wrestlers w
          ON w.id = wi.wrestler_id
        ` : ``}
        WHERE wi.created_at >= NOW() - ($1::int || ' days')::interval
        ${hasState ? `AND w.state = $3` : ``}
        GROUP BY ${EVENT_KEY_SQL("wi.event_name")}
      )
      SELECT
        COALESCE(n.event_name, i.event_name) AS event,
        COALESCE(n.event_name, i.event_name) AS event_name,

        -- Stable identity:
        COALESCE(n.event_key, i.event_key) AS event_key,

        -- URL-friendly drilldown slug (spaces -> dashes)
        REGEXP_REPLACE(COALESCE(n.event_key, i.event_key), '\\s+', '-', 'g') AS event_slug,

        COALESCE(n.coach_needs, 0)        AS coach_needs,
        COALESCE(n.unique_coaches, 0)     AS unique_coaches,
        COALESCE(i.athlete_interest, 0)   AS athlete_interest,
        COALESCE(i.unique_athletes, 0)    AS unique_athletes,
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

    const params: any[] = [days, limit];
    if (hasState) params.push(state);

    const res = await pool.query(q, params);
    const rows = Array.isArray(res.rows) ? res.rows : [];

    // IMPORTANT: return under multiple common keys so the dashboard doesn't break
    return NextResponse.json({
      ok: true,
      days,
      limit,
      state: hasState ? state : null,

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