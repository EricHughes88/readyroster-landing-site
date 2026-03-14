import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Pool singleton */
declare global {
  // eslint-disable-next-line no-var
  var __RR_COACH_MAP_POOL__: Pool | undefined;
}

function getPool(): Pool | null {
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;

  if (!global.__RR_COACH_MAP_POOL__) {
    global.__RR_COACH_MAP_POOL__ = new Pool({
      connectionString: conn,
    });
  }

  return global.__RR_COACH_MAP_POOL__;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, message, athletes: [] }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    if (!pool) return jsonError("Database not configured", 500);

    const url = new URL(req.url);

    const eventName = (url.searchParams.get("event") || "").trim();
    const weightClass = (url.searchParams.get("weight") || "").trim();
    const ageGroup = (url.searchParams.get("age") || "").trim();

    const client = await pool.connect();

    try {
      const result = await client.query(
        `
        SELECT DISTINCT ON (a.athleteid)
  wi.id AS interest_id,
  wi.event_name,
  wi.event_date,
  wi.weight_class,
  wi.age_group,

  a.athleteid AS wrestler_id,
  a.firstname,
  a.lastname,
  a.city,
  a.state,
  a.dob

FROM public.wrestler_interests wi
INNER JOIN public.athletes a
  ON a.athleteid = wi.wrestler_id

WHERE
  ($1 = '' OR LOWER(wi.event_name) = LOWER($1))
  AND ($2 = '' OR LOWER(wi.weight_class) = LOWER($2))
  AND ($3 = '' OR LOWER(wi.age_group) = LOWER($3))

ORDER BY
  a.athleteid,
  wi.created_at DESC
        `,
        [eventName, weightClass, ageGroup]
      );

      return NextResponse.json({
        ok: true,
        athletes: result.rows ?? [],
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("coach map error:", error);
    return jsonError("Failed to load recruiting map", 500);
  }
}