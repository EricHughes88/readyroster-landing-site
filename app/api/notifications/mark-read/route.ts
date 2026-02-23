import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let notifReadCol: "is_read" | "read" | null = null;
let notifChecked = false;

async function resolveNotificationsReadColumn() {
  if (notifChecked) return notifReadCol;
  notifChecked = true;

  try {
    const cols = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='notifications'
        AND column_name IN ('is_read','read')
      `
    );

    const names = new Set<string>((cols.rows || []).map((r: any) => r.column_name));
    if (names.has("is_read")) notifReadCol = "is_read";
    else if (names.has("read")) notifReadCol = "read";
    else notifReadCol = null;

    return notifReadCol;
  } catch {
    notifReadCol = null;
    return notifReadCol;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const { matchId } = await req.json();

  if (!matchId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const readCol = await resolveNotificationsReadColumn();
  if (!readCol) {
    return NextResponse.json({ ok: true });
  }

  await pool.query(
    `
    UPDATE public.notifications
    SET ${readCol} = true
    WHERE user_id = $1
      AND type = 'message'
      AND link = ('/messages/match/' || $2)
    `,
    [userId, matchId]
  );

  return NextResponse.json({ ok: true });
}