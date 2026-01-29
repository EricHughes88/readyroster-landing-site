import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { userId, subscription } = await req.json();

  await pool.query(
    `
    insert into push_subscriptions (user_id, endpoint, p256dh, auth)
    values ($1,$2,$3,$4)
    on conflict (endpoint)
    do update set user_id=$1, p256dh=$3, auth=$4
    `,
    [
      userId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
    ]
  );

  return NextResponse.json({ ok: true });
}
