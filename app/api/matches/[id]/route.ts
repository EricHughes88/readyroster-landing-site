// app/api/matches/[id]/route.ts
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

// GET /api/matches/:id
export async function GET(req: NextRequest, { params }: RouteParams) {
  const matchId = Number(params.id);
  if (!Number.isFinite(matchId) || matchId <= 0) {
    return jsonError("Invalid match id", 400);
  }

  try {
    const sql = `
      SELECT
        m.id,
        m.status,
        m.parent_ok,
        m.coach_ok,
        m.confirmed_at,
        m.created_at,
        m.updated_at,
        wi.notes,
        wi.weight_class,
        wi.age_group,
        wi.event_name AS interest_event_name,
        wi.event_date AS interest_event_date,
        w.first_name  AS wrestler_first_name,
        w.last_name   AS wrestler_last_name,
        w.city        AS wrestler_city,
        w.state       AS wrestler_state,
        cn.event_name,
        cn.event_date,
        cn.weight_class AS need_weight_class,
        cn.age_group   AS need_age_group,
        t.teamname     AS team_name,
        t.coach_name   AS team_coach_name,
        t.logopath     AS team_logo_path
      FROM matches m
      JOIN wrestler_interests wi ON wi.id = m.wrestler_interest_id
      JOIN wrestlers          w  ON w.id = wi.wrestler_id
      JOIN coach_needs        cn ON cn.id = m.coach_need_id
      LEFT JOIN teams         t  ON t.userid = cn.coach_user_id
      WHERE m.id = $1
      LIMIT 1
    `;

    const { rows } = await pool.query(sql, [matchId]);
    if (!rows.length) {
      return jsonError("Match not found", 404);
    }

    return NextResponse.json(
      {
        ok: true,
        match: rows[0],
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error in GET /api/matches/:id", err);
    return jsonError("Internal server error", 500, {
      message: String(err?.message ?? err),
    });
  }
}
