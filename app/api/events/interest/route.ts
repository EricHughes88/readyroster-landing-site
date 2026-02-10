import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const event_name = String(body?.event_name ?? "").trim();
    const source = String(body?.source ?? "").trim() || null;

    if (!event_name) return jsonError("event_name is required", 400);

    const userIdRaw = (session.user as any).id;
    const user_id = Number(userIdRaw || 0);
    if (!user_id) return jsonError("Invalid user id", 400);

    await pool.query(
      `insert into public.event_interests (user_id, event_name, source)
       values ($1, $2, $3)`,
      [user_id, event_name, source]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError("Failed to record interest", 500, String(e?.message || e));
  }
}
