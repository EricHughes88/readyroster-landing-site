import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __RR_COACH_FOLLOWING_ATHLETES_POOL__: Pool | undefined;
}

function getPool(): Pool | null {
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;

  if (!global.__RR_COACH_FOLLOWING_ATHLETES_POOL__) {
    global.__RR_COACH_FOLLOWING_ATHLETES_POOL__ = new Pool({
      connectionString: conn,
    });
  }

  return global.__RR_COACH_FOLLOWING_ATHLETES_POOL__;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, message, athletes: [] }, { status });
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
          af.wrestler_id,
          af.created_at AS followed_at,

          a.firstname,
          a.lastname,
          a.city,
          a.state,
          a.dob,

          wi.id AS latest_interest_id,
          wi.event_name AS latest_event_name,
          wi.event_date AS latest_event_date,
          wi.weight_class AS latest_weight_class,
          wi.age_group AS latest_age_group,
          wi.notes AS latest_notes,
          wi.created_at AS latest_interest_created_at,

          CASE
            WHEN wi.created_at >= NOW() - interval '3 days' THEN true
            ELSE false
          END AS is_new_activity

        FROM public.athlete_follows af
        INNER JOIN public.athletes a
          ON a.athleteid = af.wrestler_id

        LEFT JOIN LATERAL (
          SELECT
            wii.id,
            wii.event_name,
            wii.event_date,
            wii.weight_class,
            wii.age_group,
            wii.notes,
            wii.created_at
          FROM public.wrestler_interests wii
          WHERE wii.wrestler_id = af.wrestler_id
          ORDER BY wii.created_at DESC, wii.id DESC
          LIMIT 1
        ) wi ON TRUE

        WHERE af.coach_user_id = $1

        ORDER BY
          is_new_activity DESC,
          wi.created_at DESC NULLS LAST,
          af.created_at DESC
        `,
        [coachUserId]
      );

      return NextResponse.json({
        ok: true,
        athletes: result.rows ?? [],
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("GET /api/coach/following-athletes error:", error);
    return jsonError("Failed to load followed athletes", 500);
  }
}