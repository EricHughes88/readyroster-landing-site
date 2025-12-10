// app/api/matches/[id]/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

type RouteParams = {
  params: {
    id: string;
  };
};

// POST /api/matches/:id/confirm
// Body: { side?: "coach" | "parent" }  --> defaults to "parent"
export async function POST(req: NextRequest, { params }: RouteParams) {
  const matchId = Number(params.id);
  if (!Number.isFinite(matchId) || matchId <= 0) {
    return jsonError("Invalid match id", 400);
  }

  let side: "coach" | "parent" = "parent";
  try {
    const body = await req.json().catch(() => ({}));
    if (body && (body.side === "coach" || body.side === "parent")) {
      side = body.side;
    }
  } catch {
    // ignore, keep side = "parent"
  }

  try {
    // Get existing flags
    const { rows } = await pool.query(
      `SELECT id, status, coach_ok, parent_ok
       FROM matches
       WHERE id = $1`,
      [matchId]
    );

    if (!rows.length) {
      return jsonError("Match not found", 404);
    }

    let coachOk: boolean | null = rows[0].coach_ok;
    let parentOk: boolean | null = rows[0].parent_ok;

    if (side === "coach") coachOk = true;
    if (side === "parent") parentOk = true;

    const isConfirmed = !!coachOk && !!parentOk;

    const { rows: updated } = await pool.query(
      `UPDATE matches
       SET coach_ok = $1,
           parent_ok = $2,
           status = CASE WHEN $3 THEN 'confirmed' ELSE status END,
           confirmed_at = CASE WHEN $3 AND status <> 'confirmed'
                               THEN NOW() ELSE confirmed_at END,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [coachOk, parentOk, isConfirmed, matchId]
    );

    return NextResponse.json(
      {
        ok: true,
        match: updated[0],
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error confirming match", err);
    return jsonError("Internal server error confirming match", 500, {
      message: String(err?.message ?? err),
    });
  }
}
