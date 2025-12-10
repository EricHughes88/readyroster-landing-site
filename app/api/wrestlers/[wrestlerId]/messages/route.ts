// app/api/wrestlers/[wrestlerId]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Resolved = {
  tMsg: string; tMat: string; tInt: string;
  cMsgId: string; cMsgMatchId: string; cMsgSenderId: string; cMsgReceiverId: string;
  cMsgText: string; cMsgSentAt: string; cMsgReadAt: string | null;
  cMatId: string; cMatInterestId: string; cMatStatus: string;
  cIntId: string; cIntWrestlerId: string; cIntEventName: string; cIntEventDate: string; cIntWeight: string; cIntAge: string;
};

let R: Resolved | null = null;

async function toRegClass(q: string) {
  const { rows } = await pool.query(`SELECT to_regclass($1) AS r`, [q]);
  return rows[0]?.r ?? null;
}
async function colExists(tableExact: string, col: string) {
  const { rows } = await pool.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 AND column_name=$2
      LIMIT 1`,
    [tableExact, col]
  );
  return rows.length > 0;
}
async function pickCol(tableExact: string, candidates: string[]) {
  for (const c of candidates) {
    const probe = c.startsWith('"') ? c.slice(1, -1) : c; // information_schema stores unquoted
    if (await colExists(tableExact, probe)) return c;
  }
  return candidates[0];
}

async function resolve(): Promise<Resolved> {
  if (R) return R;

  const tMsg =
    (await toRegClass("public.messages")) ? "messages" :
    (await toRegClass('public."Messages"')) ? '"Messages"' : "messages";
  const tMat =
    (await toRegClass("public.matches")) ? "matches" :
    (await toRegClass('public."Matches"')) ? '"Matches"' : "matches";
  const tInt =
    (await toRegClass("public.wrestler_interests")) ? "wrestler_interests" :
    (await toRegClass('public."WrestlerInterests"')) ? '"WrestlerInterests"' : "wrestler_interests";

  const mN  = tMsg.replaceAll('"', "");
  const mtN = tMat.replaceAll('"', "");
  const wiN = tInt.replaceAll('"', "");

  R = {
    tMsg, tMat, tInt,

    // Messages (now detects multiple PK naming styles)
    cMsgId:        await pickCol(mN, ["id", "message_id", "messageid", '"messageId"']),
    cMsgMatchId:   await pickCol(mN, ["match_id", "matchid", '"matchId"']),
    cMsgSenderId:  await pickCol(mN, ["sender_id", "senderid", '"senderId"']),
    cMsgReceiverId:await pickCol(mN, ["receiver_id", "receiverid", '"receiverId"']),
    cMsgText:      await pickCol(mN, ["message_text", "messagetext", '"messageText"']),
    cMsgSentAt:    await pickCol(mN, ["sent_at", "sentat", '"sentAt"']),
    cMsgReadAt:
      (await colExists(mN, "read_at")) ? "read_at" :
      (await colExists(mN, "readat"))  ? "readat"  :
      (await colExists(mN, "readAt"))  ? '"readAt"' : null,

    // Matches
    cMatId:         await pickCol(mtN, ["id", '"id"']),
    cMatInterestId: await pickCol(mtN, ["wrestler_interest_id", "wrestlerinterestid", '"wrestlerInterestId"']),
    cMatStatus:     await pickCol(mtN, ["status", '"status"']),

    // Interests
    cIntId:         await pickCol(wiN, ["id", '"id"']),
    cIntWrestlerId: await pickCol(wiN, ["wrestler_id", "wrestlerid", '"wrestlerId"']),
    cIntEventName:  await pickCol(wiN, ["event_name", "eventname", '"eventName"']),
    cIntEventDate:  await pickCol(wiN, ["event_date", "eventdate", '"eventDate"']),
    cIntWeight:     await pickCol(wiN, ["weight_class", "weightclass", '"weightClass"']),
    cIntAge:        await pickCol(wiN, ["age_group", "agegroup", '"ageGroup"']),
  };

  return R!;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ wrestlerId: string }> }
) {
  try {
    if (!pool) {
      return NextResponse.json({ ok: false, message: "DB unavailable" }, { status: 500 });
    }

    const { wrestlerId } = await ctx.params;
    const wid = Number(wrestlerId);
    if (!wid) return NextResponse.json({ ok: false, message: "Invalid wrestler id" }, { status: 400 });

    const s = await resolve();

    const url = new URL(req.url);
    const matchParam = url.searchParams.get("match");
    const matchId = matchParam !== null ? Number(matchParam) : null;
    const markRead = url.searchParams.get("markRead") === "true";
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 20)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

    // Conversation view
    if (matchId !== null) {
      const authSQL = `
        SELECT 1
        FROM ${s.tMat} m
        JOIN ${s.tInt} wi ON wi.${s.cIntId} = m.${s.cMatInterestId}
        WHERE m.${s.cMatId} = $1 AND wi.${s.cIntWrestlerId} = $2
        LIMIT 1
      `;
      const authRes = await pool.query(authSQL, [matchId, wid]);
      const allowed = (authRes.rowCount ?? 0) > 0;
      if (!allowed) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

      if (markRead && s.cMsgReadAt) {
        await pool.query(
          `UPDATE ${s.tMsg}
             SET ${s.cMsgReadAt} = NOW()
           WHERE ${s.cMsgMatchId} = $1 AND ${s.cMsgReadAt} IS NULL`,
          [matchId]
        );
      }

      const convSQL = `
        SELECT
          ms.${s.cMsgId}          AS id,
          ms.${s.cMsgSenderId}    AS sender_id,
          ms.${s.cMsgReceiverId}  AS receiver_id,
          ms.${s.cMsgText}        AS message_text,
          ms.${s.cMsgSentAt}      AS sent_at,
          ${s.cMsgReadAt ? `ms.${s.cMsgReadAt} AS read_at,` : `NULL::timestamptz AS read_at,`}
          m.${s.cMatStatus}       AS match_status,
          wi.${s.cIntEventName}   AS event_name,
          wi.${s.cIntEventDate}   AS event_date,
          wi.${s.cIntWeight}      AS weight_class,
          wi.${s.cIntAge}         AS age_group
        FROM ${s.tMsg} ms
        JOIN ${s.tMat} m ON m.${s.cMatId} = ms.${s.cMsgMatchId}
        JOIN ${s.tInt} wi ON wi.${s.cIntId} = m.${s.cMatInterestId}
        WHERE ms.${s.cMsgMatchId} = $1
        ORDER BY ms.${s.cMsgSentAt} ASC, ms.${s.cMsgId} ASC
        LIMIT $2 OFFSET $3
      `;
      const messages = await pool.query(convSQL, [matchId, limit, offset]).then(r => r.rows);

      const res = NextResponse.json({ ok: true, matchId, messages, page: { limit, offset } });
      res.headers.set("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=60");
      return res;
    }

    // Threads list (qualify subquery columns with alias `x`)
    const threadsSQL = `
      SELECT
        m.${s.cMatId}              AS match_id,
        m.${s.cMatStatus}          AS match_status,
        wi.${s.cIntEventName}      AS event_name,
        wi.${s.cIntEventDate}      AS event_date,
        wi.${s.cIntWeight}         AS weight_class,
        wi.${s.cIntAge}            AS age_group,
        -- latest preview
        (SELECT x.${s.cMsgText} FROM ${s.tMsg} x
           WHERE x.${s.cMsgMatchId} = m.${s.cMatId}
           ORDER BY x.${s.cMsgSentAt} DESC, x.${s.cMsgId} DESC
           LIMIT 1) AS last_text,
        (SELECT x.${s.cMsgSentAt} FROM ${s.tMsg} x
           WHERE x.${s.cMsgMatchId} = m.${s.cMatId}
           ORDER BY x.${s.cMsgSentAt} DESC, x.${s.cMsgId} DESC
           LIMIT 1) AS last_sent_at,
        ${s.cMsgReadAt ? `(SELECT COUNT(*) FROM ${s.tMsg} x
           WHERE x.${s.cMsgMatchId} = m.${s.cMatId} AND x.${s.cMsgReadAt} IS NULL)::int` : `0`}
           AS unread
      FROM ${s.tMat} m
      JOIN ${s.tInt} wi ON wi.${s.cIntId} = m.${s.cMatInterestId}
      WHERE wi.${s.cIntWrestlerId} = $1
      ORDER BY last_sent_at DESC NULLS LAST, m.${s.cMatId} DESC
      LIMIT $2 OFFSET $3
    `;
    const threads = await pool.query(threadsSQL, [wid, limit, offset]).then(r => r.rows);

    const res = NextResponse.json({ ok: true, threads, page: { limit, offset } });
    res.headers.set("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=60");
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, message: "Failed to fetch messages" }, { status: 500 });
  }
}
