import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const event = (url.searchParams.get("event") || "").trim();
    if (!event) return jsonError("Missing event", 400);

    // ✅ pick ONE team row per userid to avoid duplicates
    const needsRes = await pool.query(
      `
      SELECT
        cn.id,
        cn.coach_user_id,
        t.teamname AS team_name,
        cn.event_name,
        cn.event_date,
        cn.weight_class,
        cn.age_group,
        cn.city,
        cn.state,
        cn.notes,
        cn.is_open,
        cn.created_at
      FROM public.coach_needs cn
      LEFT JOIN LATERAL (
        SELECT teamname
        FROM public.teams
        WHERE userid = cn.coach_user_id
        ORDER BY teamid DESC NULLS LAST
        LIMIT 1
      ) t ON true
      WHERE cn.event_name = $1
      ORDER BY cn.created_at DESC
      `,
      [event]
    );

    const interestsRes = await pool.query(
      `
      SELECT
        wi.id,
        wi.wrestler_id,

        w.parent_user_id,
        w.first_name,
        w.last_name,
        w.city,
        w.state,

        wi.age_group,
        wi.weight_class,
        wi.event_name,
        wi.event_date,
        wi.notes,
        wi.created_at
      FROM public.wrestler_interests wi
      INNER JOIN public.wrestlers w
        ON w.id = wi.wrestler_id
      WHERE wi.event_name = $1
        AND wi.wrestler_id IS NOT NULL
      ORDER BY wi.created_at DESC
      `,
      [event]
    );

    return NextResponse.json({
      ok: true,
      event,
      needs: needsRes.rows || [],
      interests: interestsRes.rows || [],
    });
  } catch (e: any) {
    console.error("[event-details] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}