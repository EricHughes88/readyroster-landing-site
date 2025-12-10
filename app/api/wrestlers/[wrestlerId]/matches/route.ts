// app/api/wrestlers/[wrestlerId]/matches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

/**
 * Returns matches for a given wrestler with optional filters.
 * Query:
 *   - status: 'pending' | 'confirmed' | 'all' (default 'pending')
 *   - limit: number (default 10)
 *   - offset: number (default 0)
 *
 * Response:
 * {
 *   ok: true,
 *   matches: [{
 *      id, status, parent_ok, coach_ok, confirmed_at, created_at,
 *      event_name, event_date, weight_class, age_group, notes
 *   }],
 *   page: { limit, offset, total }
 * }
 */

type Resolved = {
  tMatches: string;              // matches / "Matches"
  tInterests: string;            // wrestler_interests / "WrestlerInterests"
  colMatchId: string;            // id / "id"
  colMatchStatus: string;        // status / "status"
  colMatchInterestId: string;    // wrestler_interest_id / "wrestlerInterestId"
  colParentOk: string;           // parent_ok / "parentOk"
  colCoachOk: string;            // coach_ok / "coachOk"
  colConfirmedAt: string;        // confirmed_at / "confirmedAt"
  colCreatedAt: string;          // created_at / "createdAt"
  colInterestId: string;         // id / "id"
  colInterestWrestlerId: string; // wrestler_id / "wrestlerId"
  colEventName: string;          // event_name / "eventName"
  colEventDate: string;          // event_date / "eventDate"
  colWeightClass: string;        // weight_class / "weightClass"
  colAgeGroup: string;           // age_group / "ageGroup"
  colNotes: string;              // notes / "notes"
};

let resolved: Resolved | null = null;

async function tableExists(q: string) {
  const { rows } = await pool.query(`SELECT to_regclass($1) AS r`, [q]);
  return !!rows[0]?.r;
}
async function columnExists(tableExact: string, col: string) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`,
    [tableExact, col]
  );
  return rows.length > 0;
}

async function resolveSchema(): Promise<Resolved> {
  if (resolved) return resolved;

  const tMatches =
    (await tableExists("public.matches")) ? "matches" :
    (await tableExists('public."Matches"')) ? '"Matches"' : "matches";

  const tInterests =
    (await tableExists("public.wrestler_interests")) ? "wrestler_interests" :
    (await tableExists('public."WrestlerInterests"')) ? '"WrestlerInterests"' : "wrestler_interests";

  const mName  = tMatches.startsWith('"')  ? tMatches.slice(1,-1)  : tMatches;
  const wiName = tInterests.startsWith('"')? tInterests.slice(1,-1): tInterests;

  const col = async (tbl: string, snake: string, camelQuoted: string) =>
    (await columnExists(tbl, snake)) ? snake : camelQuoted;

  resolved = {
    tMatches,
    tInterests,
    colMatchId:            (await columnExists(mName, "id")) ? "id" : '"id"',
    colMatchStatus:        await col(mName, "status", '"status"'),
    colMatchInterestId:    await col(mName, "wrestler_interest_id", '"wrestlerInterestId"'),
    colParentOk:           await col(mName, "parent_ok", '"parentOk"'),
    colCoachOk:            await col(mName, "coach_ok", '"coachOk"'),
    colConfirmedAt:        await col(mName, "confirmed_at", '"confirmedAt"'),
    colCreatedAt:          await col(mName, "created_at", '"createdAt"'),
    colInterestId:         (await columnExists(wiName, "id")) ? "id" : '"id"',
    colInterestWrestlerId: await col(wiName, "wrestler_id", '"wrestlerId"'),
    colEventName:          await col(wiName, "event_name", '"eventName"'),
    colEventDate:          await col(wiName, "event_date", '"eventDate"'),
    colWeightClass:        await col(wiName, "weight_class", '"weightClass"'),
    colAgeGroup:           await col(wiName, "age_group", '"ageGroup"'),
    colNotes:              await col(wiName, "notes", '"notes"'),
  };
  return resolved!;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ wrestlerId: string }> }
) {
  try {
    const { wrestlerId } = await ctx.params;
    const id = Number(wrestlerId);
    if (!id) return NextResponse.json({ ok: false, message: "Invalid wrestler id" }, { status: 400 });

    const url = new URL(req.url);
    const statusQ = (url.searchParams.get("status") || "pending").toLowerCase();
    const status = statusQ === "all" ? null : (statusQ === "confirmed" ? "confirmed" : "pending");
    const limit  = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 10)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

    const s = await resolveSchema();

    // Count
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM ${s.tMatches} m
      JOIN ${s.tInterests} wi ON wi.${s.colInterestId} = m.${s.colMatchInterestId}
      WHERE wi.${s.colInterestWrestlerId} = $1
      ${status ? `AND m.${s.colMatchStatus} = '${status}'` : ""}
    `;
    const total = await pool.query(countSql, [id]).then(r => r.rows[0]?.total ?? 0);

    // Page
    const listSql = `
      SELECT
        m.${s.colMatchId}          AS id,
        m.${s.colMatchStatus}      AS status,
        m.${s.colParentOk}         AS parent_ok,
        m.${s.colCoachOk}          AS coach_ok,
        m.${s.colConfirmedAt}      AS confirmed_at,
        m.${s.colCreatedAt}        AS created_at,
        wi.${s.colEventName}       AS event_name,
        wi.${s.colEventDate}       AS event_date,
        wi.${s.colWeightClass}     AS weight_class,
        wi.${s.colAgeGroup}        AS age_group,
        wi.${s.colNotes}           AS notes
      FROM ${s.tMatches} m
      JOIN ${s.tInterests} wi ON wi.${s.colInterestId} = m.${s.colMatchInterestId}
      WHERE wi.${s.colInterestWrestlerId} = $1
      ${status ? `AND m.${s.colMatchStatus} = '${status}'` : ""}
      ORDER BY m.${s.colCreatedAt} DESC, m.${s.colMatchId} DESC
      LIMIT $2 OFFSET $3
    `;
    const matches = await pool.query(listSql, [id, limit, offset]).then(r => r.rows);

    const res = NextResponse.json({
      ok: true,
      matches,
      page: { limit, offset, total },
    });
    // small cache for snappy UX
    res.headers.set("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=60");
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, message: "Failed to fetch matches" }, { status: 500 });
  }
}
