import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

declare global {
  // eslint-disable-next-line no-var
  var __RR_ATH_AVAIL_POOL__: Pool | undefined;
}

function getPool(): Pool | null {
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;
  if (!global.__RR_ATH_AVAIL_POOL__) {
    global.__RR_ATH_AVAIL_POOL__ = new Pool({ connectionString: conn });
  }
  return global.__RR_ATH_AVAIL_POOL__;
}

const Schema = z.object({
  event_name: z.string().min(1, "event_name is required"),
  age_group: z.string().min(1, "age_group is required"),
  weight_class: z.string().min(1, "weight_class is required"),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  is_available: z.coerce.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonError("Unauthorized", 401);

    const role = (session.user as any)?.role;
    if (role !== "Athlete") return jsonError("Athlete only", 403);

    const athleteUserId = Number((session.user as any)?.id || 0);
    if (!athleteUserId) return jsonError("Invalid user", 400);

    const body = await req.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Invalid input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const v = parsed.data;
    const pool = getPool();
    if (!pool) return jsonError("Database not configured", 500);

    // 1) Save availability
    const { rows } = await pool.query(
      `
      insert into public.athlete_availability
        (athlete_user_id, event_name, age_group, weight_class, city, state, notes, is_available)
      values ($1,$2,$3,$4,$5,$6,$7,$8)
      returning id
      `,
      [
        athleteUserId,
        v.event_name,
        v.age_group,
        v.weight_class,
        v.city ?? null,
        v.state ?? null,
        v.notes ?? null,
        v.is_available ?? true,
      ]
    );

    const availabilityId = Number(rows?.[0]?.id || 0);

    // 2) Log ATHLETE_INTEREST for Admin analytics (non-blocking)
    try {
      const source = [
        "availability_submit",
        `availabilityId=${availabilityId}`,
        `ageGroup=${encodeURIComponent(v.age_group)}`,
        `weight=${encodeURIComponent(v.weight_class)}`,
        `city=${encodeURIComponent(v.city ?? "")}`,
        `state=${encodeURIComponent(v.state ?? "")}`,
      ].join(";");

      await pool.query(
        `
        insert into public.event_interests (user_id, event_name, source, actor_role, action_type)
        values ($1, $2, $3, 'Athlete', 'ATHLETE_INTEREST')
        `,
        [athleteUserId, v.event_name, source]
      );
    } catch (e) {
      console.error("[analytics] ATHLETE_INTEREST log failed:", e);
    }

    return NextResponse.json({ ok: true, id: availabilityId }, { status: 201 });
  } catch (e: any) {
    console.error("[athlete/availability] error", e);
    return jsonError("Server error", 500, String(e?.message || e));
  }
}
