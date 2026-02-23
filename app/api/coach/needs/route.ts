// app/api/coach/needs/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "pg";
import { normalizeAgeGroup } from "@/lib/normalizeAgeGroup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ✅ Updated to support posting MULTIPLE weight classes at once.
 * weight_class can be:
 *  - "65"
 *  - "65,75,160,190"
 *  - ["65","75","160","190"]
 */
const NewNeedSchema = z.object({
  coachUserId: z.coerce.number().int().positive(),
  event_name: z.string().min(1, "event_name is required"),
  event_date: z.union([z.string().min(1), z.date()]).optional().nullable(),
  weight_class: z.union([
    z.string().min(1, "weight_class is required"),
    z.array(z.string().min(1)).min(1, "weight_class is required"),
  ]),
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
      // fall through
    }
  }

  // x-www-form-urlencoded
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }

  // multipart/form-data (or anything else we can parse with formData())
  try {
    const fd = await req.formData();
    const out: Record<string, any> = {};
    fd.forEach((v, k) => (out[k] = typeof v === "string" ? v : (v as File).name));
    if (Object.keys(out).length) return out;
  } catch {
    /* ignore */
  }

  // Last attempt
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const d = new Date(s);
    if (!isNaN(+d)) return d.toISOString().slice(0, 10);

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

/** Convert weight_class input to a clean, unique list (supports commas/newlines/semicolons) */
function parseWeights(input: string | string[]): string[] {
  const rawList = Array.isArray(input) ? input : [input];

  const pieces = rawList
    .flatMap((s) => String(s).split(/[,\n;]+/))
    .map((s) => s.trim())
    .filter(Boolean);

  // de-dupe case-insensitively
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of pieces) {
    const key = w.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(w);
    }
  }
  return out;
}

/**
 * Non-blocking analytics log:
 * - Logs each coach need as demand signal
 * - Stores extra granularity in `source` (no schema changes needed)
 * - If logging fails, need creation still succeeds
 */
async function logNeedPosted(args: {
  client: any;
  coachUserId: number;
  needId: number;
  eventName: string;
  ageGroup: string;
  ageGroupKey: string | null;
  weightClass: string;
  city: string | null;
  state: string | null;
}) {
  try {
    const source = [
      "coach_post_need",
      `needId=${args.needId}`,
      `ageGroup=${encodeURIComponent(args.ageGroup)}`,
      `ageKey=${encodeURIComponent(args.ageGroupKey ?? "")}`,
      `weight=${encodeURIComponent(args.weightClass)}`,
      `city=${encodeURIComponent(args.city ?? "")}`,
      `state=${encodeURIComponent(args.state ?? "")}`,
    ].join(";");

    await args.client.query(
      `
      insert into public.event_interests (user_id, event_name, source, actor_role, action_type)
      values ($1, $2, $3, 'Coach', 'NEED_POSTED')
      `,
      [args.coachUserId, args.eventName, source]
    );
  } catch (e) {
    console.error("[analytics] logNeedPosted failed:", e);
  }
}

/** GET /api/coach/needs?coachUserId=11 */
export async function GET(req: Request) {
  try {
    if (!pool) {
      return NextResponse.json({ ok: true, needs: [] }, { status: 200 });
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
                weight_class, age_group, age_group_key,
                city, state, notes, is_open, created_at
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
      return NextResponse.json(
        { ok: false, message: "Invalid input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const v = parsed.data;

    // ✅ Normalize age group display + key consistently
    const normalizedAgeGroup = normalizeAgeGroup(v.age_group); // e.g. "10U"
    const ageKey = normalizedAgeGroup ? normalizedAgeGroup.toLowerCase() : null; // e.g. "10u"

    // ✅ Parse weights (supports comma-separated or array)
    const weights = parseWeights(v.weight_class);
    if (!weights.length) {
      return NextResponse.json(
        { ok: false, message: "weight_class is required" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // ✅ ROLE VALIDATION: only Coaches can create coach needs
      // IMPORTANT: your coachUserId is users.user_id (app id), not users.id
      const ures = await client.query(
        `SELECT id, user_id, name, role
           FROM public.users
          WHERE user_id = $1
          LIMIT 1`,
        [v.coachUserId]
      );

      if (!ures.rows.length) {
        return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
      }

      const role = String(ures.rows[0]?.role || "").toLowerCase();
      if (role !== "coach") {
        return NextResponse.json(
          { ok: false, message: "Only Coaches can create coach needs." },
          { status: 403 }
        );
      }

      // ✅ Insert one row per weight class (all-or-nothing transaction)
      await client.query("BEGIN");

      const ids: number[] = [];
      for (const w of weights) {
        const res = await client.query(
          `INSERT INTO public.coach_needs
             (coach_user_id, event_name, event_date, weight_class, age_group, age_group_key, city, state, notes, is_open)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, true)
           RETURNING id`,
          [
            v.coachUserId,
            v.event_name,
            v.event_date ?? null,
            w,
            normalizedAgeGroup || v.age_group,
            ageKey ?? null,
            v.city ?? null,
            v.state ?? null,
            v.notes ?? null,
          ]
        );

        const needId = Number(res.rows?.[0]?.id || 0);
        if (needId) ids.push(needId);

        // Analytics per inserted row (non-blocking)
        if (needId) {
          await logNeedPosted({
            client,
            coachUserId: v.coachUserId,
            needId,
            eventName: v.event_name,
            ageGroup: normalizedAgeGroup || v.age_group,
            ageGroupKey: ageKey ?? null,
            weightClass: w,
            city: v.city ?? null,
            state: v.state ?? null,
          });
        }
      }

      await client.query("COMMIT");

      return NextResponse.json(
        { ok: true, createdCount: ids.length, ids },
        { status: 201 }
      );
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Coach needs POST error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}