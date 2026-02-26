import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const athleteId = Number(params.id);

  if (!Number.isFinite(athleteId) || athleteId <= 0) {
    return jsonError("Invalid athlete id", 400, { athleteId });
  }

  const client = await pool.connect();
  try {
    // Profile comes from your VIEW and joins to users for parent info.
    // IMPORTANT: your users table columns are: firstname / lastname / email / phone
    const profileRes = await client.query(
      `
      SELECT
        d.id,
        d.first_name,
        d.last_name,
        d.city,
        d.state,
        d.dob,
        d.parent_user_id,

        u.firstname AS parent_firstname,
        u.lastname  AS parent_lastname,
        u.email     AS parent_email,
        u.phone     AS parent_phone
      FROM public.admin_athletes_directory d
      LEFT JOIN public.users u
        ON u.id = d.parent_user_id
      WHERE d.id = $1
      LIMIT 1
      `,
      [athleteId]
    );

    const profile = profileRes.rows[0] ?? null;

    // Interests (your table columns per screenshots)
    const interestsRes = await client.query(
      `
      SELECT
        id,
        event_name,
        event_date,
        age_group,
        weight_class,
        notes,
        created_at
      FROM public.wrestler_interests
      WHERE wrestler_id = $1
      ORDER BY created_at DESC NULLS LAST
      `,
      [athleteId]
    );

    // Matches: keep safe. (If your schema differs, we can adjust after.)
    // We'll try common columns; if you don't have matches yet, it won't matter.
    let matches: any[] = [];
    try {
      const matchesRes = await client.query(
        `
        SELECT
          m.id,
          m.status,
          COALESCE(n.event_name, i.event_name) AS event_name,
          COALESCE(n.age_group, i.age_group)   AS age_group,
          COALESCE(n.weight_class, i.weight_class) AS weight_class,
          t.team_name,
          t.coach_name AS team_coach_name,
          m.created_at
        FROM public.matches m
        LEFT JOIN public.coach_needs n ON n.id = m.need_id
        LEFT JOIN public.wrestler_interests i ON i.id = m.interest_id
        LEFT JOIN public.teams t ON t.id = m.team_id
        WHERE m.wrestler_id = $1
        ORDER BY m.created_at DESC NULLS LAST
        `,
        [athleteId]
      );
      matches = matchesRes.rows ?? [];
    } catch {
      // If matches table/columns differ in your DB right now, ignore for now
      matches = [];
    }

    return NextResponse.json({
      ok: true,
      athleteId,
      profile,
      interests: interestsRes.rows ?? [],
      matches,
    });
  } catch (e: any) {
    return jsonError("Failed to load athlete admin profile", 500, {
      athleteId,
      pg: { message: e?.message, code: e?.code },
    });
  } finally {
    client.release();
  }
}