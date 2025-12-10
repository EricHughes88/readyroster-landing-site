// app/api/interests/[interestId]/route.ts
import { NextResponse } from "next/server";
import pg from "pg";
import { z } from "zod";
const { Pool } = pg;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

// Same normalization used when creating interests
function normalizeAgeGroup(input: string): string {
  let s = (input || "").trim();
  const girls = /\bgirls?\b/i.test(s);
  s = s.replace(/\bgirls?\b/gi, "").trim();
  s = s.replace(/&/g, "and").replace(/\s+/g, " ").toLowerCase();

  const m = s.match(/\b(6|8|10|12|14)\b(?:\s*(u|and\s*under|under))?/i);
  if (m) {
    const num = m[1];
    const canonical = `${num}U`;
    return girls ? `Girls ${canonical}` : canonical;
  }
  if (/\b(high\s*school|hs)\b/i.test(s)) return girls ? "Girls HS" : "HS";
  if (/\bopen\b/i.test(s)) return girls ? "Girls Open" : "Open";

  const tidy = s.replace(/\b\w/g, (c) => c.toUpperCase());
  return girls ? `Girls ${tidy}` : tidy;
}

// -------- DELETE /api/interests/:interestId --------
export async function DELETE(
  _req: Request,
  { params }: { params: { interestId: string } }
) {
  try {
    if (!pool) return NextResponse.json({ ok: true }, { status: 200 });
    const id = Number(params.interestId);
    if (!id) return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });

    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM public.wrestler_interests WHERE id = $1`, [id]);
      return NextResponse.json({ ok: true }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Interest DELETE error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}

// -------- PATCH /api/interests/:interestId --------
const UpdateSchema = z.object({
  eventName: z.string().min(1).optional(),
  eventDate: z.string().nullable().optional(), // YYYY-MM-DD
  weightClass: z.string().min(1).optional(),
  ageGroup: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { interestId: string } }
) {
  try {
    if (!pool) return NextResponse.json({ ok: false, message: "DB not configured" }, { status: 500 });

    const id = Number(params.interestId);
    if (!id) return NextResponse.json({ ok: false, message: "Invalid id" }, { status: 400 });

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (parsed.data.eventName !== undefined) {
      updates.push(`event_name = $${i++}`);
      values.push(parsed.data.eventName);
    }
    if (parsed.data.eventDate !== undefined) {
      updates.push(`event_date = $${i++}`);
      values.push(parsed.data.eventDate || null);
    }
    if (parsed.data.weightClass !== undefined) {
      updates.push(`weight_class = $${i++}`);
      values.push(parsed.data.weightClass);
    }
    if (parsed.data.ageGroup !== undefined) {
      updates.push(`age_group = $${i++}`);
      values.push(normalizeAgeGroup(parsed.data.ageGroup));
    }
    if (parsed.data.notes !== undefined) {
      updates.push(`notes = $${i++}`);
      values.push(parsed.data.notes ?? null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ ok: false, message: "Nothing to update" }, { status: 400 });
    }

    values.push(id);
    const sql = `UPDATE public.wrestler_interests SET ${updates.join(", ")} WHERE id = $${i}`;
    const client = await pool.connect();
    try {
      await client.query(sql, values);
      return NextResponse.json({ ok: true }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Interest PATCH error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
