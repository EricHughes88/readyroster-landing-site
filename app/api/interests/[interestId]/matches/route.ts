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

  // 6/8/10/12/14 with optional U/under
  const m = s.match(/\b(6|8|10|12|14)\b(?:\s*(u|and\s*under|under))?/i);
  if (m) return (girls ? "Girls " : "") + `${m[1]}U`;

  if (/\b(high\s*school|hs)\b/i.test(s)) return girls ? "Girls HS" : "HS";
  if (/\bopen\b/i.test(s)) return girls ? "Girls Open" : "Open";

  // Fallback: Title-case and keep Girls tag if present
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
  ctx: { params: Promise<{ interestId: string }> }
) {
  try {
    if (!pool) {
      return NextResponse.json(
        { ok: true, interest: null, matches: [] },
        { status: 200 }
      );
    }

    // Next 15: params is a Promise
    const { interestId } = await ctx.params;
    const id = Number(interestId);
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
      const canonAge  = normalizeAgeGroup(interest.age_group || "");
      const weight    = String(interest.weight_class || "").trim();
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
                 ON (t.user_id = n.coach_user_id)      -- adjust if FK differs in your DB
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
        // If teams table/column is missing, retry without it
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
