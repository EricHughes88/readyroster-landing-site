// app/api/admin/athletes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

/* -------------------------------------------
   GET: Full admin athlete profile (existing)
-------------------------------------------- */
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

    // Interests
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

    // Matches (best-effort; schema may vary)
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

/* -------------------------------------------
   PATCH: Update editable athlete fields
   (first_name, last_name, city, state, dob)
-------------------------------------------- */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const athleteId = Number(params.id);

  if (!Number.isFinite(athleteId) || athleteId <= 0) {
    return jsonError("Invalid athlete id", 400, { athleteId });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  // Normalize empty strings -> NULL
  const normStr = (v: any) => {
    if (v === null || v === undefined) return null;
    if (typeof v !== "string") return v;
    const t = v.trim();
    return t === "" ? null : t;
  };

  // DOB should be sent as "YYYY-MM-DD" (or null)
  const normDob = (v: any) => {
    const s = normStr(v);
    if (!s) return null;
    return s;
  };

  // Allowed public.athletes columns
  const allowed = ["first_name", "last_name", "city", "state", "dob"] as const;

  const updates: Record<string, any> = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      if (k === "dob") updates[k] = normDob(body[k]);
      else updates[k] = normStr(body[k]);
    }
  }

  // Normalize state to uppercase if provided
  if (Object.prototype.hasOwnProperty.call(updates, "state") && updates.state) {
    updates.state = String(updates.state).trim().toUpperCase();
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No valid fields to update", 400);
  }

  const keys = Object.keys(updates);
  const setSql = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = keys.map((k) => updates[k]);

  const client = await pool.connect();
  try {
    const q = `
      UPDATE public.athletes
      SET ${setSql}
      WHERE id = $${keys.length + 1}
      RETURNING id, first_name, last_name, city, state, dob, parent_user_id;
    `;

    const r = await client.query(q, [...values, athleteId]);

    if (r.rowCount === 0) {
      return jsonError("Athlete not found", 404);
    }

    return NextResponse.json({ ok: true, athlete: r.rows[0] });
  } catch (e: any) {
    return jsonError("Failed to update athlete", 500, {
      athleteId,
      pg: { message: e?.message, code: e?.code },
    });
  } finally {
    client.release();
  }
}