// app/api/wrestlers/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import pg from "pg";
const { Pool } = pg;

import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

// ----- Validation (city/state required because DB enforces NOT NULL on city) -----
const WrestlerSchema = z.object({
  // userId removed from the public contract; we’ll take it from the session
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional().nullable(),
  dob: z.string().optional().nullable(), // YYYY-MM-DD
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  age: z.number().int().min(3).max(25).optional().nullable(),
  weightClass: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type ColInfo = { original: string; lc: string };

async function getWrestlersColumns(client: pg.PoolClient): Promise<ColInfo[]> {
  const res = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'wrestlers'`
  );
  return res.rows.map((r) => ({ original: r.column_name, lc: r.column_name.toLowerCase() }));
}

function mapByLower(cols: ColInfo[]): Map<string, string> {
  const m = new Map<string, string>();
  cols.forEach((c) => m.set(c.lc, c.original));
  return m;
}

// Find the FK column to users; supports your schema's parent_user_id.
async function findUserIdColumn(client: pg.PoolClient, cols: ColInfo[]): Promise<string | null> {
  const byLc = mapByLower(cols);

  const candidates = [
    "parent_user_id",
    "user_id",
    "userid",
    "users_id",
    "owner_id",
    "parent_id",
    "account_id",
    "created_by",
    "user",
    "user_fk",
    "userref",
  ];
  for (const c of candidates) if (byLc.has(c)) return byLc.get(c)!;

  const fk = await client.query(
    `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema   = tc.table_schema
        AND kcu.table_name     = tc.table_name
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema    = tc.table_schema
      WHERE tc.constraint_type  = 'FOREIGN KEY'
        AND tc.table_schema     = 'public'
        AND tc.table_name       = 'wrestlers'
        AND ccu.table_name      = 'users'
      LIMIT 1`
  );
  if (fk.rowCount && fk.rows[0]?.column_name) return fk.rows[0].column_name as string;

  const anyUser = cols.find((c) => c.lc.includes("user"));
  return anyUser?.original ?? null;
}

function pickSortColumn(cols: ColInfo[], userIdCol: string): string {
  const byLc = mapByLower(cols);
  if (byLc.has("id")) return byLc.get("id")!;
  if (byLc.has("wrestler_id")) return byLc.get("wrestler_id")!;
  if (byLc.has("created_at")) return byLc.get("created_at")!;
  if (byLc.has("createdat")) return byLc.get("createdat")!;
  return userIdCol;
}

/* ===================== POST /api/wrestlers ===================== */
export async function POST(req: Request) {
  try {
    const session = await auth();
    const parentId = Number((session?.user as any)?.id);
    if (!Number.isFinite(parentId)) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const raw = await req.json();
    const parsed = WrestlerSchema.safeParse({
      ...raw,
      age: raw?.age === "" || raw?.age == null ? undefined : Number(raw.age),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (!pool) {
      return NextResponse.json(
        { ok: true, wrestler: { id: 1, parent_user_id: parentId, ...parsed.data } },
        { status: 201 }
      );
    }

    const client = await pool.connect();
    try {
      // Verify the parent exists
      const userRes = await client.query(
        `SELECT 1 FROM public.users WHERE COALESCE(id, user_id) = $1 LIMIT 1`,
        [parentId]
      );
      if ((userRes.rowCount ?? 0) === 0) {
        return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
      }

      const cols = await getWrestlersColumns(client);
      const byLc = mapByLower(cols);
      const userIdCol = await findUserIdColumn(client, cols);
      if (!userIdCol) {
        return NextResponse.json(
          { ok: false, message: "Could not find a user id column in wrestlers table" },
          { status: 500 }
        );
      }

      // Build insert based on existing columns
      const colMap: Record<string, string | null> = {
        user_id: userIdCol,
        first_name: byLc.get("first_name") ?? byLc.get("firstname") ?? null,
        last_name: byLc.get("last_name") ?? byLc.get("lastname") ?? null,
        dob: byLc.get("dob") ?? null,
        city: byLc.get("city") ?? null,
        state: byLc.get("state") ?? null,
        age: byLc.get("age") ?? null,
        weight_class: byLc.get("weight_class") ?? byLc.get("weightclass") ?? null,
        notes: byLc.get("notes") ?? null,
      };

      const insertCols: string[] = [];
      const insertVals: any[] = [];

      insertCols.push(colMap.user_id!);
      insertVals.push(parentId); // 🔑 from session

      if (colMap.first_name) { insertCols.push(colMap.first_name); insertVals.push(parsed.data.firstName); }
      if (colMap.last_name && parsed.data.lastName != null) { insertCols.push(colMap.last_name); insertVals.push(parsed.data.lastName); }
      if (colMap.dob && parsed.data.dob != null) { insertCols.push(colMap.dob); insertVals.push(parsed.data.dob); }
      if (colMap.city) { insertCols.push(colMap.city); insertVals.push(parsed.data.city); }           // REQUIRED
      if (colMap.state) { insertCols.push(colMap.state); insertVals.push(parsed.data.state); }        // REQUIRED
      if (colMap.age && parsed.data.age != null) { insertCols.push(colMap.age); insertVals.push(parsed.data.age); }
      if (colMap.weight_class && parsed.data.weightClass != null) { insertCols.push(colMap.weight_class); insertVals.push(parsed.data.weightClass); }
      if (colMap.notes && parsed.data.notes != null) { insertCols.push(colMap.notes); insertVals.push(parsed.data.notes); }

      const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(", ");

      const idCol = byLc.get("id") ?? byLc.get("wrestler_id") ?? null;
      const sql =
        `INSERT INTO public.wrestlers (${insertCols.join(", ")})
         VALUES (${placeholders})
         ${idCol ? `RETURNING ${idCol} AS id` : ""}`;

      const res = await client.query(sql, insertVals);
      const newId = idCol ? res.rows[0]?.id : undefined;

      return NextResponse.json(
        { ok: true, wrestler: { id: newId, parent_user_id: parentId, ...parsed.data } },
        { status: 201 }
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Wrestlers POST error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}

/* ===================== GET /api/wrestlers ===================== */
export async function GET() {
  try {
    const session = await auth();
    const parentId = Number((session?.user as any)?.id);
    if (!Number.isFinite(parentId)) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    if (!pool) return NextResponse.json({ ok: true, wrestlers: [] }, { status: 200 });

    const client = await pool.connect();
    try {
      const cols = await getWrestlersColumns(client);
      const userIdCol = await findUserIdColumn(client, cols);
      if (!userIdCol) {
        return NextResponse.json(
          { ok: false, message: "Could not find a user id column in wrestlers table" },
          { status: 500 }
        );
      }
      const sortCol = pickSortColumn(cols, userIdCol);

      const res = await client.query(
        `SELECT * FROM public.wrestlers
          WHERE ${userIdCol} = $1
          ORDER BY ${sortCol} DESC`,
        [parentId] // 🔑 casted number from session
      );

      return NextResponse.json({ ok: true, wrestlers: res.rows }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Wrestlers GET error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
