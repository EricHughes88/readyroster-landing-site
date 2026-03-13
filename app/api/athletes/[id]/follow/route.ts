import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pool singleton for dev HMR
declare global {
  // eslint-disable-next-line no-var
  var __RR_ATHLETE_FOLLOW_POOL__: Pool | undefined;
}

function getPool(): Pool | null {
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;

  if (!global.__RR_ATHLETE_FOLLOW_POOL__) {
    global.__RR_ATHLETE_FOLLOW_POOL__ = new Pool({
      connectionString: conn,
    });
  }

  return global.__RR_ATHLETE_FOLLOW_POOL__;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user?.id) {
      return jsonError("Unauthorized", 401);
    }

    const coachUserId = Number(session.user.id);
    const athleteId = Number(params.id);

    if (!Number.isFinite(coachUserId) || coachUserId <= 0) {
      return jsonError("Invalid session user", 400);
    }

    if (!Number.isFinite(athleteId) || athleteId <= 0) {
      return jsonError("Invalid athlete id", 400);
    }

    const pool = getPool();
    if (!pool) {
      return jsonError("Database not configured", 500);
    }

    const client = await pool.connect();

    try {
      const athleteRes = await client.query<{
        athleteid: number;
        firstname: string | null;
        lastname: string | null;
        userid: number | null;
        parent_email: string | null;
      }>(
        `
        SELECT
          a.athleteid,
          a.firstname,
          a.lastname,
          a.userid,
          a.parent_email
        FROM public.athletes a
        WHERE a.athleteid = $1
        LIMIT 1
        `,
        [athleteId]
      );

      if (athleteRes.rows.length === 0) {
        return jsonError("Athlete not found", 404);
      }

      const athlete = athleteRes.rows[0];
      const athleteOwnerUserId = Number(athlete.userid ?? 0) || null;

      if (athleteOwnerUserId && athleteOwnerUserId === coachUserId) {
        return jsonError("You cannot follow your own athlete profile", 400);
      }

      await client.query(
        `
        INSERT INTO public.athlete_follows (coach_user_id, wrestler_id)
        VALUES ($1, $2)
        ON CONFLICT (coach_user_id, wrestler_id) DO NOTHING
        `,
        [coachUserId, athleteId]
      );

      const countRes = await client.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM public.athlete_follows
        WHERE wrestler_id = $1
        `,
        [athleteId]
      );

      const coachRes = await client.query<{
        firstname: string | null;
        lastname: string | null;
      }>(
        `
        SELECT firstname, lastname
        FROM public.users
        WHERE id = $1
        LIMIT 1
        `,
        [coachUserId]
      );

      const coachFirst = String(coachRes.rows[0]?.firstname ?? "").trim();
      const coachLast = String(coachRes.rows[0]?.lastname ?? "").trim();
      const coachName = `${coachFirst} ${coachLast}`.trim() || "A coach";

      const athleteName =
        `${String(athlete.firstname ?? "").trim()} ${String(athlete.lastname ?? "").trim()}`.trim() ||
        "your athlete";

      if (athleteOwnerUserId) {
        try {
          await client.query(
            `
            INSERT INTO public.notifications
            (
              user_id,
              type,
              title,
              body,
              link,
              created_at,
              is_read
            )
            VALUES ($1, $2, $3, $4, $5, NOW(), FALSE)
            `,
            [
              athleteOwnerUserId,
              "athlete_followed",
              "New follower",
              `${coachName} started following ${athleteName}.`,
              `/athletes/${athleteId}`,
            ]
          );
        } catch (notifyError) {
          console.error("Athlete follow notification failed:", notifyError);
        }
      }

      return NextResponse.json({
        ok: true,
        following: true,
        followerCount: Number(countRes.rows[0]?.count ?? 0),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("POST /api/athletes/[id]/follow error:", error);
    return jsonError("Failed to follow athlete", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user?.id) {
      return jsonError("Unauthorized", 401);
    }

    const coachUserId = Number(session.user.id);
    const athleteId = Number(params.id);

    if (!Number.isFinite(coachUserId) || coachUserId <= 0) {
      return jsonError("Invalid session user", 400);
    }

    if (!Number.isFinite(athleteId) || athleteId <= 0) {
      return jsonError("Invalid athlete id", 400);
    }

    const pool = getPool();
    if (!pool) {
      return jsonError("Database not configured", 500);
    }

    const client = await pool.connect();

    try {
      await client.query(
        `
        DELETE FROM public.athlete_follows
        WHERE coach_user_id = $1
          AND wrestler_id = $2
        `,
        [coachUserId, athleteId]
      );

      const countRes = await client.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM public.athlete_follows
        WHERE wrestler_id = $1
        `,
        [athleteId]
      );

      return NextResponse.json({
        ok: true,
        following: false,
        followerCount: Number(countRes.rows[0]?.count ?? 0),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("DELETE /api/athletes/[id]/follow error:", error);
    return jsonError("Failed to unfollow athlete", 500);
  }
}