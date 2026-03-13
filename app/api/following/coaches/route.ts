import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pool singleton for dev HMR
declare global {
  // eslint-disable-next-line no-var
  var __RR_FOLLOWING_COACHES_POOL__: Pool | undefined;
}

function getPool(): Pool | null {
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;

  if (!global.__RR_FOLLOWING_COACHES_POOL__) {
    global.__RR_FOLLOWING_COACHES_POOL__ = new Pool({
      connectionString: conn,
    });
  }

  return global.__RR_FOLLOWING_COACHES_POOL__;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json(
    { ok: false, message, coaches: [] },
    { status }
  );
}

export async function GET() {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user?.id) {
      return jsonError("Unauthorized", 401);
    }

    const followerUserId = Number(session.user.id);

    if (!Number.isFinite(followerUserId) || followerUserId <= 0) {
      return jsonError("Invalid session user", 400);
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
          uf.followed_user_id AS coach_user_id,
          uf.created_at AS followed_at,

          u.firstname,
          u.lastname,
          u.email,
          u.role,

          t.teamid,
          t.teamname,
          t.coach_name,
          t.contactemail,
          t.city,
          t.state,
          t.logopath,

          ln.need_id AS latest_need_id,
          ln.event_name AS latest_need_event_name,
          ln.event_date AS latest_need_event_date,
          ln.weight_class AS latest_need_weight_class,
          ln.age_group AS latest_need_age_group,
          ln.city AS latest_need_city,
          ln.state AS latest_need_state,
          ln.created_at AS latest_need_created_at

        FROM public.user_follows uf

        INNER JOIN public.users u
          ON u.id = uf.followed_user_id

        LEFT JOIN public.teams t
          ON t.userid = u.id

        LEFT JOIN LATERAL (
          SELECT
            cn.id AS need_id,
            cn.event_name,
            cn.event_date,
            cn.weight_class,
            cn.age_group,
            cn.city,
            cn.state,
            cn.created_at
          FROM public.coach_needs cn
          WHERE cn.coach_user_id = u.id
            AND COALESCE(cn.is_open, TRUE) = TRUE
          ORDER BY cn.created_at DESC, cn.id DESC
          LIMIT 1
        ) ln ON TRUE

        WHERE uf.follower_user_id = $1
          AND LOWER(COALESCE(u.role, '')) = 'coach'

        ORDER BY
          ln.created_at DESC NULLS LAST,
          uf.created_at DESC,
          uf.id DESC
        `,
        [followerUserId]
      );

      return NextResponse.json({
        ok: true,
        coaches: result.rows ?? [],
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("GET /api/following/coaches error:", error);
    return jsonError("Failed to load followed coaches", 500);
  }
}