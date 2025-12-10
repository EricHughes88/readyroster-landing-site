import { NextResponse } from "next/server";
import pg from "pg";
import { z } from "zod";
const { Pool } = pg;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

/** Normalize age groups like "12u", "12 and under", "Girls 8 and Under" → "12U", "Girls 8U" */
function normalizeAgeGroup(input: string): string {
  let s = input.trim();
  const girls = /\bgirls?\b/i.test(s);
  s = s.replace(/\bgirls?\b/gi, "").trim();
  s = s.replace(/&/g, "and").replace(/\s+/g, " ").toLowerCase();
  const m = s.match(/\b(6|8|10|12|14)\b(?:\s*(u|and\s*under|under))?/i);
  if (m) return girls ? `Girls ${m[1]}U` : `${m[1]}U`;
  if (/\b(high\s*school|hs)\b/i.test(s)) return girls ? "Girls HS" : "HS";
  if (/\bopen\b/i.test(s)) return girls ? "Girls Open" : "Open";
  const tidy = s.replace(/\b\w/g, (c) => c.toUpperCase());
  return girls ? `Girls ${tidy}` : tidy;
}

const BulkPatchSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "Provide at least one id"),
  changes: z.object({
    eventName: z.string().min(1).optional(),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Use YYYY-MM-DD").optional().nullable(),
    weightClass: z.string().min(1).optional(),
    ageGroup: z.string().min(1).optional(),
    notes: z.string().optional().nullable(),
    parent_ok: z.boolean().optional(),
    coach_ok: z.boolean().optional(),
  }).refine(obj => Object.keys(obj).length > 0, { message: "No fields to update" })
});

/**
 * PATCH /api/interests/bulk
 * Body: { ids: number[], changes: { ...same fields as single PATCH... } }
 * Updates all specified interests in one go. Returns updated rows.
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = BulkPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, errors: parsed.error.flatten().fieldErrors, message: parsed.error.message },
        { status: 400 }
      );
    }

    if (!pool) {
      // Dev/mock: echo back what would be changed
      const preview = parsed.data.ids.map(id => {
        const c = { ...parsed.data.changes } as any;
        if (typeof c.ageGroup === "string") c.ageGroup = normalizeAgeGroup(c.ageGroup);
        return { id, ...c, mocked: true };
      });
      return NextResponse.json({ ok: true, count: preview.length, interests: preview, mocked: true }, { status: 200 });
    }

    const { ids, changes } = parsed.data;

    // Build dynamic SET safely
    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (changes.eventName !== undefined) { sets.push(`event_name = $${i++}`); values.push(changes.eventName); }
    if (changes.eventDate !== undefined) { sets.push(`event_date = $${i++}`); values.push(changes.eventDate ?? null); }
    if (changes.weightClass !== undefined) { sets.push(`weight_class = $${i++}`); values.push(changes.weightClass); }
    if (changes.ageGroup !== undefined) { sets.push(`age_group = $${i++}`); values.push(normalizeAgeGroup(changes.ageGroup)); }
    if (changes.notes !== undefined) { sets.push(`notes = $${i++}`); values.push(changes.notes ?? null); }
    if (changes.parent_ok !== undefined) { sets.push(`parent_ok = $${i++}`); values.push(changes.parent_ok); }
    if (changes.coach_ok !== undefined) { sets.push(`coach_ok = $${i++}`); values.push(changes.coach_ok); }

    if (sets.length === 0) {
      return NextResponse.json({ ok: false, message: "No fields to update" }, { status: 400 });
    }

    // Add ids array at the end
    values.push(ids);

    // Update all ids, return updated rows (order by id for stability)
    const sql = `
      UPDATE public.wrestler_interests
         SET ${sets.join(", ")}
       WHERE id = ANY($${i}::int[])
       RETURNING id, wrestler_id, event_name, event_date, weight_class, age_group, notes, parent_ok, coach_ok, created_at
      ORDER BY id ASC
    `;

    const { rows } = await pool.query(sql, values);
    return NextResponse.json({ ok: true, count: rows.length, interests: rows }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/interests/bulk error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/interests/bulk
 * Body: { ids: number[] }
 * Deletes all specified interest rows.
 */
const BulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "Provide at least one id")
});

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = BulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, errors: parsed.error.flatten().fieldErrors, message: parsed.error.message },
        { status: 400 }
      );
    }

    if (!pool) {
      return NextResponse.json({ ok: true, deleted: parsed.data.ids.length, mocked: true }, { status: 200 });
    }

    const { ids } = parsed.data;
    const { rowCount } = await pool.query(
      `DELETE FROM public.wrestler_interests WHERE id = ANY($1::int[])`,
      [ids]
    );

    return NextResponse.json({ ok: true, deleted: rowCount ?? 0 }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/interests/bulk error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
