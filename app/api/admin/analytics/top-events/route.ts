import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session?.user || role !== "Admin") return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days") || 30);
    const limit = Number(url.searchParams.get("limit") || 25);

    const { rows } = await pool.query(
      `
      with since as (
        select now() - ($1::int || ' days')::interval as ts
      )
      select
        event_name,
        count(*)::int as interested_count
      from public.event_interests, since
      where created_at >= since.ts
      group by event_name
      order by interested_count desc, event_name asc
      limit $2
      `,
      [days, limit]
    );

    return NextResponse.json({ ok: true, days, items: rows });
  } catch (e: any) {
    return jsonError("Failed to load top events", 500, String(e?.message || e));
  }
}
