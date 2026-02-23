// app/api/interests/[interestId]/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import pg from "pg";
import { z } from "zod";
import { normalizeAgeGroup } from "@/lib/normalizeAgeGroup";

const { Pool } = pg;

export const runtime = "nodejs";         // needed for 'pg'
export const dynamic = "force-dynamic";  // avoid static caching
export const revalidate = 0;

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

type Params = { interestId: string };

// Helper: support both Next.js shapes (sync or async params)
async function getParams<T>(ctx: { params: T } | { params: Promise<T> }): Promise<T> {
  return Promise.resolve(ctx.params);
}

/**
 * Optional ownership guard (recommended):
 * If caller provides ?parentUserId=##, we verify this interest belongs to that parent.
 * This prevents cross-account edits/deletes.
 */
async function assertParentOwnsInterest(args: {
  client: any;
  interestId: number;
  parentUserId: number;
}) {
  const res = await args.client.query(
    `
    SELECT wi.id
      FROM public.wrestler_interests wi
      JOIN public.wrestlers w ON w.id = wi.wrestler_id
     WHERE wi.id = $1
       AND w.parent_user_id = $2
     LIMIT 1
    `,
    [args.interestId, args.parentUserId]
  );

  if (!res.rows.length) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: "Forbidden: interest does not belong to this parent." },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const };
}

/* ----------------------------- GET by id ----------------------------- */
/** GET /api/interests/:interestId */
export async function GET(
  req: NextRequest,
  ctx: { params: Params } | { params: Promise<Params> }
) {
  try {
    const { interestId } = await getParams(ctx);
    const idNum = Number(interestId);

    if (!Number.isInteger(idNum) || idNum <= 0) {
      return NextResponse.json({ ok: false, message: "Invalid interest id" }, { status: 400 });
    }

    if (!pool) {
      // Dev fallback with mock
      return NextResponse.json(
        {
          ok: true,
          interest: {
            id: idNum,
            wrestler_id: 0,
            event_name: "Mock Event",
            event_date: null,
            weight_class: "64",
            age_group: "12U",
            notes: null,
            parent_ok: null,
            coach_ok: null,
            created_at: new Date().toISOString(),
          },
          mocked: true,
        },
        { status: 200 }
      );
    }

    const parentUserId = Number(new URL(req.url).searchParams.get("parentUserId") || 0);

    const client = await pool.connect();
    try {
      // Optional ownership guard
      if (parentUserId > 0) {
        const owned = await assertParentOwnsInterest({
          client,
          interestId: idNum,
          parentUserId,
        });
        if (!owned.ok) return owned.response;
      }

      const { rows } = await client.query(
        `
        SELECT id, wrestler_id, event_name, event_date, weight_class, age_group, notes,
               parent_ok, coach_ok, created_at
          FROM public.wrestler_interests
         WHERE id = $1
        `,
        [idNum]
      );

      if (!rows.length) {
        return NextResponse.json({ ok: false, message: "Interest not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, interest: rows[0] }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("GET /api/interests/[interestId] error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}

/* ---------------------------- PATCH (partial) ---------------------------- */
/**
 * IMPORTANT:
 * We do NOT allow PATCH of parent_ok / coach_ok here anymore.
 * Those flags should only be changed via match-confirm endpoints, not generic edits.
 */
const PatchSchema = z
  .object({
    eventName: z.string().min(1).optional(),
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u, "Use YYYY-MM-DD")
      .optional()
      .nullable(),
    weightClass: z.string().min(1).optional(),
    ageGroup: z.string().min(1).optional(),
    notes: z.string().optional().nullable(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

/** PATCH /api/interests/:interestId */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Params } | { params: Promise<Params> }
) {
  try {
    const { interestId } = await getParams(ctx);
    const idNum = Number(interestId);

    if (!Number.isInteger(idNum) || idNum <= 0) {
      return NextResponse.json({ ok: false, message: "Invalid interest id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (!pool) {
      const mock: any = { id: idNum, ...parsed.data };
      if (mock.ageGroup) mock.ageGroup = normalizeAgeGroup(mock.ageGroup);
      return NextResponse.json({ ok: true, interest: mock, mocked: true }, { status: 200 });
    }

    const parentUserId = Number(new URL(req.url).searchParams.get("parentUserId") || 0);

    const client = await pool.connect();
    try {
      // Optional ownership guard
      if (parentUserId > 0) {
        const owned = await assertParentOwnsInterest({
          client,
          interestId: idNum,
          parentUserId,
        });
        if (!owned.ok) return owned.response;
      }

      const f = parsed.data;
      const sets: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      if (f.eventName !== undefined) { sets.push(`event_name = $${i++}`); values.push(f.eventName); }
      if (f.eventDate !== undefined) { sets.push(`event_date = $${i++}`); values.push(f.eventDate ?? null); }
      if (f.weightClass !== undefined) { sets.push(`weight_class = $${i++}`); values.push(f.weightClass); }
      if (f.ageGroup !== undefined) {
        const norm = normalizeAgeGroup(f.ageGroup);
        sets.push(`age_group = $${i++}`);
        values.push(norm);
        // if you have age_group_key column for interests, uncomment:
        // sets.push(`age_group_key = $${i++}`);
        // values.push(norm ? norm.toLowerCase() : null);
      }
      if (f.notes !== undefined) { sets.push(`notes = $${i++}`); values.push(f.notes ?? null); }

      values.push(idNum);

      const sql = `
        UPDATE public.wrestler_interests
           SET ${sets.join(", ")}
         WHERE id = $${i}
         RETURNING id, wrestler_id, event_name, event_date, weight_class, age_group, notes, parent_ok, coach_ok, created_at
      `;

      const { rows } = await client.query(sql, values);

      if (!rows.length) {
        return NextResponse.json({ ok: false, message: "Interest not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, interest: rows[0] }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("PATCH /api/interests/[interestId] error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}

/* ------------------------------- DELETE -------------------------------- */
/** DELETE /api/interests/:interestId */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Params } | { params: Promise<Params> }
) {
  try {
    const { interestId } = await getParams(ctx);
    const idNum = Number(interestId);

    if (!Number.isInteger(idNum) || idNum <= 0) {
      return NextResponse.json({ ok: false, message: "Invalid interest id" }, { status: 400 });
    }

    if (!pool) {
      return NextResponse.json({ ok: true, deleted: false, mocked: true }, { status: 200 });
    }

    const parentUserId = Number(new URL(req.url).searchParams.get("parentUserId") || 0);

    const client = await pool.connect();
    try {
      // Optional ownership guard
      if (parentUserId > 0) {
        const owned = await assertParentOwnsInterest({
          client,
          interestId: idNum,
          parentUserId,
        });
        if (!owned.ok) return owned.response;
      }

      const { rowCount } = await client.query(
        `DELETE FROM public.wrestler_interests WHERE id = $1`,
        [idNum]
      );

      if (!rowCount) {
        return NextResponse.json({ ok: false, message: "Interest not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, deleted: true }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("DELETE /api/interests/[interestId] error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
