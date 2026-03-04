// app/api/admin/analytics/event-breakdown/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

const EVENT_KEY_SQL = (col: string) => `
  TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        LOWER(COALESCE(${col}, '')),
        '[^a-z0-9\\s]+',
        '',
        'g'
      ),
      '\\s+',
      ' ',
      'g'
    )
  )
`;

function normalizeKeyFromQuery(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const eventKeyRaw =
      (url.searchParams.get("event_key") || "").trim() ||
      (url.searchParams.get("event") || "").trim(); // legacy support

    const event_key = normalizeKeyFromQuery(eventKeyRaw);
    if (!event_key) return jsonError("Missing event_key", 400);

    const stateRaw = (url.searchParams.get("state") || "").trim();
    const hasState = Boolean(stateRaw);
    const state = stateRaw.toUpperCase();

    // params:
    // $1 = event_key
    // $2 = state (optional)
    const params: any[] = [event_key];
    if (hasState) params.push(state);

    // NOTE:
    // - coach_needs join to teams uses teams.userid = coach_user_id (matches your event-details query)
    // - wrestler_interests join to wrestlers uses wrestlers.id = wrestler_id (matches your event-details query)
    const q = `
      WITH
      needs AS (
        SELECT
          NULLIF(TRIM(cn.age_group), '')    AS age_group,
          NULLIF(TRIM(cn.weight_class), '') AS weight_class,
          COUNT(*)::int                      AS needs
        FROM public.coach_needs cn
        ${hasState ? `
        LEFT JOIN public.teams t
          ON t.userid = cn.coach_user_id
        ` : ``}
        WHERE ${EVENT_KEY_SQL("cn.event_name")} = $1
        ${hasState ? `AND t.state = $2` : ``}
        GROUP BY 1, 2
      ),
      interests AS (
        SELECT
          NULLIF(TRIM(wi.age_group), '')    AS age_group,
          NULLIF(TRIM(wi.weight_class), '') AS weight_class,
          COUNT(*)::int                      AS interests
        FROM public.wrestler_interests wi
        INNER JOIN public.wrestlers w
          ON w.id = wi.wrestler_id
        WHERE ${EVENT_KEY_SQL("wi.event_name")} = $1
          AND wi.wrestler_id IS NOT NULL
        ${hasState ? `AND w.state = $2` : ``}
        GROUP BY 1, 2
      ),
      merged AS (
        SELECT
          COALESCE(n.age_group, i.age_group)     AS age_group,
          COALESCE(n.weight_class, i.weight_class) AS weight_class,
          COALESCE(n.needs, 0)::int              AS needs,
          COALESCE(i.interests, 0)::int          AS interests,
          (COALESCE(n.needs, 0) - COALESCE(i.interests, 0))::int AS gap
        FROM needs n
        FULL OUTER JOIN interests i
          ON COALESCE(n.age_group, '') = COALESCE(i.age_group, '')
         AND COALESCE(n.weight_class, '') = COALESCE(i.weight_class, '')
      )
      SELECT
        $1::text AS event_key,
        ${hasState ? `$2::text` : `NULL::text`} AS state,
        age_group,
        weight_class,
        needs,
        interests,
        gap
      FROM merged
      ORDER BY
        ABS(gap) DESC,
        needs DESC,
        interests DESC,
        age_group NULLS LAST,
        weight_class NULLS LAST;
    `;

    const res = await pool.query(q, params);
    const rows = Array.isArray(res.rows) ? res.rows : [];

    // Also return separate lists (handy for UI without extra work)
    const needs_by_bucket = rows
      .filter((r) => Number(r.needs) > 0)
      .map((r) => ({
        age_group: r.age_group,
        weight_class: r.weight_class,
        count: Number(r.needs) || 0,
      }));

    const interests_by_bucket = rows
      .filter((r) => Number(r.interests) > 0)
      .map((r) => ({
        age_group: r.age_group,
        weight_class: r.weight_class,
        count: Number(r.interests) || 0,
      }));

    return NextResponse.json({
      ok: true,
      event_key,
      state: hasState ? state : null,
      gap_by_bucket: rows,
      needs_by_bucket,
      interests_by_bucket,
    });
  } catch (e: any) {
    console.error("[event-breakdown] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}