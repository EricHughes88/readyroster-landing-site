import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __RR_COACH_RADAR_POOL__: Pool | undefined;
}

function getPool(): Pool | null {
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;

  if (!global.__RR_COACH_RADAR_POOL__) {
    global.__RR_COACH_RADAR_POOL__ = new Pool({
      connectionString: conn,
    });
  }

  return global.__RR_COACH_RADAR_POOL__;
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
        SELECT DISTINCT ON (a.athleteid)
          wi.id AS interest_id,
          wi.wrestler_id,
          wi.event_name,
          wi.event_date,
          wi.weight_class,
          wi.age_group,
          wi.notes,
          wi.created_at,

          a.athleteid,
          a.firstname,
          a.lastname,
          a.city,
          a.state,
          a.dob,
          a.userid AS athlete_user_id,

          cn.id AS coach_need_id,
          cn.event_name AS need_event_name,
          cn.weight_class AS need_weight_class,
          cn.age_group AS need_age_group,

          CASE
            WHEN af.coach_user_id IS NOT NULL THEN true
            ELSE false
          END AS already_following,

          CASE
            WHEN wi.created_at >= NOW() - interval '3 days' THEN true
            ELSE false
          END AS is_new,

          COALESCE(ec.event_count, 1) AS event_count

        FROM public.coach_needs cn
        INNER JOIN public.wrestler_interests wi
          ON LOWER(COALESCE(wi.event_name, '')) = LOWER(COALESCE(cn.event_name, ''))
         AND LOWER(COALESCE(wi.weight_class, '')) = LOWER(COALESCE(cn.weight_class, ''))
         AND LOWER(COALESCE(wi.age_group, '')) = LOWER(COALESCE(cn.age_group, ''))

        INNER JOIN public.athletes a
          ON a.athleteid = wi.wrestler_id

        LEFT JOIN public.athlete_follows af
          ON af.wrestler_id = wi.wrestler_id
         AND af.coach_user_id = cn.coach_user_id

        LEFT JOIN (
          SELECT
            wrestler_id,
            COUNT(DISTINCT LOWER(COALESCE(event_name, '')))::int AS event_count
          FROM public.wrestler_interests
          GROUP BY wrestler_id
        ) ec
          ON ec.wrestler_id = wi.wrestler_id

        WHERE cn.coach_user_id = $1
          AND COALESCE(cn.is_open, TRUE) = TRUE

        ORDER BY
          a.athleteid,
          CASE WHEN af.coach_user_id IS NOT NULL THEN 1 ELSE 0 END ASC,
          wi.created_at DESC,
          wi.id DESC
        `,
        [coachUserId]
      );

      const rows = result.rows ?? [];

      rows.sort((a: any, b: any) => {
        const aFollowing = !!a.already_following;
        const bFollowing = !!b.already_following;
        const aNew = !!a.is_new;
        const bNew = !!b.is_new;

        if (aFollowing !== bFollowing) {
          return aFollowing ? 1 : -1;
        }

        if (aNew !== bNew) {
          return aNew ? -1 : 1;
        }

        const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;

        return bCreated - aCreated;
      });

      return NextResponse.json({
        ok: true,
        athletes: rows,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("GET /api/coach/radar error:", error);
    return jsonError("Failed to load coach radar", 500);
  }
}