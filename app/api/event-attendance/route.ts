import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __RR_EVENT_ATTENDANCE_POOL__: pg.Pool | undefined;
}

const { Pool } = pg;

function getPool(): pg.Pool {
  const conn = process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL not set");

  if (!global.__RR_EVENT_ATTENDANCE_POOL__) {
    global.__RR_EVENT_ATTENDANCE_POOL__ = new Pool({ connectionString: conn });
  }

  return global.__RR_EVENT_ATTENDANCE_POOL__;
}

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

async function getSessionUserId() {
  const session = (await getServerSession(authConfig as any)) as any;
  const userId = Number(session?.user?.uid ?? session?.user?.id ?? 0);
  if (!userId) return null;
  return userId;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    const pool = getPool();

    const res = await pool.query(
      `
      select id, event_name, event_date, created_at
      from public.event_attendance
      where user_id = $1
      order by event_date nulls last, created_at desc
      `,
      [userId]
    );

    return NextResponse.json({ ok: true, rows: res.rows });
  } catch (err: any) {
    return jsonError("Failed to load event attendance", 500, err?.message ?? err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    const body = await req.json();
    const eventName = String(body?.eventName ?? "").trim();
    const eventDate =
      body?.eventDate && String(body.eventDate).trim()
        ? String(body.eventDate).trim()
        : null;

    if (!eventName) {
      return jsonError("eventName is required", 400);
    }

    const pool = getPool();

    await pool.query(
      `
      insert into public.event_attendance (user_id, event_name, event_date)
      values ($1, $2, $3)
      on conflict (user_id, event_name)
      do update set event_date = excluded.event_date
      `,
      [userId, eventName, eventDate]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return jsonError("Failed to save event attendance", 500, err?.message ?? err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return jsonError("Unauthorized", 401);

    const body = await req.json();
    const eventName = String(body?.eventName ?? "").trim();

    if (!eventName) {
      return jsonError("eventName is required", 400);
    }

    const pool = getPool();

    await pool.query(
      `
      delete from public.event_attendance
      where user_id = $1
        and event_name = $2
      `,
      [userId, eventName]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return jsonError("Failed to delete event attendance", 500, err?.message ?? err);
  }
}