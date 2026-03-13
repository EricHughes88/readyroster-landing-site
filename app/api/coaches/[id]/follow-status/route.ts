import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;
    const viewerUserId = Number(session?.user?.id ?? 0);
    const coachUserId = Number(params.id);

    if (!coachUserId) {
      return jsonError("Invalid coach id", 400);
    }

    const client = await pool.connect();
    try {
      const countRes = await client.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM public.user_follows
        WHERE followed_user_id = $1
        `,
        [coachUserId]
      );

      let following = false;

      if (viewerUserId) {
        const followRes = await client.query(
          `
          SELECT 1
          FROM public.user_follows
          WHERE follower_user_id = $1
            AND followed_user_id = $2
          LIMIT 1
          `,
          [viewerUserId, coachUserId]
        );

        following = (followRes.rowCount ?? 0) > 0;
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
    console.error("GET /api/coaches/[id]/follow-status error:", error);
    return jsonError("Failed to load follow status", 500);
  }
}