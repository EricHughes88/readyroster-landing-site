// app/api/wrestlers/[wrestlerId]/interests/route.ts
import { NextResponse } from "next/server";
import pg from "pg";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { Pool } = pg;
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

/* ---------- Schemas ---------- */

const CreateSchema = z.object({
  eventName: z.string().min(1),
  eventDate: z.string().trim().optional().nullable(), // YYYY-MM-DD
  weightClass: z.string().min(1),
  ageGroup: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const SORT_WHITELIST = new Map<string, string>([
  ["event_name", "event_name"],
  ["event_date", "event_date"],
  ["weight_class", "weight_class"],
  ["age_group", "age_group"],
  ["created_at", "created_at"],
]);

/* ---------- GET: list interests for one wrestler ---------- */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ wrestlerId: string }> }
) {
  try {
    if (!pool) return NextResponse.json({ ok: true, interests: [], page: { limit: 10, offset: 0, total: 0 } });

    const { wrestlerId } = await ctx.params;
    const wid = Number(wrestlerId);
    if (!Number.isFinite(wid) || wid <= 0) {
      return NextResponse.json({ ok: false, message: "Invalid wrestler id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const eventName = url.searchParams.get("eventName") || "";
    const ageGroup  = url.searchParams.get("ageGroup")  || "";
    const onlyOk    = url.searchParams.get("onlyOk")    || ""; // "parent" | "coach" | ""
    const limit     = Math.min(Math.max(Number(url.searchParams.get("limit") || 10), 1), 100);
    const offset    = Math.max(Number(url.searchParams.get("offset") || 0), 0);

    // sort=column:dir (dir=asc|desc)
    let sortCol = "created_at";
    let sortDir: "asc" | "desc" = "desc";
    const sortRaw = url.searchParams.get("sort") || "";
    if (sortRaw) {
      const [c, d] = sortRaw.split(":");
      const col = SORT_WHITELIST.get(c || "");
      const dir = (d || "").toLowerCase() === "asc" ? "asc" : "desc";
      if (col) { sortCol = col; sortDir = dir; }
    }

    const where: string[] = ["wrestler_id = $1"];
    const params: any[] = [wid];

    if (eventName) { params.push(`%${eventName}%`); where.push("event_name ILIKE $" + params.length); }
    if (ageGroup)  { params.push(`%${ageGroup}%`);   where.push("age_group  ILIKE $" + params.length); }

    if (onlyOk === "parent") where.push("COALESCE(parent_ok, false) = true");
    if (onlyOk === "coach")  where.push("COALESCE(coach_ok,  false) = true");

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const client = await pool.connect();
    try {
      const countRes = await client.query(
        `SELECT COUNT(*)::int AS c FROM public.wrestler_interests ${whereSql}`,
        params
      );
      const total = countRes.rows[0]?.c ?? 0;

      params.push(limit, offset);
      const res = await client.query(
        `SELECT id, wrestler_id, event_name, event_date, weight_class, age_group,
                notes, parent_ok, coach_ok, created_at
           FROM public.wrestler_interests
           ${whereSql}
           ORDER BY ${sortCol} ${sortDir}
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return NextResponse.json({
        ok: true,
        interests: res.rows,
        page: { limit, offset, total },
      });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("interests GET error:", e);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}

/* ---------- POST: create interest for one wrestler ---------- */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ wrestlerId: string }> }
) {
  try {
    if (!pool) return NextResponse.json({ ok: false, message: "DB not configured" }, { status: 500 });

    const { wrestlerId } = await ctx.params;
    const wid = Number(wrestlerId);
    if (!Number.isFinite(wid) || wid <= 0) {
      return NextResponse.json({ ok: false, message: "Invalid wrestler id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Invalid input", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { eventName, eventDate, weightClass, ageGroup, notes } = parsed.data;

    const client = await pool.connect();
    try {
      const r = await client.query(
        `INSERT INTO public.wrestler_interests
           (wrestler_id, event_name, event_date, weight_class, age_group, notes)
         VALUES ($1, $2, $3::date, $4, $5, $6)
         RETURNING id`,
        [wid, eventName, eventDate || null, weightClass, ageGroup, notes || null]
      );
      return NextResponse.json({ ok: true, id: r.rows[0]?.id }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("interests POST error:", e);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
