// app/api/views/recent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __RR_PG_POOL__: pg.Pool | undefined;
}

const { Pool } = pg;

function getPool(): pg.Pool {
  const conn = process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL not set");

  if (!global.__RR_PG_POOL__) {
    global.__RR_PG_POOL__ = new Pool({
      connectionString: conn,
    });
  }

  return global.__RR_PG_POOL__;
}

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;
    if (!session?.user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    const targetType = String(searchParams.get("targetType") ?? "")
      .trim()
      .toLowerCase();
    const targetId = Number(searchParams.get("targetId"));
    const limit = Math.min(
      25,
      Math.max(1, Number(searchParams.get("limit") ?? 10))
    );

    if (!["athlete", "coach_need"].includes(targetType)) {
      return badRequest("Invalid targetType", { targetType });
    }

    if (!Number.isFinite(targetId) || targetId <= 0) {
      return badRequest("Invalid targetId", { targetId });
    }

    const pool = getPool();

    const viewersRes = await pool.query(
      `
      SELECT
        pv.id,
        pv.viewer_user_id,
        pv.viewer_role,
        pv.viewed_at,
        u.firstname,
        u.lastname,
        u.email,
        t.teamname AS team_name,
        t.coach_name
      FROM public.profile_views pv
      LEFT JOIN public.users u
        ON u.id = pv.viewer_user_id
      LEFT JOIN public.teams t
        ON t.userid = pv.viewer_user_id
      WHERE pv.target_type = $1
        AND pv.target_id = $2
        AND pv.viewer_role = 'coach'
      ORDER BY pv.viewed_at DESC, pv.id DESC
      LIMIT $3
      `,
      [targetType, targetId, limit]
    );

    return NextResponse.json({
      ok: true,
      viewers: viewersRes.rows ?? [],
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        message: err?.message ?? "Failed to fetch recent viewers",
        pg: { code: err?.code },
      },
      { status: 500 }
    );
  }
}