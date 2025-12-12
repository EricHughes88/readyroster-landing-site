// app/api/interests/[interestId]/matches/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

/** Canonicalize variants into labels like "12U", "Girls 8U", "HS", "Open". */
function normalizeAgeGroup(input: string): string {
  let s = (input || "").trim();
  const girls = /\bgirls?\b/i.test(s);
  s = s.replace(/\bgirls?\b/gi, "").trim();
  s = s.replace(/&/g, "and").replace(/\s+/g, " ").toLowerCase();

  const m = s.match(/\b(6|8|10|12|14)\b(?:\s*(u|and\s*under|under))?/i);
  if (m) return (girls ? "Girls " : "") + `${m[1]}U`;

  if (/\b(high\s*school|hs)\b/i.test(s)) return girls ? "Girls HS" : "HS";
  if (/\bopen\b/i.test(s)) return girls ? "Girls Open" : "Open";

  const tidy = s.replace(/\b\w/g, (c) => c.toUpperCase());
  return girls ? `Girls ${tidy}` : tidy;
}

/**
 * GET /api/interests/:interestId/matches
 * Returns the wrestler interest + matching open coach needs.
 * Each result also includes any existing match row for that (interest, need) pair.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ interestId: string }> } | { params: { interestId: string } }
) {
  try {
    if (!pool) {
      return NextResponse.json(
        { ok: true, interest: null, matches: [] },
        { status: 200 }
      );
    }

    const paramsObj = await Promise.resolve((ctx as any).params);
    const id = Number(paramsObj.interestId);

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { ok: false, message: "Invalid id" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // 1) Load the wrestler interest
      const ires = await client.query(
        `SELECT id, wrestler_id, event_name, event_date, weight_class, age_group, notes
           FROM public.wrestler_interests
          WHERE id = $1`,
        [id]
      );

      if (ires.rowCount === 0) {
        return NextResponse.json(
          { ok: false, message: "Interest not found" },
          { status: 404 }
        );
      }

      const interest = ires.rows[0];

      // 2) Normalize search inputs
      const canonAge = normalizeAgeGroup(interest.age_group || "");
      const weight = String(interest.weight_class || "").trim();
      const likeEvent = interest.event_name ? `%${interest.event_name}%` : null;
      const exactDate = interest.event_date || null;

      // Query WITH teams join and LEFT JOIN to matches (to surface status)
      const qWithTeams = `
        SELECT n.*,
               u.name  AS coach_name,
               u.email AS coach_email,
               t.name  AS team_name,
               m.id     AS match_id,
               m.status AS match_status,
               m.parent_ok,
               m.coach_ok
          FROM public.coach_needs n
          LEFT JOIN public.users u
                 ON (u.user_id = n.coach_user_id OR u.id = n.coach_user_id)
          LEFT JOIN public.teams t
                 ON (t.user_id = n.coach_user_id)
          LEFT JOIN public.matches m
                 ON m.wrestler_interest_id = $6
                AND m.coach_need_id        = n.id
         WHERE n.is_open IS TRUE
           AND n.weight_class = $1
           AND (n.age_group = $2 OR n.age_group ILIKE $3)
           AND ($4::date IS NULL OR n.event_date = $4)
           AND ($5::text IS NULL OR n.event_name ILIKE $5)
         ORDER BY n.event_date NULLS LAST, n.created_at DESC
      `;

      // Fallback WITHOUT teams table (if it doesn’t exist)
      const qWithoutTeams = `
        SELECT n.*,
               u.name  AS coach_name,
               u.email AS coach_email,
               NULL::text AS team_name,
               m.id     AS match_id,
               m.status AS match_status,
               m.parent_ok,
               m.coach_ok
          FROM public.coach_needs n
          LEFT JOIN public.users u
                 ON (u.user_id = n.coach_user_id OR u.id = n.coach_user_id)
          LEFT JOIN public.matches m
                 ON m.wrestler_interest_id = $6
                AND m.coach_need_id        = n.id
         WHERE n.is_open IS TRUE
           AND n.weight_class = $1
           AND (n.age_group = $2 OR n.age_group ILIKE $3)
           AND ($4::date IS NULL OR n.event_date = $4)
           AND ($5::text IS NULL OR n.event_name ILIKE $5)
         ORDER BY n.event_date NULLS LAST, n.created_at DESC
      `;

      const params = [weight, canonAge, `%${canonAge}%`, exactDate, likeEvent, id];

      let rows: any[] = [];
      try {
        const r = await client.query(qWithTeams, params);
        rows = r.rows;
      } catch (e: any) {
        const msg = String(e?.message || e);
        const needsFallback =
          /relation\s+"?teams"?\s+does\s+not\s+exist/i.test(msg) ||
          /missing\s+FROM-clause\s+entry/i.test(msg) ||
          /column\s+"?t\.\w+"?\s+does\s+not\s+exist/i.test(msg);

        if (!needsFallback) throw e;

        const r2 = await client.query(qWithoutTeams, params);
        rows = r2.rows;
      }

      return NextResponse.json(
        { ok: true, interest, matches: rows },
        { status: 200 }
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("matches GET error:", err);
    return NextResponse.json(
      { ok: false, message: "Server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/interests/:interestId/matches
 * Creates a match request for a specific coach need.
 *
 * Body:
 *  { needId: number }
 *
 * Behavior:
 *  - If a match already exists for (interestId, needId): returns it.
 *  - Otherwise inserts:
 *      status    = 'pending'
 *      coach_ok  = true
 *      parent_ok = false   <-- IMPORTANT (NOT NULL constraint)
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ interestId: string }> } | { params: { interestId: string } }
) {
  try {
    if (!pool) {
      return NextResponse.json(
        { ok: false, message: "Database not configured" },
        { status: 500 }
      );
    }

    const paramsObj = await Promise.resolve((ctx as any).params);
    const interestId = Number(paramsObj.interestId);

    if (!Number.isFinite(interestId) || interestId <= 0) {
      return NextResponse.json(
        { ok: false, message: "Invalid interestId" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const needId = Number(body?.needId);

    if (!Number.isFinite(needId) || needId <= 0) {
      return NextResponse.json(
        { ok: false, message: "Missing or invalid needId" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // Ensure interest exists
      const ires = await client.query(
        `SELECT id FROM public.wrestler_interests WHERE id = $1`,
        [interestId]
      );
      if (ires.rowCount === 0) {
        return NextResponse.json(
          { ok: false, message: "Interest not found" },
          { status: 404 }
        );
      }

      // Ensure need exists (and is open is optional, but recommended)
      const nres = await client.query(
        `SELECT id, is_open FROM public.coach_needs WHERE id = $1`,
        [needId]
      );
      if (nres.rowCount === 0) {
        return NextResponse.json(
          { ok: false, message: "Need not found" },
          { status: 404 }
        );
      }

      // If a match already exists for this pair, return it
      const existing = await client.query(
        `SELECT id, coach_need_id, wrestler_interest_id, status, parent_ok, coach_ok, created_at, updated_at
           FROM public.matches
          WHERE coach_need_id = $1 AND wrestler_interest_id = $2
          LIMIT 1`,
        [needId, interestId]
      );

      if (existing.rowCount && existing.rows[0]) {
        return NextResponse.json(
          { ok: true, match: existing.rows[0], alreadyExists: true },
          { status: 200 }
        );
      }

      // Create the match request
      // IMPORTANT: parent_ok and coach_ok are NOT NULL in your DB
      const created = await client.query(
        `INSERT INTO public.matches
           (coach_need_id, wrestler_interest_id, status, parent_ok, coach_ok, created_at, updated_at)
         VALUES
           ($1, $2, 'pending', FALSE, TRUE, NOW(), NOW())
         RETURNING id, coach_need_id, wrestler_interest_id, status, parent_ok, coach_ok, created_at, updated_at`,
        [needId, interestId]
      );

      return NextResponse.json(
        { ok: true, match: created.rows[0] },
        { status: 201 }
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("matches POST error:", err);
    return NextResponse.json(
      { ok: false, message: "Failed to send match request to athlete" },
      { status: 500 }
    );
  }
}
