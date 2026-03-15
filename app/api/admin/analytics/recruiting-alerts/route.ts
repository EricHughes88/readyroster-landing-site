// app/api/admin/analytics/recruiting-alerts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user) {
      return jsonError("Unauthorized", 401);
    }

    const q = await pool.query<{
      sent_last_24h: string | number | null;
      sent_last_7d: string | number | null;
      total_sent: string | number | null;
      latest_sent_at: string | null;
    }>(
      `
      SELECT
        COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '24 hours') AS sent_last_24h,
        COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '7 days') AS sent_last_7d,
        COUNT(*) AS total_sent,
        MAX(sent_at) AS latest_sent_at
      FROM public.recruiting_alert_log
      `
    );

    const row = q.rows[0];

    return NextResponse.json({
      ok: true,
      sent_last_24h: Number(row?.sent_last_24h ?? 0),
      sent_last_7d: Number(row?.sent_last_7d ?? 0),
      total_sent: Number(row?.total_sent ?? 0),
      latest_sent_at: row?.latest_sent_at ?? null,
    });
  } catch (err: any) {
    console.error("recruiting alerts analytics error", err);
    return jsonError(
      err?.message || "Failed to load recruiting alert analytics",
      500
    );
  }
}