// app/api/admin/athletes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

/* -------------------------------------------
   GET: Full admin athlete profile
   ✅ Uses public.wrestlers to match admin_athletes_directory
-------------------------------------------- */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const wrestlerId = Number(params.id);

  if (!Number.isFinite(wrestlerId) || wrestlerId <= 0) {
    return jsonError("Invalid athlete id", 400, { wrestlerId });
  }

  const client = await pool.connect();
  try {
    // Profile comes from the same source as admin_athletes_directory
    const profileRes = await client.query(
      `
      SELECT
        w.id,
        w.first_name,
        w.last_name,
        w.city,
        w.state,
        w.dob,
        w.parent_user_id,
        u.firstname AS parent_firstname,
        u.lastname AS parent_lastname,
        u.email AS parent_email,
        u.phone AS parent_phone,
        NULL::text AS created_at
      FROM public.wrestlers w
      LEFT JOIN public.users u
        ON u.id = w.parent_user_id
      WHERE w.id = $1
      LIMIT 1
      `,
      [wrestlerId]
    );

    const profile = profileRes.rows[0] ?? null;

    if (!profile) {
      return jsonError("Athlete not found", 404, { wrestlerId });
    }

    // Interests now line up with wrestlers.id
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
      [wrestlerId]
    );

    // Matches using your real schema:
    // matches.wrestler_interest_id -> wrestler_interests.id
    // matches.coach_need_id -> coach_needs.id
    // coach_needs.coach_user_id -> teams.userid
    const matchesRes = await client.query(
      `
      SELECT
        m.id,
        m.status,
        COALESCE(cn.event_name, wi.event_name) AS event_name,
        COALESCE(cn.age_group, wi.age_group) AS age_group,
        COALESCE(cn.weight_class, wi.weight_class) AS weight_class,
        t.teamname AS team_name,
        t.coach_name AS team_coach_name,
        m.created_at
      FROM public.matches m
      LEFT JOIN public.wrestler_interests wi
        ON wi.id = m.wrestler_interest_id
      LEFT JOIN public.coach_needs cn
        ON cn.id = m.coach_need_id
      LEFT JOIN public.teams t
        ON t.userid = cn.coach_user_id
      WHERE wi.wrestler_id = $1
      ORDER BY m.created_at DESC NULLS LAST
      `,
      [wrestlerId]
    );

    return NextResponse.json({
      ok: true,
      athleteId: wrestlerId,
      profile,
      interests: interestsRes.rows ?? [],
      matches: matchesRes.rows ?? [],
    });
  } catch (e: any) {
    return jsonError("Failed to load athlete admin profile", 500, {
      wrestlerId,
      pg: { message: e?.message, code: e?.code },
    });
  } finally {
    client.release();
  }
}

/* -------------------------------------------
   PATCH: Update editable wrestler fields
   ✅ Uses public.wrestlers
-------------------------------------------- */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const wrestlerId = Number(params.id);

  if (!Number.isFinite(wrestlerId) || wrestlerId <= 0) {
    return jsonError("Invalid athlete id", 400, { wrestlerId });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const normStr = (v: any) => {
    if (v === null || v === undefined) return null;
    if (typeof v !== "string") return v;
    const t = v.trim();
    return t === "" ? null : t;
  };

  const normDob = (v: any) => {
    const s = normStr(v);
    if (!s) return null;
    return s;
  };

  const fieldMap: Record<string, string> = {
    first_name: "first_name",
    last_name: "last_name",
    city: "city",
    state: "state",
    dob: "dob",
  };

  const updates: Record<string, any> = {};

  for (const [apiField, dbField] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(body, apiField)) {
      updates[dbField] =
        apiField === "dob" ? normDob(body[apiField]) : normStr(body[apiField]);
    }
  }

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
      UPDATE public.wrestlers
      SET ${setSql}
      WHERE id = $${keys.length + 1}
      RETURNING
        id,
        first_name,
        last_name,
        city,
        state,
        dob,
        parent_user_id
    `;

    const r = await client.query(q, [...values, wrestlerId]);

    if (r.rowCount === 0) {
      return jsonError("Athlete not found", 404);
    }

    return NextResponse.json({ ok: true, athlete: r.rows[0] });
  } catch (e: any) {
    return jsonError("Failed to update athlete", 500, {
      wrestlerId,
      pg: { message: e?.message, code: e?.code },
    });
  } finally {
    client.release();
  }
}