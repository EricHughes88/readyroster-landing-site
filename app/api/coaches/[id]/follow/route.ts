import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user?.id) {
      return jsonError("Unauthorized", 401);
    }

    const followerUserId = Number(session.user.id);
    const followedUserId = Number(params.id);

    if (!followerUserId || !followedUserId) {
      return jsonError("Invalid follow request", 400);
    }

    if (followerUserId === followedUserId) {
      return jsonError("You cannot follow yourself", 400);
    }

    const client = await pool.connect();
    try {
      const coachCheck = await client.query<{
        id: number;
        role: string | null;
      }>(
        `
        SELECT id, role
        FROM public.users
        WHERE id = $1
        LIMIT 1
        `,
        [followedUserId]
      );

      if (!coachCheck.rowCount) {
        return jsonError("Coach not found", 404);
      }

      const role = String(coachCheck.rows[0].role ?? "").toLowerCase();
      if (role !== "coach") {
        return jsonError("This profile is not a coach", 400);
      }

      await client.query(
        `
        INSERT INTO public.user_follows (follower_user_id, followed_user_id)
        VALUES ($1, $2)
        ON CONFLICT (follower_user_id, followed_user_id) DO NOTHING
        `,
        [followerUserId, followedUserId]
      );

      const countRes = await client.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM public.user_follows
        WHERE followed_user_id = $1
        `,
        [followedUserId]
      );

      return NextResponse.json({
        ok: true,
        following: true,
        followerCount: Number(countRes.rows[0]?.count ?? 0),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("POST /api/coaches/[id]/follow error:", error);
    return jsonError("Failed to follow coach", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user?.id) {
      return jsonError("Unauthorized", 401);
    }

    const followerUserId = Number(session.user.id);
    const followedUserId = Number(params.id);

    if (!followerUserId || !followedUserId) {
      return jsonError("Invalid unfollow request", 400);
    }

    const client = await pool.connect();
    try {
      await client.query(
        `
        DELETE FROM public.user_follows
        WHERE follower_user_id = $1
          AND followed_user_id = $2
        `,
        [followerUserId, followedUserId]
      );

      const countRes = await client.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM public.user_follows
        WHERE followed_user_id = $1
        `,
        [followedUserId]
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
    console.error("DELETE /api/coaches/[id]/follow error:", error);
    return jsonError("Failed to unfollow coach", 500);
  }
}