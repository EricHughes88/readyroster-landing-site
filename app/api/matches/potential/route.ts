import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type DbUserRow = {
  id: number;
  role: string | null;
};

function normalizeRole(role: string | null | undefined): string {
  return String(role ?? "").trim().toLowerCase();
}

export async function GET() {
  const session = (await getServerSession(authConfig as any)) as any;

  if (!session?.user?.email) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const client = await pool.connect();

  try {
    const userRes = await client.query<DbUserRow>(
      `
      SELECT id, role
      FROM public.users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [session.user.email]
    );

    if (!userRes.rows.length) {
      return NextResponse.json(
        { ok: false, message: "User not found" },
        { status: 404 }
      );
    }

    const user = userRes.rows[0];
    const role = normalizeRole(user.role);

    if (role === "parent" || role === "athlete") {
      const potentialMatchesRes = await client.query(
        `
        SELECT DISTINCT ON (
          cn.coach_user_id,
          LOWER(REGEXP_REPLACE(COALESCE(cn.event_name,''),'[^a-z0-9]+','','g')),
          regexp_replace(COALESCE(cn.weight_class,''),'\\s+','','g'),
          LOWER(REGEXP_REPLACE(COALESCE(cn.age_group,''),'[^a-z0-9]+','','g'))
        )

          wi.id AS wrestler_interest_id,
          wi.wrestler_id,
          a.firstname,
          a.lastname,

          cn.id AS coach_need_id,
          cn.coach_user_id,
          cn.event_name,
          cn.event_date,
          cn.weight_class,
          cn.age_group,
          cn.city,
          cn.state,

          t.teamid,
          t.teamname,
          t.coach_name,
          t.contactemail,
          t.logopath,

          EXISTS (
            SELECT 1
            FROM public.profile_views pv
            WHERE pv.target_type = 'athlete'
              AND pv.target_id = wi.wrestler_id
              AND pv.viewer_user_id = cn.coach_user_id
          ) AS coach_viewed,

          (
            SELECT MAX(pv.viewed_at)
            FROM public.profile_views pv
            WHERE pv.target_type = 'athlete'
              AND pv.target_id = wi.wrestler_id
              AND pv.viewer_user_id = cn.coach_user_id
          ) AS coach_viewed_at

        FROM public.wrestler_interests wi

        INNER JOIN public.athletes a
          ON a.athleteid = wi.wrestler_id

        INNER JOIN public.coach_needs cn
          ON LOWER(REGEXP_REPLACE(COALESCE(wi.event_name,''),'[^a-z0-9]+','','g'))
           = LOWER(REGEXP_REPLACE(COALESCE(cn.event_name,''),'[^a-z0-9]+','','g'))

         AND LOWER(REGEXP_REPLACE(COALESCE(wi.age_group,''),'[^a-z0-9]+','','g'))
           = LOWER(REGEXP_REPLACE(COALESCE(cn.age_group,''),'[^a-z0-9]+','','g'))

         AND EXISTS (
           SELECT 1
           FROM unnest(
             string_to_array(
               regexp_replace(
                 regexp_replace(COALESCE(cn.weight_class,''),'-',',','g'),
                 '\\s+','',
                 'g'
               ),
               ','
             )
           ) AS need_weight
           WHERE need_weight =
             regexp_replace(COALESCE(wi.weight_class,''),'\\s+','','g')
         )

        LEFT JOIN LATERAL (
          SELECT
            t1.teamid,
            t1.teamname,
            t1.coach_name,
            t1.contactemail,
            t1.logopath
          FROM public.teams t1
          WHERE t1.userid = cn.coach_user_id
            AND t1.teamname IS NOT NULL
            AND TRIM(t1.teamname) <> ''
          ORDER BY t1.teamid ASC
          LIMIT 1
        ) t ON true

        LEFT JOIN public.matches m
          ON m.wrestler_interest_id = wi.id
         AND m.coach_need_id = cn.id

        WHERE
          a.userid = $1
          AND m.wrestler_interest_id IS NULL
          AND t.teamname IS NOT NULL

        ORDER BY
          cn.coach_user_id,
          LOWER(REGEXP_REPLACE(COALESCE(cn.event_name,''),'[^a-z0-9]+','','g')),
          regexp_replace(COALESCE(cn.weight_class,''),'\\s+','','g'),
          LOWER(REGEXP_REPLACE(COALESCE(cn.age_group,''),'[^a-z0-9]+','','g')),
          cn.event_date NULLS LAST,
          cn.id ASC,
          wi.id ASC
        `,
        [user.id]
      );

      const recentCoachViewersRes = await client.query(
        `
        SELECT DISTINCT ON (pv.viewer_user_id, wi.wrestler_id)
          pv.viewer_user_id,
          pv.viewed_at,
          wi.wrestler_id,
          a.firstname,
          a.lastname,
          t.teamid,
          t.teamname,
          t.coach_name,
          t.contactemail,
          t.logopath
        FROM public.profile_views pv

        INNER JOIN public.users u
          ON u.id = pv.viewer_user_id
         AND LOWER(COALESCE(u.role, '')) = 'coach'

        INNER JOIN public.wrestler_interests wi
          ON wi.wrestler_id = pv.target_id

        INNER JOIN public.athletes a
          ON a.athleteid = wi.wrestler_id

        LEFT JOIN LATERAL (
          SELECT
            t1.teamid,
            t1.teamname,
            t1.coach_name,
            t1.contactemail,
            t1.logopath
          FROM public.teams t1
          WHERE t1.userid = pv.viewer_user_id
          ORDER BY t1.teamid ASC
          LIMIT 1
        ) t ON true

        WHERE
          pv.target_type = 'athlete'
          AND a.userid = $1

        ORDER BY
          pv.viewer_user_id,
          wi.wrestler_id,
          pv.viewed_at DESC
        `,
        [user.id]
      );

      return NextResponse.json({
        ok: true,
        role,
        potentialMatches: potentialMatchesRes.rows,
        recentCoachViewers: recentCoachViewersRes.rows,
      });
    }

    if (role === "coach") {
      const result = await client.query(
        `
        SELECT DISTINCT ON (wi.id)
          wi.id AS wrestler_interest_id,
          wi.wrestler_id,

          cn.id AS coach_need_id,
          cn.coach_user_id,
          cn.event_name,
          cn.event_date,
          cn.weight_class,
          cn.age_group,
          cn.city,
          cn.state,

          a.athleteid,
          a.firstname,
          a.lastname,
          a.city AS athlete_city,
          a.state AS athlete_state,

          t.teamid,
          t.teamname,
          t.coach_name,
          t.contactemail,
          t.logopath

        FROM public.coach_needs cn

        INNER JOIN public.wrestler_interests wi
          ON LOWER(REGEXP_REPLACE(COALESCE(wi.event_name, ''), '[^a-z0-9]+', '', 'g')) =
             LOWER(REGEXP_REPLACE(COALESCE(cn.event_name, ''), '[^a-z0-9]+', '', 'g'))

          AND LOWER(REGEXP_REPLACE(COALESCE(wi.age_group, ''), '[^a-z0-9]+', '', 'g')) =
              LOWER(REGEXP_REPLACE(COALESCE(cn.age_group, ''), '[^a-z0-9]+', '', 'g'))

          AND EXISTS (
            SELECT 1
            FROM unnest(
              string_to_array(
                regexp_replace(
                  regexp_replace(COALESCE(cn.weight_class, ''), '-', ',', 'g'),
                  '\\s+',
                  '',
                  'g'
                ),
                ','
              )
            ) AS need_weight
            WHERE need_weight =
              regexp_replace(COALESCE(wi.weight_class, ''), '\\s+', '', 'g')
          )

        INNER JOIN public.athletes a
          ON a.athleteid = wi.wrestler_id

        LEFT JOIN LATERAL (
          SELECT
            t1.teamid,
            t1.teamname,
            t1.coach_name,
            t1.contactemail,
            t1.logopath
          FROM public.teams t1
          WHERE t1.userid = cn.coach_user_id
          ORDER BY t1.teamid ASC
          LIMIT 1
        ) t ON true

        LEFT JOIN public.matches m
          ON m.wrestler_interest_id = wi.id
          AND m.coach_need_id = cn.id

        WHERE
          cn.coach_user_id = $1
          AND m.wrestler_interest_id IS NULL

        ORDER BY
          wi.id,
          cn.event_date NULLS LAST
        `,
        [user.id]
      );

      return NextResponse.json({
        ok: true,
        role,
        potentialMatches: result.rows,
      });
    }

    return NextResponse.json({
      ok: true,
      role,
      potentialMatches: [],
      recentCoachViewers: [],
    });
  } catch (error: any) {
    console.error("GET /api/matches/potential error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Failed to load potential matches",
        error: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}