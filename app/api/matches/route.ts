// app/api/matches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

function normalizeRole(role: string | null | undefined): string {
  return String(role ?? "").trim().toLowerCase();
}

type DbUserRow = {
  id: number;
  user_id?: number | null;
  email: string | null;
  role: string | null;
};

/* ------------------------------------------------------------------ */
/* GET  /api/matches                                                  */
/* Used by MatchesTablePage (coach & parent dashboards)               */
/* and by the parent wrestler matches page                            */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user?.email) {
      return jsonError("Unauthorized", 401);
    }

    const sessionUserRes = await pool.query<DbUserRow>(
      `
      SELECT id, user_id, email, role
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [session.user.email]
    );

    if (!sessionUserRes.rows.length) {
      return jsonError("User not found", 404);
    }

    const sessionUser = sessionUserRes.rows[0];
    const sessionRole = normalizeRole(sessionUser.role);

    const url = new URL(req.url);
    const sp = url.searchParams;

    const coachUserId = Number(sp.get("coachUserId") || 0);
    const parentUserId = Number(sp.get("parentUserId") || 0);
    const needId = Number(sp.get("needId") || 0);
    const wrestlerId = Number(sp.get("wrestlerId") || 0);
    const statusParam = (sp.get("status") || "pending") as
      | "pending"
      | "confirmed"
      | "all";

    const where: string[] = [];
    const params: any[] = [];
    let idx = 1;

    /**
     * SESSION-DRIVEN DEFAULTS
     * - coach_needs.coach_user_id and matches.coach_user_id use users.user_id (app id)
     * - teams.userid uses users.id (internal id)
     * - wrestler ownership on parent side is tied through wrestlers.parent_user_id -> users.id
     *
     * We still allow explicit query params when provided, but if they are omitted
     * we auto-scope from the logged-in user.
     */

    const hasExplicitCoachFilter = coachUserId > 0;
    const hasExplicitParentFilter = parentUserId > 0;
    const hasExplicitWrestlerFilter = wrestlerId > 0;

    if (hasExplicitCoachFilter) {
      where.push(`(m.coach_user_id = $${idx} OR coach_u.id = $${idx} OR coach_u.user_id = $${idx})`);
      params.push(coachUserId);
      idx++;
    } else if (sessionRole === "coach") {
      const coachAppId = Number(sessionUser.user_id || 0);
      if (!coachAppId) {
        return jsonError("Coach account is missing app user_id.", 400);
      }
      where.push(`m.coach_user_id = $${idx}`);
      params.push(coachAppId);
      idx++;
    }

    if (hasExplicitParentFilter) {
      where.push(`w.parent_user_id = $${idx}`);
      params.push(parentUserId);
      idx++;
    } else if (!hasExplicitWrestlerFilter && (sessionRole === "parent" || sessionRole === "athlete")) {
      where.push(`w.parent_user_id = $${idx}`);
      params.push(sessionUser.id);
      idx++;
    }

    if (needId) {
      where.push(`m.coach_need_id = $${idx}`);
      params.push(needId);
      idx++;
    }

    if (wrestlerId) {
      where.push(`w.id = $${idx}`);
      params.push(wrestlerId);
      idx++;
    }

    if (statusParam !== "all") {
      where.push(`m.status = $${idx}`);
      params.push(statusParam);
      idx++;
    }

    if (!where.length) {
      return jsonError(
        "Unable to determine match scope for this user.",
        400,
        { role: sessionRole }
      );
    }

    const whereSql = "WHERE " + where.join(" AND ");

    const sql = `
      SELECT
        m.id,
        m.status,
        m.parent_ok,
        m.coach_ok,
        m.confirmed_at,
        m.created_at,

        cn.id AS coach_need_id,
        cn.coach_user_id,
        cn.event_name,
        cn.event_date,
        cn.weight_class,
        cn.age_group,
        cn.age_group_key,

        wi.id AS wrestler_interest_id,
        wi.wrestler_id,
        wi.notes,

        w.id AS wrestler_id_actual,
        w.first_name AS wrestler_first_name,
        w.last_name  AS wrestler_last_name,
        w.parent_user_id,

        t.teamid   AS team_id,
        t.teamname AS team_name,
        COALESCE(t.coach_name, coach_u.name) AS team_coach_name,
        coach_u.email AS team_coach_email,
        t.logopath AS team_logo_path

      FROM matches m
      JOIN wrestler_interests wi
        ON wi.id = m.wrestler_interest_id
      JOIN wrestlers w
        ON w.id = wi.wrestler_id
      JOIN coach_needs cn
        ON cn.id = m.coach_need_id

      -- coach_needs.coach_user_id -> users.user_id
      LEFT JOIN users coach_u
        ON coach_u.user_id = cn.coach_user_id

      -- teams.userid -> users.id
      LEFT JOIN teams t
        ON t.userid = coach_u.id

      ${whereSql}

      ORDER BY
        COALESCE(cn.event_date, wi.event_date) NULLS LAST,
        cn.event_name ASC,
        w.last_name ASC,
        w.first_name ASC
    `;

    const { rows } = await pool.query(sql, params);

    return NextResponse.json(
      {
        ok: true,
        matches: rows,
        page: {
          page: 1,
          limit: rows.length,
          total: rows.length,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error in GET /api/matches:", err);
    return jsonError("Internal server error in matches route", 500, {
      message: String(err?.message ?? err),
    });
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/matches                                                  */
/* Called from NeedMatchesPage -> createMatch()                       */
/* body: { interestId: number; needId: number; side?: "coach"|"parent"} */
/* ------------------------------------------------------------------ */

type CreateMatchBody = {
  interestId?: number;
  needId?: number;
  side?: "coach" | "parent";
};

export async function POST(req: NextRequest) {
  let body: CreateMatchBody;

  try {
    body = (await req.json()) as CreateMatchBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const interestId = Number(body.interestId || 0);
  const needId = Number(body.needId || 0);
  const side = body.side === "parent" ? "parent" : "coach";

  if (!Number.isFinite(interestId) || interestId <= 0) {
    return jsonError("Valid interestId is required", 400);
  }

  if (!Number.isFinite(needId) || needId <= 0) {
    return jsonError("Valid needId is required", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: needRows } = await client.query(
      `
      SELECT id, coach_user_id
      FROM coach_needs
      WHERE id = $1
      `,
      [needId]
    );

    if (!needRows.length) {
      await client.query("ROLLBACK");
      return jsonError("Coach need not found", 404);
    }

    const need = needRows[0];

    const { rows: interestRows } = await client.query(
      `
      SELECT id, wrestler_id
      FROM wrestler_interests
      WHERE id = $1
      `,
      [interestId]
    );

    if (!interestRows.length) {
      await client.query("ROLLBACK");
      return jsonError("Wrestler interest not found", 404);
    }

    const { rows: existingRows } = await client.query(
      `
      SELECT *
      FROM matches
      WHERE coach_need_id = $1
        AND wrestler_interest_id = $2
        AND status <> 'cancelled'
      LIMIT 1
      `,
      [needId, interestId]
    );

    let matchRow;

    if (existingRows.length) {
      const m = existingRows[0] as {
        id: number;
        status: string;
        coach_ok: boolean | null;
        parent_ok: boolean | null;
      };

      let coachOk = m.coach_ok;
      let parentOk = m.parent_ok;

      if (side === "coach") coachOk = true;
      if (side === "parent") parentOk = true;

      const isConfirmed = !!coachOk && !!parentOk;

      const { rows: updated } = await client.query(
        `
        UPDATE matches
        SET coach_ok = $1,
            parent_ok = $2,
            status = CASE WHEN $3 THEN 'confirmed' ELSE status END,
            confirmed_at = CASE
              WHEN $3 AND status <> 'confirmed' THEN NOW()
              ELSE confirmed_at
            END,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
        `,
        [coachOk, parentOk, isConfirmed, m.id]
      );

      matchRow = updated[0];
    } else {
      const coachOk = side === "coach";
      const parentOk = side === "parent";

      const { rows: inserted } = await client.query(
        `
        INSERT INTO matches (
          coach_need_id,
          coach_user_id,
          wrestler_interest_id,
          status,
          coach_ok,
          parent_ok,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, 'pending', $4, $5, NOW(), NOW())
        RETURNING *
        `,
        [need.id, need.coach_user_id, interestId, coachOk, parentOk]
      );

      matchRow = inserted[0];
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        ok: true,
        match: matchRow,
      },
      { status: 200 }
    );
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Error in POST /api/matches:", err);
    return jsonError("Internal server error creating match", 500, {
      message: String(err?.message ?? err),
    });
  } finally {
    client.release();
  }
}