// app/api/coach/needs/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accepts coachUserId as string or number; event_date in many formats
const NewNeedSchema = z.object({
  coachUserId: z.coerce.number().int().positive(),
  event_name: z.string().min(1, "event_name is required"),
  event_date: z.union([z.string().min(1), z.date()]).optional().nullable(),
  weight_class: z.string().min(1, "weight_class is required"),
  age_group: z.string().min(1, "age_group is required"),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

// Convert the request body to a plain object (JSON, x-www-form-urlencoded, or multipart/form-data)
async function readBody(req: Request): Promise<Record<string, any>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  // JSON
  if (ct.includes("application/json")) {
    try {
      return await req.json();
    } catch {
      // fall through to formData attempt
    }
  }

  // x-www-form-urlencoded
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }

  // multipart/form-data or anything else we can parse with formData()
  try {
    const fd = await req.formData();
    const out: Record<string, any> = {};
    fd.forEach((v, k) => (out[k] = typeof v === "string" ? v : (v as File).name));
    if (Object.keys(out).length) return out;
  } catch {
    /* ignore */
  }

  // If we get here, try JSON one last time (in case there was no CT header set)
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// yyyy-mm-dd (or null) from various inputs
function normalizeDate(input?: string | Date | null): string | null {
  if (!input) return null;

  if (input instanceof Date && !isNaN(+input)) {
    return input.toISOString().slice(0, 10);
  }

  if (typeof input === "string") {
    const s = input.trim();
    // already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // Try Date parser
    const d = new Date(s);
    if (!isNaN(+d)) return d.toISOString().slice(0, 10);

    // Try MM/DD/YYYY (or M/D/YYYY)
    const parts = s.split(/[^\d]/).map((n) => Number(n));
    if (parts.length >= 3) {
      const [m, d2, y] = parts;
      if (y && m && d2) {
        const dd = new Date(y, m - 1, d2);
        if (!isNaN(+dd)) return dd.toISOString().slice(0, 10);
      }
    }
  }

  return null;
}

/** GET /api/coach/needs?coachUserId=11 */
export async function GET(req: Request) {
  try {
    if (!pool) {
      return NextResponse.json(
        { ok: true, needs: [] },
        { status: 200 }
      );
    }

    const { searchParams } = new URL(req.url);
    const coachUserId = Number(searchParams.get("coachUserId") || "");

    if (!coachUserId) {
      return NextResponse.json(
        { ok: false, message: "coachUserId is required" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT id, coach_user_id, event_name, event_date,
                weight_class, age_group, city, state, notes, is_open, created_at
           FROM public.coach_needs
          WHERE coach_user_id = $1
          ORDER BY created_at DESC`,
        [coachUserId]
      );

      return NextResponse.json({ ok: true, needs: res.rows }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Coach needs GET error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}

/** POST /api/coach/needs  (JSON or FormData) */
export async function POST(req: Request) {
  try {
    if (!pool) {
      return NextResponse.json(
        { ok: false, message: "Database not configured" },
        { status: 500 }
      );
    }

    const raw = await readBody(req);
    // Normalize date before validation to avoid schema failures
    if (raw.event_date) raw.event_date = normalizeDate(raw.event_date);

    const parsed = NewNeedSchema.safeParse(raw);
    if (!parsed.success) {
      // Surface zod messages for debugging in the client
      return NextResponse.json(
        { ok: false, message: "Invalid input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const v = parsed.data;
    const client = await pool.connect();

    try {
      const res = await client.query(
        `INSERT INTO public.coach_needs
           (coach_user_id, event_name, event_date, weight_class, age_group, city, state, notes, is_open)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, true)
         RETURNING id`,
        [
          v.coachUserId,
          v.event_name,
          v.event_date ?? null,
          v.weight_class,
          v.age_group,
          v.city ?? null,
          v.state ?? null,
          v.notes ?? null,
        ]
      );

      return NextResponse.json({ ok: true, id: res.rows[0].id }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Coach needs POST error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
