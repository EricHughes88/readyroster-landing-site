// app/api/matches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

/* ------------------------------------------------------------------ */
/* GET  /api/matches                                                  */
/* Used by MatchesTablePage (coach & parent dashboards)               */
/* and by the parent wrestler matches page                            */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  try {
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

    // allow access by coach, parent, or wrestler
    if (!coachUserId && !parentUserId && !wrestlerId) {
      return jsonError(
        "coachUserId or parentUserId or wrestlerId is required to query matches.",
        400
      );
    }

    const where: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (coachUserId) {
      where.push(`m.coach_user_id = $${idx++}`);
      params.push(coachUserId);
    }
    if (parentUserId) {
      // parent is associated with the wrestler
      where.push(`w.parent_user_id = $${idx++}`);
      params.push(parentUserId);
    }
    if (needId) {
      where.push(`m.coach_need_id = $${idx++}`);
      params.push(needId);
    }
    if (wrestlerId) {
      where.push(`w.id = $${idx++}`);
      params.push(wrestlerId);
    }
    if (statusParam !== "all") {
      where.push(`m.status = $${idx++}`);
      params.push(statusParam);
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    // Schema used:
    // - matches: id, coach_need_id, coach_user_id, wrestler_interest_id, status, parent_ok, coach_ok, confirmed_at, created_at, updated_at
    // - wrestler_interests: id, wrestler_id, notes, event_date (optional)
    // - wrestlers: id, parent_user_id, first_name, last_name
    // - coach_needs: id, coach_user_id, event_name, event_date, weight_class, age_group
    // - teams: teamid, teamname, coach_name, contactemail, userid, logopath
    // - users: id, name, email, ...
    const sql = `
      SELECT
        m.id,
        m.status,
        m.parent_ok,
        m.coach_ok,
        m.confirmed_at,
        m.created_at,

        cn.event_name,
        cn.event_date,
        cn.weight_class,
        cn.age_group,
        wi.notes,

        w.first_name  AS wrestler_first_name,
        w.last_name   AS wrestler_last_name,

        t.teamid      AS team_id,
        t.teamname    AS team_name,
        COALESCE(t.coach_name, u.name) AS team_coach_name,
        t.logopath    AS team_logo_path
      FROM matches m
      JOIN wrestler_interests wi ON wi.id = m.wrestler_interest_id
      JOIN wrestlers          w  ON w.id = wi.wrestler_id
      JOIN coach_needs        cn ON cn.id = m.coach_need_id
      LEFT JOIN teams         t  ON t.userid = cn.coach_user_id
      LEFT JOIN users         u  ON u.id = cn.coach_user_id
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

    // Ensure the need exists (and get coach_user_id)
    const { rows: needRows } = await client.query(
      `SELECT id, coach_user_id
       FROM coach_needs
       WHERE id = $1`,
      [needId]
    );
    if (!needRows.length) {
      await client.query("ROLLBACK");
      return jsonError("Coach need not found", 404);
    }
    const need = needRows[0];

    // Ensure the interest exists
    const { rows: interestRows } = await client.query(
      `SELECT id, wrestler_id
       FROM wrestler_interests
       WHERE id = $1`,
      [interestId]
    );
    if (!interestRows.length) {
      await client.query("ROLLBACK");
      return jsonError("Wrestler interest not found", 404);
    }

    // Check for existing non-cancelled match between this need & interest
    const { rows: existingRows } = await client.query(
      `SELECT *
       FROM matches
       WHERE coach_need_id = $1
         AND wrestler_interest_id = $2
         AND status <> 'cancelled'
       LIMIT 1`,
      [needId, interestId]
    );

    let matchRow;

    if (existingRows.length) {
      // Update existing match's ok flags and maybe status
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
        `UPDATE matches
         SET coach_ok = $1,
             parent_ok = $2,
             status   = CASE WHEN $3 THEN 'confirmed' ELSE status END,
             confirmed_at = CASE WHEN $3 AND status <> 'confirmed'
                                 THEN NOW() ELSE confirmed_at END,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [coachOk, parentOk, isConfirmed, m.id]
      );

      matchRow = updated[0];
    } else {
      // Insert new pending match
      const coachOk = side === "coach";
      const parentOk = side === "parent";

      const { rows: inserted } = await client.query(
        `INSERT INTO matches (
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
         RETURNING *`,
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
