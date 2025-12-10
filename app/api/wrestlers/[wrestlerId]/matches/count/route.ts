import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db"; // adjust if your Pool export lives elsewhere

let resolved: null | {
  tMatches: string;
  tInterests: string;
  colMatchStatus: string;         // matches.status or "status"
  colMatchInterestId: string;     // matches.wrestler_interest_id or "wrestlerInterestId"
  colInterestId: string;          // wrestler_interests.id or "id"
  colInterestWrestlerId: string;  // wrestler_interests.wrestler_id or "wrestlerId"
} = null;

async function tableExists(qualified: string) {
  const { rows } = await pool.query(`SELECT to_regclass($1) AS r`, [qualified]);
  return !!rows[0]?.r;
}
async function columnExists(exactTableName: string, col: string) {
  const sql = `
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1 AND column_name=$2
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [exactTableName, col]);
  return rows.length > 0;
}

async function resolveSchema() {
  if (resolved) return resolved;

  const tMatches =
    (await tableExists("public.matches")) ? "matches" :
    (await tableExists('public."Matches"')) ? '"Matches"' : "matches";

  const tInterests =
    (await tableExists("public.wrestler_interests")) ? "wrestler_interests" :
    (await tableExists('public."WrestlerInterests"')) ? '"WrestlerInterests"' : "wrestler_interests";

  const matchesName   = tMatches.startsWith('"') ? tMatches.slice(1, -1) : tMatches;
  const interestsName = tInterests.startsWith('"') ? tInterests.slice(1, -1) : tInterests;

  const colMatchStatus = (await columnExists(matchesName, "status")) ? "status" : '"status"';
  const colMatchInterestId = (await columnExists(matchesName, "wrestler_interest_id"))
    ? "wrestler_interest_id" : '"wrestlerInterestId"';
  const colInterestId = (await columnExists(interestsName, "id")) ? "id" : '"id"';
  const colInterestWrestlerId = (await columnExists(interestsName, "wrestler_id"))
    ? "wrestler_id" : '"wrestlerId"';

  resolved = {
    tMatches,
    tInterests,
    colMatchStatus,
    colMatchInterestId,
    colInterestId,
    colInterestWrestlerId,
  };
  return resolved;
}

// NOTE: In Next's async dynamic APIs, `params` is a Promise — await it.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ wrestlerId: string }> }
) {
  try {
    const { wrestlerId } = await ctx.params;
    const id = Number(wrestlerId);
    if (!id) {
      return NextResponse.json(
        { ok: false, message: "Invalid wrestler id" },
        { status: 400 }
      );
    }

    const s = await resolveSchema();

    const sql = `
      SELECT
        COUNT(*)::int                                                        AS total,
        COUNT(*) FILTER (WHERE ${s.colMatchStatus} = 'pending')::int         AS pending,
        COUNT(*) FILTER (WHERE ${s.colMatchStatus} = 'confirmed')::int       AS confirmed
      FROM ${s.tMatches} mt
      JOIN ${s.tInterests} wi
        ON wi.${s.colInterestId} = mt.${s.colMatchInterestId}
      WHERE wi.${s.colInterestWrestlerId} = $1
    `;

    const row = await pool
      .query(sql, [id])
      .then((r) => r.rows[0] ?? { total: 0, pending: 0, confirmed: 0 });

    return NextResponse.json({
      ok: true,
      total: row.total ?? 0,
      pending: row.pending ?? 0,
      confirmed: row.confirmed ?? 0,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, message: "Failed to count matches" },
      { status: 500 }
    );
  }
}
