// app/api/admin/analytics/feed/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function intParam(url: URL, key: string, def: number) {
  const raw = url.searchParams.get(key);
  const n = raw ? Number(raw) : def;
  return Number.isFinite(n) ? n : def;
}

function isAdmin(session: any) {
  return session?.user && (session.user as any).role === "Admin";
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Math.max(intParam(url, "limit", 50), 1), 200);

    const sql = `
      select
        ae.id,
        ae.user_id,
        ae.event_type,
        ae.entity_type,
        ae.entity_id,
        ae.metadata,
        ae.created_at
      from public.activity_events ae
      order by ae.created_at desc
      limit $1
    `;

    const res = await pool.query(sql, [limit]);

    return NextResponse.json({ ok: true, items: res.rows });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Failed to load activity feed", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
