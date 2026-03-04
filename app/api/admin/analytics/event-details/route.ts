// app/api/admin/analytics/event-details/route.ts
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
 * - remove punctuation/symbols (keep letters/numbers/spaces)
 *
 * MUST match event-traction normalization so buckets align.
 */
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

    // ✅ preferred param (tight identity)
    const eventKeyRaw = (url.searchParams.get("event_key") || "").trim();

    // ✅ legacy param support (old UI)
    const eventLegacy = (url.searchParams.get("event") || "").trim();

    const event_key = normalizeKeyFromQuery(eventKeyRaw || eventLegacy);
    if (!event_key) return jsonError("Missing event_key", 400);

    // We want a nice display name for the header.
    // We'll pick it from whichever table has it (needs first, then interests).
    const nameRes = await pool.query(
      `
      WITH
      n AS (
        SELECT MAX(cn.event_name) AS event_name
        FROM public.coach_needs cn
        WHERE ${EVENT_KEY_SQL("cn.event_name")} = $1
      ),
      i AS (
        SELECT MAX(wi.event_name) AS event_name
        FROM public.wrestler_interests wi
        WHERE ${EVENT_KEY_SQL("wi.event_name")} = $1
      )
      SELECT COALESCE(n.event_name, i.event_name, $1) AS event_name
      FROM n CROSS JOIN i
      `,
      [event_key]
    );

    const event_name =
      (nameRes.rows?.[0]?.event_name as string | null) || event_key;

    // ✅ pick ONE team row per userid to avoid duplicates
    const needsRes = await pool.query(
      `
      SELECT
        cn.id,
        cn.coach_user_id,
        t.teamname AS team_name,
        cn.event_name,
        cn.event_date,
        cn.weight_class,
        cn.age_group,
        cn.city,
        cn.state,
        cn.notes,
        cn.is_open,
        cn.created_at
      FROM public.coach_needs cn
      LEFT JOIN LATERAL (
        SELECT teamname
        FROM public.teams
        WHERE userid = cn.coach_user_id
        ORDER BY teamid DESC NULLS LAST
        LIMIT 1
      ) t ON true
      WHERE ${EVENT_KEY_SQL("cn.event_name")} = $1
      ORDER BY cn.created_at DESC
      `,
      [event_key]
    );

    const interestsRes = await pool.query(
      `
      SELECT
        wi.id,
        wi.wrestler_id,

        w.parent_user_id,
        w.first_name,
        w.last_name,
        w.city,
        w.state,

        wi.age_group,
        wi.weight_class,
        wi.event_name,
        wi.event_date,
        wi.notes,
        wi.created_at
      FROM public.wrestler_interests wi
      INNER JOIN public.wrestlers w
        ON w.id = wi.wrestler_id
      WHERE ${EVENT_KEY_SQL("wi.event_name")} = $1
        AND wi.wrestler_id IS NOT NULL
      ORDER BY wi.created_at DESC
      `,
      [event_key]
    );

    return NextResponse.json({
      ok: true,
      event_name,
      event_key,
      needs: needsRes.rows || [],
      interests: interestsRes.rows || [],
    });
  } catch (e: any) {
    console.error("[event-details] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}