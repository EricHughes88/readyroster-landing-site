import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pool singleton for dev HMR
declare global {
  // eslint-disable-next-line no-var
  var __RR_ATHLETE_FOLLOW_STATUS_POOL__: Pool | undefined;
}

function getPool(): Pool | null {
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;

  if (!global.__RR_ATHLETE_FOLLOW_STATUS_POOL__) {
    global.__RR_ATHLETE_FOLLOW_STATUS_POOL__ = new Pool({
      connectionString: conn,
    });
  }

  return global.__RR_ATHLETE_FOLLOW_STATUS_POOL__;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;
    const viewerUserId = Number(session?.user?.id ?? 0);
    const wrestlerId = Number(params.id);

    if (!Number.isFinite(wrestlerId) || wrestlerId <= 0) {
      return jsonError("Invalid athlete id", 400);
    }

    const pool = getPool();
    if (!pool) {
      return jsonError("Database not configured", 500);
    }

    const client = await pool.connect();

    try {
      const countRes = await client.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM public.athlete_follows
        WHERE wrestler_id = $1
        `,
        [wrestlerId]
      );

      let following = false;

      if (viewerUserId > 0) {
        const followRes = await client.query(
          `
          SELECT 1
          FROM public.athlete_follows
          WHERE coach_user_id = $1
            AND wrestler_id = $2
          LIMIT 1
          `,
          [viewerUserId, wrestlerId]
        );

        following = followRes.rows.length > 0;
      }

      return NextResponse.json({
        ok: true,
        following,
        followerCount: Number(countRes.rows[0]?.count ?? 0),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("GET /api/athletes/[id]/follow-status error:", error);
    return jsonError("Failed to load athlete follow status", 500);
  }
}