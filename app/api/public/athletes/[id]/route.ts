import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { Pool } = pg;

declare global {
  // eslint-disable-next-line no-var
  var __RR_PUBLIC_ATHLETE_POOL__: pg.Pool | undefined;
}

function getPool() {
  const conn = process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL not set");

  if (!global.__RR_PUBLIC_ATHLETE_POOL__) {
    global.__RR_PUBLIC_ATHLETE_POOL__ = new Pool({
      connectionString: conn,
    });
  }

  return global.__RR_PUBLIC_ATHLETE_POOL__;
}

type ColInfo = { original: string; lc: string };

async function tableExists(client: pg.PoolClient, q: string) {
  const { rows } = await client.query(`SELECT to_regclass($1) AS r`, [q]);
  return !!rows[0]?.r;
}

async function getColumns(client: pg.PoolClient, tableName: string): Promise<ColInfo[]> {
  const { rows } = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );

  return rows.map((r: any) => ({
    original: r.column_name,
    lc: String(r.column_name).toLowerCase(),
  }));
}

function byLower(cols: ColInfo[]) {
  const m = new Map<string, string>();
  cols.forEach((c) => m.set(c.lc, c.original));
  return m;
}

function pick(map: Map<string, string>, ...names: string[]) {
  for (const n of names) {
    if (map.has(n.toLowerCase())) return map.get(n.toLowerCase())!;
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const wrestlerId = Number(params.id);

    if (!Number.isFinite(wrestlerId) || wrestlerId <= 0) {
      return NextResponse.json(
        { ok: false, message: "Invalid athlete id" },
        { status: 400 }
      );
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      const wrestlersTable = (await tableExists(client, "public.wrestlers"))
        ? "wrestlers"
        : (await tableExists(client, 'public."Wrestlers"'))
        ? '"Wrestlers"'
        : "wrestlers";

      const interestsTable = (await tableExists(client, "public.wrestler_interests"))
        ? "wrestler_interests"
        : (await tableExists(client, 'public."WrestlerInterests"'))
        ? '"WrestlerInterests"'
        : (await tableExists(client, "public.interests"))
        ? "interests"
        : (await tableExists(client, 'public."Interests"'))
        ? '"Interests"'
        : "wrestler_interests";

      const wrestlersTableName = wrestlersTable.startsWith('"')
        ? wrestlersTable.slice(1, -1)
        : wrestlersTable;

      const interestsTableName = interestsTable.startsWith('"')
        ? interestsTable.slice(1, -1)
        : interestsTable;

      const wrestlerCols = byLower(await getColumns(client, wrestlersTableName));
      const interestCols = byLower(await getColumns(client, interestsTableName));

      const wId = pick(wrestlerCols, "id", "wrestler_id");
      const wFirst = pick(wrestlerCols, "first_name", "firstname");
      const wLast = pick(wrestlerCols, "last_name", "lastname");
      const wAge = pick(wrestlerCols, "age_group", "agegroup");
      const wWeight = pick(wrestlerCols, "weight_class", "weightclass");
      const wCity = pick(wrestlerCols, "city");
      const wState = pick(wrestlerCols, "state");
      const wNotes = pick(wrestlerCols, "notes");

      if (!wId) {
        return NextResponse.json(
          { ok: false, message: "Could not resolve wrestler id column" },
          { status: 500 }
        );
      }

      const athleteSql = `
        SELECT
          ${wId} AS id,
          ${wFirst ? `${wFirst} AS first_name` : `NULL::text AS first_name`},
          ${wLast ? `${wLast} AS last_name` : `NULL::text AS last_name`},
          ${wAge ? `${wAge} AS age_group` : `NULL::text AS age_group`},
          ${wWeight ? `${wWeight} AS weight_class` : `NULL::text AS weight_class`},
          ${wCity ? `${wCity} AS city` : `NULL::text AS city`},
          ${wState ? `${wState} AS state` : `NULL::text AS state`},
          ${wNotes ? `${wNotes} AS notes` : `NULL::text AS notes`}
        FROM public.${wrestlersTable}
        WHERE ${wId} = $1
        LIMIT 1
      `;

      const athleteRes = await client.query(athleteSql, [wrestlerId]);

      if ((athleteRes.rowCount ?? 0) === 0) {
        return NextResponse.json(
          { ok: false, message: "Athlete not found" },
          { status: 404 }
        );
      }

      const iId = pick(interestCols, "id", "interest_id");
      const iWrestlerId = pick(interestCols, "wrestler_id", "wrestlerid");
      const iEvent = pick(interestCols, "event_name", "eventname");
      const iDate = pick(interestCols, "event_date", "eventdate");
      const iAge = pick(interestCols, "age_group", "agegroup");
      const iWeight = pick(interestCols, "weight_class", "weightclass");
      const iNotes = pick(interestCols, "notes");

      let interests: any[] = [];

      if (iId && iWrestlerId) {
        const interestsSql = `
          SELECT
            ${iId} AS id,
            ${iEvent ? `${iEvent} AS event_name` : `NULL::text AS event_name`},
            ${iDate ? `${iDate} AS event_date` : `NULL::text AS event_date`},
            ${iAge ? `${iAge} AS age_group` : `NULL::text AS age_group`},
            ${iWeight ? `${iWeight} AS weight_class` : `NULL::text AS weight_class`},
            ${iNotes ? `${iNotes} AS notes` : `NULL::text AS notes`}
          FROM public.${interestsTable}
          WHERE ${iWrestlerId} = $1
          ORDER BY ${iDate ? `${iDate} DESC NULLS LAST,` : ""} ${iId} DESC
        `;

        const interestsRes = await client.query(interestsSql, [wrestlerId]);
        interests = interestsRes.rows ?? [];
      }

      const athlete = athleteRes.rows[0];
      const latestInterest = interests[0] ?? null;

      const primaryEvent =
        latestInterest?.event_name ??
        interests.find((i: any) => i.event_name)?.event_name ??
        null;

      const derivedAgeGroup =
        athlete.age_group ??
        latestInterest?.age_group ??
        null;

      const derivedWeightClass =
        athlete.weight_class ??
        latestInterest?.weight_class ??
        null;

      return NextResponse.json({
        ok: true,
        athlete: {
          ...athlete,
          age_group: derivedAgeGroup,
          weight_class: derivedWeightClass,
          event_name: primaryEvent,
        },
        interests,
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("Public athlete GET error:", err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Server error" },
      { status: 500 }
    );
  }
}