import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

let resolved: null | {
  tMessages: string; tMatches: string; tInterests: string;
  colMsgMatchId: string; colMsgReadAt: string | null;
  colMatchId: string; colMatchInterestId: string; colMatchStatus: string;
  colInterestId: string; colInterestWrestlerId: string;
} = null;

async function tableExists(q: string) {
  const { rows } = await pool.query(`SELECT to_regclass($1) AS r`, [q]); return !!rows[0]?.r;
}
async function columnExists(tbl: string, col: string) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`,
    [tbl, col]
  ); return rows.length > 0;
}

async function resolveSchema() {
  if (resolved) return resolved;
  const tMessages = (await tableExists("public.messages")) ? "messages" :
                    (await tableExists('public."Messages"')) ? '"Messages"' : "messages";
  const tMatches  = (await tableExists("public.matches")) ? "matches" :
                    (await tableExists('public."Matches"')) ? '"Matches"' : "matches";
  const tInterests= (await tableExists("public.wrestler_interests")) ? "wrestler_interests" :
                    (await tableExists('public."WrestlerInterests"')) ? '"WrestlerInterests"' : "wrestler_interests";

  const mName  = tMessages.startsWith('"') ? tMessages.slice(1,-1) : tMessages;
  const mtName = tMatches.startsWith('"')  ? tMatches.slice(1,-1)  : tMatches;
  const wiName = tInterests.startsWith('"')? tInterests.slice(1,-1): tInterests;

  const colMsgMatchId      = (await columnExists(mName,  "match_id")) ? "match_id" : '"matchId"';
  const colMsgReadAt       = (await columnExists(mName,  "read_at"))  ? "read_at"  :
                             (await columnExists(mName,  "readAt"))   ? '"readAt"' : null;
  const colMatchId         = (await columnExists(mtName, "id")) ? "id" : '"id"';
  const colMatchInterestId = (await columnExists(mtName, "wrestler_interest_id")) ? "wrestler_interest_id" : '"wrestlerInterestId"';
  const colMatchStatus     = (await columnExists(mtName, "status")) ? "status" : '"status"';
  const colInterestId      = (await columnExists(wiName, "id")) ? "id" : '"id"';
  const colInterestWrestlerId = (await columnExists(wiName, "wrestler_id")) ? "wrestler_id" : '"wrestlerId"';

  resolved = { tMessages:tMessages, tMatches, tInterests,
    colMsgMatchId, colMsgReadAt, colMatchId, colMatchInterestId, colMatchStatus,
    colInterestId, colInterestWrestlerId
  };
  return resolved;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ wrestlerId: string }> }
) {
  try {
    const { wrestlerId } = await ctx.params;
    const id = Number(wrestlerId);
    if (!id) return NextResponse.json({ ok:false, message:"Invalid wrestler id" }, { status:400 });

    const s = await resolveSchema();

    // Matches (pending/confirmed)
    const matchSql = `
      SELECT
        COUNT(*)::int                                                        AS total,
        COUNT(*) FILTER (WHERE ${s.colMatchStatus}='pending')::int           AS pending,
        COUNT(*) FILTER (WHERE ${s.colMatchStatus}='confirmed')::int         AS confirmed
      FROM ${s.tMatches} mt
      JOIN ${s.tInterests} wi ON wi.${s.colInterestId}=mt.${s.colMatchInterestId}
      WHERE wi.${s.colInterestWrestlerId}=$1
    `;
    const mc = await pool.query(matchSql, [id]).then(r => r.rows[0] ?? { total:0, pending:0, confirmed:0 });

    // Messages (total + unread if column exists)
    const totalSql = `
      SELECT COUNT(*)::int AS total
      FROM ${s.tMessages} m
      JOIN ${s.tMatches} mt ON mt.${s.colMatchId}=m.${s.colMsgMatchId}
      JOIN ${s.tInterests} wi ON wi.${s.colInterestId}=mt.${s.colMatchInterestId}
      WHERE wi.${s.colInterestWrestlerId}=$1
    `;
    const msgTotal = await pool.query(totalSql, [id]).then(r => r.rows[0]?.total ?? 0);

    let unread: number | null = null;
    if (s.colMsgReadAt) {
      const unreadSql = `
        SELECT COUNT(*)::int AS unread
        FROM ${s.tMessages} m
        JOIN ${s.tMatches} mt ON mt.${s.colMatchId}=m.${s.colMsgMatchId}
        JOIN ${s.tInterests} wi ON wi.${s.colInterestId}=mt.${s.colMatchInterestId}
        WHERE wi.${s.colInterestWrestlerId}=$1 AND m.${s.colMsgReadAt} IS NULL
      `;
      unread = await pool.query(unreadSql, [id]).then(r => r.rows[0]?.unread ?? 0);
    }

    const data = { ok:true, matches:{ total: mc.total, pending: mc.pending, confirmed: mc.confirmed },
                   messages:{ total: msgTotal, unread } };

    const res = NextResponse.json(data);
    res.headers.set("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=60");
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok:false, message:"Failed to build summary" }, { status:500 });
  }
}
