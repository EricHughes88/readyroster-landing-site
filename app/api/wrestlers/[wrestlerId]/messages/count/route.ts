import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

let resolved: null | {
  tMessages: string;
  tMatches: string;
  tInterests: string;
  colMsgMatchId: string;
  colMsgReadAt: string | null;
  colMatchId: string;
  colMatchInterestId: string;
  colInterestId: string;
  colInterestWrestlerId: string;
} = null;

async function tableExists(qualified: string) {
  const { rows } = await pool.query(`SELECT to_regclass($1) AS r`, [qualified]);
  return !!rows[0]?.r;
}
async function columnExists(exactTable: string, col: string) {
  const sql = `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1 AND column_name=$2
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [exactTable, col]);
  return rows.length > 0;
}

async function resolveSchema() {
  if (resolved) return resolved;

  const tMessages =
    (await tableExists("public.messages")) ? "messages" :
    (await tableExists('public."Messages"')) ? '"Messages"' : "messages";

  const tMatches =
    (await tableExists("public.matches")) ? "matches" :
    (await tableExists('public."Matches"')) ? '"Matches"' : "matches";

  const tInterests =
    (await tableExists("public.wrestler_interests")) ? "wrestler_interests" :
    (await tableExists('public."WrestlerInterests"')) ? '"WrestlerInterests"' : "wrestler_interests";

  const msgName = tMessages.startsWith('"') ? tMessages.slice(1, -1) : tMessages;
  const matName = tMatches.startsWith('"') ? tMatches.slice(1, -1) : tMatches;
  const intName = tInterests.startsWith('"') ? tInterests.slice(1, -1) : tInterests;

  const colMsgMatchId       = (await columnExists(msgName, "match_id")) ? "match_id" : '"matchId"';
  const colMsgReadAt        = (await columnExists(msgName, "read_at")) ? "read_at"
                               : (await columnExists(msgName, "readAt")) ? '"readAt"' : null;
  const colMatchId          = (await columnExists(matName, "id")) ? "id" : '"id"';
  const colMatchInterestId  = (await columnExists(matName, "wrestler_interest_id"))
                               ? "wrestler_interest_id" : '"wrestlerInterestId"';
  const colInterestId       = (await columnExists(intName, "id")) ? "id" : '"id"';
  const colInterestWrestlerId = (await columnExists(intName, "wrestler_id"))
                               ? "wrestler_id" : '"wrestlerId"';

  resolved = {
    tMessages, tMatches, tInterests,
    colMsgMatchId, colMsgReadAt,
    colMatchId, colMatchInterestId,
    colInterestId, colInterestWrestlerId,
  };
  return resolved;
}

/**
 * IMPORTANT: In async dynamic APIs, `params` is a Promise.
 * Use the `ctx` form and `await ctx.params` before reading properties.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ wrestlerId: string }> }
) {
  try {
    const { wrestlerId } = await ctx.params; // <-- this is the fix
    const id = Number(wrestlerId);
    if (!id) {
      return NextResponse.json({ ok: false, message: "Invalid wrestler id" }, { status: 400 });
    }

    const s = await resolveSchema();

    const totalSql = `
      SELECT COUNT(*)::int AS total
      FROM ${s.tMessages} m
      JOIN ${s.tMatches} mt
        ON mt.${s.colMatchId} = m.${s.colMsgMatchId}
      JOIN ${s.tInterests} wi
        ON wi.${s.colInterestId} = mt.${s.colMatchInterestId}
      WHERE wi.${s.colInterestWrestlerId} = $1
    `;
    const totalRow = await pool.query(totalSql, [id]).then(r => r.rows[0] ?? { total: 0 });

    let unread: number | null = null;
    if (s.colMsgReadAt) {
      const unreadSql = `
        SELECT COUNT(*)::int AS unread
        FROM ${s.tMessages} m
        JOIN ${s.tMatches} mt
          ON mt.${s.colMatchId} = m.${s.colMsgMatchId}
        JOIN ${s.tInterests} wi
          ON wi.${s.colInterestId} = mt.${s.colMatchInterestId}
        WHERE wi.${s.colInterestWrestlerId} = $1
          AND m.${s.colMsgReadAt} IS NULL
      `;
      const unreadRow = await pool.query(unreadSql, [id]).then(r => r.rows[0]);
      unread = unreadRow?.unread ?? 0;
    }

    return NextResponse.json({ ok: true, total: totalRow.total ?? 0, unread });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, message: "Failed to count messages" }, { status: 500 });
  }
}
