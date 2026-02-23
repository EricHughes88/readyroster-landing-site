// app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) return jsonError("Unauthorized", 401);

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId) || userId <= 0) return jsonError("Bad user id", 400);

  try {
    const url = new URL(req.url);
    const sp = url.searchParams;

    const unreadOnly = sp.get("unreadOnly") === "1" || sp.get("unreadOnly") === "true";
    const type = (sp.get("type") || "").trim(); // optional filter
    const limitRaw = Number(sp.get("limit") || 20);
    const offsetRaw = Number(sp.get("offset") || 0);

    const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? limitRaw : 20));
    const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

    // Build WHERE safely
    const whereParts: string[] = ["n.user_id = $1"];
    const params: any[] = [userId];
    let p = 2;

    if (unreadOnly) {
      whereParts.push("n.is_read = false");
    }

    if (type) {
      whereParts.push(`n.type = $${p++}`);
      params.push(type);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    // Fetch notifications
    const listRes = await pool.query<{
      id: number;
      user_id: number;
      type: string;
      title: string | null;
      body: string | null;
      link: string | null;
      is_read: boolean;
      created_at: string;
    }>(
      `
      SELECT id, user_id, type, title, body, link, is_read, created_at
      FROM public.notifications n
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${p++} OFFSET $${p++}
      `,
      [...params, limit, offset]
    );

    // Unread count (all types)
    const unreadRes = await pool.query<{ cnt: string }>(
      `
      SELECT COUNT(*)::text AS cnt
      FROM public.notifications
      WHERE user_id = $1 AND is_read = false
      `,
      [userId]
    );

    const unreadCount = Number(unreadRes.rows?.[0]?.cnt || "0");

    return NextResponse.json(
      {
        ok: true,
        userId,
        unreadCount,
        notifications: listRes.rows ?? [],
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("[GET /api/notifications] error:", e);
    return jsonError("Server error", 500);
  }
}