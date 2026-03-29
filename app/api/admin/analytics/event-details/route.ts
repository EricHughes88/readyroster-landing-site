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

    // preferred param
    const eventKeyRaw = (url.searchParams.get("event_key") || "").trim();

    // legacy param support
    const eventLegacy = (url.searchParams.get("event") || "").trim();

    const event_key = normalizeKeyFromQuery(eventKeyRaw || eventLegacy);
    if (!event_key) return jsonError("Missing event_key", 400);

    // nice display name for page header
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

    const needsRes = await pool.query(
      `
      SELECT
        cn.id,
        cn.coach_user_id,

        COALESCE(
          NULLIF(t.teamname, ''),
          NULLIF(cn.event_name, ''),
          'No team profile yet'
        ) AS team_name,

        COALESCE(
          NULLIF(t.coach_name, ''),
          'No coach name'
        ) AS coach_name,

        COALESCE(
          NULLIF(t.contactemail, ''),
          'No contact email'
        ) AS contact_email,

        CASE
          WHEN COALESCE(NULLIF(t.city, ''), NULLIF(t.state, '')) IS NOT NULL
            THEN CONCAT_WS(', ', NULLIF(t.city, ''), NULLIF(t.state, ''))
          WHEN COALESCE(NULLIF(cn.city, ''), NULLIF(cn.state, '')) IS NOT NULL
            THEN CONCAT_WS(', ', NULLIF(cn.city, ''), NULLIF(cn.state, ''))
          ELSE 'No location'
        END AS location,

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
        SELECT
          teamname,
          coach_name,
          contactemail,
          city,
          state
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

        u.firstname AS parent_firstname,
        u.lastname AS parent_lastname,
        u.email AS parent_email,
        u.phone AS parent_phone,

        NULLIF(
          TRIM(
            CONCAT(
              COALESCE(w.first_name, ''),
              ' ',
              COALESCE(w.last_name, '')
            )
          ),
          ''
        ) AS athlete_name,

        NULLIF(
          TRIM(
            CONCAT(
              COALESCE(u.firstname, ''),
              ' ',
              COALESCE(u.lastname, '')
            )
          ),
          ''
        ) AS parent_name,

        NULLIF(
          TRIM(
            CONCAT(
              COALESCE(w.city, ''),
              CASE
                WHEN w.city IS NOT NULL
                  AND TRIM(COALESCE(w.city, '')) <> ''
                  AND w.state IS NOT NULL
                  AND TRIM(COALESCE(w.state, '')) <> ''
                THEN ', '
                ELSE ''
              END,
              COALESCE(w.state, '')
            )
          ),
          ''
        ) AS location,

        u.email AS contact,

        wi.age_group,
        wi.weight_class,
        wi.event_name,
        wi.event_date,
        wi.notes,
        wi.created_at
      FROM public.wrestler_interests wi
      LEFT JOIN public.wrestlers w
        ON w.id = wi.wrestler_id
      LEFT JOIN public.users u
        ON u.id = w.parent_user_id
      WHERE ${EVENT_KEY_SQL("wi.event_name")} = $1
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