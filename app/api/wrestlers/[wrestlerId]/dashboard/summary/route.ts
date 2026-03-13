import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

let resolved: null | {
  tMessages: string;
  tMatches: string;
  tInterests: string;
  tWrestlers: string;
  colMsgMatchId: string;
  colMsgReadAt: string | null;
  colMatchId: string;
  colMatchInterestId: string;
  colMatchStatus: string;
  colInterestId: string;
  colInterestWrestlerId: string;
  colInterestEventName: string | null;
  colWrestlerId: string;
  colWrestlerFirstName: string | null;
  colWrestlerLastName: string | null;
  colWrestlerAgeGroup: string | null;
  colWrestlerWeightClass: string | null;
  colWrestlerCity: string | null;
  colWrestlerState: string | null;
  colWrestlerNotes: string | null;
} = null;

async function tableExists(q: string) {
  const { rows } = await pool.query(`SELECT to_regclass($1) AS r`, [q]);
  return !!rows[0]?.r;
}

async function columnExists(tbl: string, col: string) {
  const { rows } = await pool.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
    `,
    [tbl, col]
  );
  return rows.length > 0;
}

async function resolveSchema() {
  if (resolved) return resolved;

  const tMessages = (await tableExists("public.messages"))
    ? "messages"
    : (await tableExists('public."Messages"'))
    ? '"Messages"'
    : "messages";

  const tMatches = (await tableExists("public.matches"))
    ? "matches"
    : (await tableExists('public."Matches"'))
    ? '"Matches"'
    : "matches";

  const tInterests = (await tableExists("public.wrestler_interests"))
    ? "wrestler_interests"
    : (await tableExists('public."WrestlerInterests"'))
    ? '"WrestlerInterests"'
    : "wrestler_interests";

  const tWrestlers = (await tableExists("public.wrestlers"))
    ? "wrestlers"
    : (await tableExists('public."Wrestlers"'))
    ? '"Wrestlers"'
    : "wrestlers";

  const mName = tMessages.startsWith('"') ? tMessages.slice(1, -1) : tMessages;
  const mtName = tMatches.startsWith('"') ? tMatches.slice(1, -1) : tMatches;
  const wiName = tInterests.startsWith('"')
    ? tInterests.slice(1, -1)
    : tInterests;
  const wName = tWrestlers.startsWith('"')
    ? tWrestlers.slice(1, -1)
    : tWrestlers;

  const colMsgMatchId = (await columnExists(mName, "match_id"))
    ? "match_id"
    : '"matchId"';

  const colMsgReadAt = (await columnExists(mName, "read_at"))
    ? "read_at"
    : (await columnExists(mName, "readAt"))
    ? '"readAt"'
    : null;

  const colMatchId = (await columnExists(mtName, "id")) ? "id" : '"id"';

  const colMatchInterestId = (await columnExists(mtName, "wrestler_interest_id"))
    ? "wrestler_interest_id"
    : (await columnExists(mtName, "interest_id"))
    ? "interest_id"
    : (await columnExists(mtName, "wrestlerInterestId"))
    ? '"wrestlerInterestId"'
    : '"interestId"';

  const colMatchStatus = (await columnExists(mtName, "status"))
    ? "status"
    : '"status"';

  const colInterestId = (await columnExists(wiName, "id")) ? "id" : '"id"';

  const colInterestWrestlerId = (await columnExists(wiName, "wrestler_id"))
    ? "wrestler_id"
    : '"wrestlerId"';

  const colInterestEventName = (await columnExists(wiName, "event_name"))
    ? "event_name"
    : (await columnExists(wiName, "eventName"))
    ? '"eventName"'
    : null;

  const colWrestlerId = (await columnExists(wName, "id")) ? "id" : '"id"';

  const colWrestlerFirstName = (await columnExists(wName, "first_name"))
    ? "first_name"
    : (await columnExists(wName, "firstname"))
    ? "firstname"
    : null;

  const colWrestlerLastName = (await columnExists(wName, "last_name"))
    ? "last_name"
    : (await columnExists(wName, "lastname"))
    ? "lastname"
    : null;

  const colWrestlerAgeGroup = (await columnExists(wName, "age_group"))
    ? "age_group"
    : (await columnExists(wName, "agegroup"))
    ? "agegroup"
    : null;

  const colWrestlerWeightClass = (await columnExists(wName, "weight_class"))
    ? "weight_class"
    : (await columnExists(wName, "weightclass"))
    ? "weightclass"
    : null;

  const colWrestlerCity = (await columnExists(wName, "city"))
    ? "city"
    : null;

  const colWrestlerState = (await columnExists(wName, "state"))
    ? "state"
    : null;

  const colWrestlerNotes = (await columnExists(wName, "notes"))
    ? "notes"
    : null;

  resolved = {
    tMessages,
    tMatches,
    tInterests,
    tWrestlers,
    colMsgMatchId,
    colMsgReadAt,
    colMatchId,
    colMatchInterestId,
    colMatchStatus,
    colInterestId,
    colInterestWrestlerId,
    colInterestEventName,
    colWrestlerId,
    colWrestlerFirstName,
    colWrestlerLastName,
    colWrestlerAgeGroup,
    colWrestlerWeightClass,
    colWrestlerCity,
    colWrestlerState,
    colWrestlerNotes,
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

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { ok: false, message: "Invalid wrestler id" },
        { status: 400 }
      );
    }

    const s = await resolveSchema();

    const wrestlerSql = `
      SELECT
        ${s.colWrestlerId} AS id,
        ${s.colWrestlerFirstName ? `${s.colWrestlerFirstName} AS first_name,` : `NULL::text AS first_name,`}
        ${s.colWrestlerLastName ? `${s.colWrestlerLastName} AS last_name,` : `NULL::text AS last_name,`}
        ${s.colWrestlerAgeGroup ? `${s.colWrestlerAgeGroup} AS age_group,` : `NULL::text AS age_group,`}
        ${s.colWrestlerWeightClass ? `${s.colWrestlerWeightClass} AS weight_class,` : `NULL::text AS weight_class,`}
        ${s.colWrestlerCity ? `${s.colWrestlerCity} AS city,` : `NULL::text AS city,`}
        ${s.colWrestlerState ? `${s.colWrestlerState} AS state,` : `NULL::text AS state,`}
        ${s.colWrestlerNotes ? `${s.colWrestlerNotes} AS notes` : `NULL::text AS notes`}
      FROM ${s.tWrestlers}
      WHERE ${s.colWrestlerId} = $1
      LIMIT 1
    `;

    const wrestler = await pool
      .query(wrestlerSql, [id])
      .then((r) => r.rows[0] ?? null);

    if (!wrestler) {
      return NextResponse.json(
        { ok: false, message: "Wrestler not found" },
        { status: 404 }
      );
    }

    const matchSql = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE ${s.colMatchStatus} = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE ${s.colMatchStatus} = 'confirmed')::int AS confirmed
      FROM ${s.tMatches} mt
      JOIN ${s.tInterests} wi
        ON wi.${s.colInterestId} = mt.${s.colMatchInterestId}
      WHERE wi.${s.colInterestWrestlerId} = $1
    `;

    const mc = await pool
      .query(matchSql, [id])
      .then((r) => r.rows[0] ?? { total: 0, pending: 0, confirmed: 0 });

    const totalSql = `
      SELECT COUNT(*)::int AS total
      FROM ${s.tMessages} m
      JOIN ${s.tMatches} mt
        ON mt.${s.colMatchId} = m.${s.colMsgMatchId}
      JOIN ${s.tInterests} wi
        ON wi.${s.colInterestId} = mt.${s.colMatchInterestId}
      WHERE wi.${s.colInterestWrestlerId} = $1
    `;

    const msgTotal = await pool
      .query(totalSql, [id])
      .then((r) => r.rows[0]?.total ?? 0);

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

      unread = await pool
        .query(unreadSql, [id])
        .then((r) => r.rows[0]?.unread ?? 0);
    }

    let eventName: string | null = null;

    if (s.colInterestEventName) {
      const eventSql = `
        SELECT wi.${s.colInterestEventName} AS event_name
        FROM ${s.tInterests} wi
        WHERE wi.${s.colInterestWrestlerId} = $1
          AND wi.${s.colInterestEventName} IS NOT NULL
          AND TRIM(CAST(wi.${s.colInterestEventName} AS text)) <> ''
        ORDER BY wi.${s.colInterestId} DESC
        LIMIT 1
      `;

      eventName = await pool
        .query(eventSql, [id])
        .then((r) => r.rows[0]?.event_name ?? null);
    }

    const firstName = wrestler.first_name ?? null;
    const lastName = wrestler.last_name ?? null;
    const combinedName =
      [firstName, lastName].filter(Boolean).join(" ").trim() || null;

    const data = {
      ok: true,
      summary: {
        id: wrestler.id,
        name: combinedName,
        first_name: firstName,
        last_name: lastName,
        age_group: wrestler.age_group ?? null,
        weight_class: wrestler.weight_class ?? null,
        city: wrestler.city ?? null,
        state: wrestler.state ?? null,
        notes: wrestler.notes ?? null,
        event_name: eventName,
      },
      matches: {
        total: mc.total,
        pending: mc.pending,
        confirmed: mc.confirmed,
      },
      messages: {
        total: msgTotal,
        unread,
      },
    };

    const res = NextResponse.json(data);
    res.headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=15, stale-while-revalidate=60"
    );
    return res;
  } catch (e) {
    console.error("wrestler dashboard summary GET error:", e);
    return NextResponse.json(
      { ok: false, message: "Failed to build summary" },
      { status: 500 }
    );
  }
}