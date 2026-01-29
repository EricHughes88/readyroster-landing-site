import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications?userId=123
 * Returns latest notifications + unread count
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = Number(url.searchParams.get("userId") || 0);
  const limit = Math.min(Number(url.searchParams.get("limit") || 20), 50);

  if (!userId) {
    return NextResponse.json(
      { ok: false, message: "Missing userId" },
      { status: 400 }
    );
  }

  const { rows: notifications } = await pool.query(
    `
    select id, type, title, body, link, read, created_at
    from notifications
    where user_id = $1
    order by created_at desc
    limit $2
    `,
    [userId, limit]
  );

  const unreadRes = await pool.query(
    `
    select count(*)::int as count
    from notifications
    where user_id = $1 and read = false
    `,
    [userId]
  );

  return NextResponse.json({
    ok: true,
    notifications,
    unread: unreadRes.rows[0]?.count ?? 0,
  });
}

/**
 * PATCH /api/notifications
 * Body: { userId: number, ids: number[], read: boolean }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { userId, ids, read } = body ?? {};

  if (!userId || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Invalid payload" },
      { status: 400 }
    );
  }

  await pool.query(
    `
    update notifications
    set read = $3
    where user_id = $1
      and id = any($2::bigint[])
    `,
    [Number(userId), ids, Boolean(read)]
  );

  return NextResponse.json({ ok: true });
}
