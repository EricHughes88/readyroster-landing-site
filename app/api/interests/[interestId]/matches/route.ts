// app/api/interests/[interestId]/matches/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";
import { normalizeAgeGroup } from "@/lib/normalizeAgeGroup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

/* ------------------------------------------------------------------ */
/* Notifications helper (non-blocking)                                 */
/* ------------------------------------------------------------------ */

let notifReadCol: "is_read" | "read" | null = null;
let notifChecked = false;

async function resolveNotificationsReadColumn(client: any) {
  if (notifChecked) return notifReadCol;
  notifChecked = true;

  try {
    // Does notifications table exist?
    const t = await client.query(`SELECT to_regclass('public.notifications') AS r`);
    if (!t.rows?.[0]?.r) {
      notifReadCol = null;
      return notifReadCol;
    }

    // Prefer is_read if present, else read
    const cols = await client.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='notifications'
        AND column_name IN ('is_read','read')
      `
    );

    const names = new Set<string>((cols.rows || []).map((r: any) => r.column_name));
    if (names.has("is_read")) notifReadCol = "is_read";
    else if (names.has("read")) notifReadCol = "read";
    else notifReadCol = null;

    return notifReadCol;
  } catch {
    notifReadCol = null;
    return notifReadCol;
  }
}

async function notifyCoachMatchRequest(args: {
  client: any;
  coachUserId: number;
  interestId: number;
  needId: number;
  matchId: number;
}) {
  try {
    if (!args.coachUserId) return;

    const readCol = await resolveNotificationsReadColumn(args.client);
    if (!readCol) return; // can't mark unread

    // build a link that makes sense for your app (coach side)
    const link = `/coach/matches/${args.matchId}`; // change if your coach match page differs

    await args.client.query(
      `
      INSERT INTO public.notifications
        (user_id, type, title, body, link, ${readCol}, created_at)
      VALUES
        ($1, $2, $3, $4, $5, false, NOW())
      `,
      [
        args.coachUserId,
        "match_request",
        "New match request",
        "A parent requested a match for one of your posted needs.",
        link,
      ]
    );
  } catch (e) {
    // swallow — never break match creation
    console.error("[notify] notifyCoachMatchRequest failed:", e);
  }
}

/**
 * GET /api/interests/:interestId/matches
 * Returns the wrestler interest + matching open coach needs.
 * Each result also includes any existing match row for that (interest, need) pair.
 *
 * IMPORTANT ID RULES (your schema):
 * - coach_needs.coach_user_id stores users.user_id (app id)
 * - teams.userid stores users.id (internal pk)
 * So we must join:
 *   coach_needs.coach_user_id -> users.user_id -> teams.userid (via users.id)
 */
export async function GET(
  _req: Request,
  ctx:
    | { params: Promise<{ interestId: string }> }
    | { params: { interestId: string } }
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
        `SELECT id, wrestler_id, event_name, event_date, weight_class, age_group, age_group_key, notes
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
      const weight = String(interest.weight_class || "").trim();

      // ✅ key-based matching
      const interestAgeKey: string | null =
        interest.age_group_key ?? normalizeAgeGroup(interest.age_group || "");

      // event/date behavior
      const likeEvent = interest.event_name ? `%${interest.event_name}%` : null;
      const exactEvent = interest.event_name
        ? String(interest.event_name).trim()
        : null;
      const exactDate = interest.event_date || null;

      // ✅ Correct joins (no OR join that can return the wrong user)
      const q = `
        SELECT
          n.*,
          coach_u.name  AS coach_name,
          coach_u.email AS coach_email,
          t.teamname    AS team_name,
          m.id          AS match_id,
          m.status      AS match_status,
          m.parent_ok,
          m.coach_ok
        FROM public.coach_needs n

        -- coach_needs.coach_user_id -> users.user_id (app id)
        LEFT JOIN public.users coach_u
          ON coach_u.user_id = n.coach_user_id

        -- teams.userid -> users.id (internal pk)
        LEFT JOIN public.teams t
          ON t.userid = coach_u.id

        LEFT JOIN public.matches m
          ON m.wrestler_interest_id = $7
         AND m.coach_need_id        = n.id

        WHERE n.is_open IS TRUE
          AND n.weight_class = $1
          AND (
            -- ✅ primary: key match
            (n.age_group_key IS NOT NULL AND n.age_group_key = $2)
            -- fallback: legacy rows
            OR (n.age_group_key IS NULL AND (n.age_group = $3 OR n.age_group ILIKE $4))
          )
          AND ($5::date IS NULL OR n.event_date = $5)
          AND (
            $6::text IS NULL
            OR n.event_name = $6
            OR n.event_name ILIKE $8
          )
        ORDER BY n.event_date NULLS LAST, n.created_at DESC
      `;

      // If teams table/columns don't exist, fallback query (same matching)
      const qNoTeams = `
        SELECT
          n.*,
          coach_u.name  AS coach_name,
          coach_u.email AS coach_email,
          NULL::text    AS team_name,
          m.id          AS match_id,
          m.status      AS match_status,
          m.parent_ok,
          m.coach_ok
        FROM public.coach_needs n

        LEFT JOIN public.users coach_u
          ON coach_u.user_id = n.coach_user_id

        LEFT JOIN public.matches m
          ON m.wrestler_interest_id = $7
         AND m.coach_need_id        = n.id

        WHERE n.is_open IS TRUE
          AND n.weight_class = $1
          AND (
            (n.age_group_key IS NOT NULL AND n.age_group_key = $2)
            OR (n.age_group_key IS NULL AND (n.age_group = $3 OR n.age_group ILIKE $4))
          )
          AND ($5::date IS NULL OR n.event_date = $5)
          AND (
            $6::text IS NULL
            OR n.event_name = $6
            OR n.event_name ILIKE $8
          )
        ORDER BY n.event_date NULLS LAST, n.created_at DESC
      `;

      const params = [
        weight,
        interestAgeKey,
        interest.age_group,
        `%${String(interest.age_group || "").trim()}%`,
        exactDate,
        exactEvent,
        id,
        likeEvent,
      ];

      let rows: any[] = [];
      try {
        const r = await client.query(q, params);
        rows = r.rows;
      } catch (e: any) {
        const msg = String(e?.message || e);
        const needsFallback =
          /relation\s+"?teams"?\s+does\s+not\s+exist/i.test(msg) ||
          /missing\s+FROM-clause\s+entry/i.test(msg) ||
          /column\s+"?t\.\w+"?\s+does\s+not\s+exist/i.test(msg);

        if (!needsFallback) throw e;

        const r2 = await client.query(qNoTeams, params);
        rows = r2.rows;
      }

      return NextResponse.json({ ok: true, interest, matches: rows }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("matches GET error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/interests/:interestId/matches
 * Creates a match request for a specific coach need.
 *
 * Body: { needId: number }
 *
 * Behavior:
 *  - If a match already exists for (interestId, needId): returns it.
 *  - Otherwise inserts:
 *      status    = 'pending'
 *      coach_ok  = true
 *      parent_ok = false
 *
 * IMPORTANT:
 * - We also set matches.coach_user_id from coach_needs.coach_user_id (users.user_id)
 *   so other endpoints (like /api/matches) can filter correctly.
 *
 * NEW:
 * - Creates a notification for the coach (non-blocking)
 */
export async function POST(
  req: Request,
  ctx:
    | { params: Promise<{ interestId: string }> }
    | { params: { interestId: string } }
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
      await client.query("BEGIN");

      // Ensure interest exists
      const ires = await client.query(
        `SELECT id FROM public.wrestler_interests WHERE id = $1`,
        [interestId]
      );
      if (ires.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { ok: false, message: "Interest not found" },
          { status: 404 }
        );
      }

      // Ensure need exists + pull coach_user_id (users.user_id)
      const nres = await client.query(
        `SELECT id, coach_user_id FROM public.coach_needs WHERE id = $1`,
        [needId]
      );
      if (nres.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { ok: false, message: "Need not found" },
          { status: 404 }
        );
      }
      const coachUserId = Number(nres.rows[0]?.coach_user_id || 0);

      // If a match already exists for this pair, return it
      const existing = await client.query(
        `SELECT id, coach_need_id, coach_user_id, wrestler_interest_id, status, parent_ok, coach_ok, created_at, updated_at
           FROM public.matches
          WHERE coach_need_id = $1 AND wrestler_interest_id = $2
          LIMIT 1`,
        [needId, interestId]
      );

      if (existing.rowCount && existing.rows[0]) {
        await client.query("COMMIT");
        return NextResponse.json(
          { ok: true, match: existing.rows[0], alreadyExists: true },
          { status: 200 }
        );
      }

      // Create the match request (include coach_user_id!)
      const created = await client.query(
        `INSERT INTO public.matches
           (coach_need_id, coach_user_id, wrestler_interest_id, status, parent_ok, coach_ok, created_at, updated_at)
         VALUES
           ($1, $2, $3, 'pending', FALSE, TRUE, NOW(), NOW())
         RETURNING id, coach_need_id, coach_user_id, wrestler_interest_id, status, parent_ok, coach_ok, created_at, updated_at`,
        [needId, coachUserId || null, interestId]
      );

      const matchRow = created.rows[0];

      // ✅ Non-blocking notification to coach
      if (coachUserId && matchRow?.id) {
        await notifyCoachMatchRequest({
          client,
          coachUserId,
          interestId,
          needId,
          matchId: Number(matchRow.id),
        });
      }

      await client.query("COMMIT");

      return NextResponse.json({ ok: true, match: matchRow }, { status: 201 });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
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