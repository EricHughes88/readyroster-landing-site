// app/api/coach/needs/[needId]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

// Reuse the tolerant date normalizer
function normalizeDate(input?: string | Date | null): string | null {
  if (!input) return null;
  if (input instanceof Date && !isNaN(+input)) return input.toISOString().slice(0, 10);
  if (typeof input === "string") {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(+d)) return d.toISOString().slice(0, 10);
    const parts = s.split(/[^\d]/).map(Number);
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

// Read JSON or FormData
async function readBody(req: Request): Promise<Record<string, any>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("application/json")) {
    try { return await req.json(); } catch {}
  }
  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(await req.text());
    return Object.fromEntries(params.entries());
  }
  try {
    const fd = await req.formData();
    const out: Record<string, any> = {};
    fd.forEach((v, k) => (out[k] = typeof v === "string" ? v : (v as File).name));
    if (Object.keys(out).length) return out;
  } catch {}
  try { return await req.json(); } catch { return {}; }
}

const UpdateSchema = z.object({
  event_name: z.string().min(1).optional(),
  event_date: z.union([z.string().min(1), z.date()]).optional().nullable(),
  weight_class: z.string().min(1).optional(),
  age_group: z.string().min(1).optional(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  is_open: z.coerce.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ needId: string }> }
) {
  try {
    if (!pool) return NextResponse.json({ ok: false, message: "DB not configured" }, { status: 500 });
    const { needId } = await ctx.params;
    const idNum = Number(needId);
    if (!idNum) return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });

    const raw = await readBody(req);
    if (raw.event_date !== undefined) raw.event_date = normalizeDate(raw.event_date);

    const parsed = UpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "Invalid input", issues: parsed.error.issues }, { status: 400 });
    }
    const updates = parsed.data;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, message: "No fields to update" }, { status: 400 });
    }

    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const [k, v] of Object.entries(updates)) {
      sets.push(`${k} = $${i++}`);
      values.push(v === undefined ? null : v);
    }
    values.push(idNum);

    const sql = `
      UPDATE public.coach_needs
         SET ${sets.join(", ")}
       WHERE id = $${i}
       RETURNING id, coach_user_id, event_name, event_date, weight_class, age_group, city, state, notes, is_open, created_at
    `;

    const client = await pool.connect();
    try {
      const res = await client.query(sql, values);
      if (res.rowCount === 0) {
        return NextResponse.json({ ok: false, message: "Need not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, need: res.rows[0] }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Coach need PATCH error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ needId: string }> }
) {
  try {
    if (!pool) return NextResponse.json({ ok: false, message: "DB not configured" }, { status: 500 });
    const { needId } = await ctx.params;
    const idNum = Number(needId);
    if (!idNum) return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });

    const client = await pool.connect();
    try {
      const res = await client.query(`DELETE FROM public.coach_needs WHERE id = $1`, [idNum]);
      return NextResponse.json({ ok: true, deleted: res.rowCount }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Coach need DELETE error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
