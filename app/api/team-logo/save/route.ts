// app/api/team-logo/save/route.ts
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
    global.__RR_PG_POOL__ = new Pool({ connectionString: conn });
  }

  return global.__RR_PG_POOL__;
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const logoUrl = String(body?.logoUrl ?? "").trim();
    const teamId = Number(body?.teamId);

    if (!logoUrl) {
      return NextResponse.json({ ok: false, message: "Missing logoUrl" }, { status: 400 });
    }

    if (!Number.isFinite(teamId) || teamId <= 0) {
      return NextResponse.json({ ok: false, message: "Missing or invalid teamId" }, { status: 400 });
    }

    const pool = getPool();

    const result = await pool.query(
      `
      UPDATE public.teams
      SET logopath = $1
      WHERE teamid = $2
      RETURNING teamid, teamname, logopath
      `,
      [logoUrl, teamId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { ok: false, message: "No team found for that teamId" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      team: result.rows[0],
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message ?? "Failed to save logo" },
      { status: 500 }
    );
  }
}