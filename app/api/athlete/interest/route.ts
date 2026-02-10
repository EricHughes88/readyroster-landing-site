import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

// Pool singleton for dev HMR
declare global {
  // eslint-disable-next-line no-var
  var __RR_ATH_INTEREST_POOL__: Pool | undefined;
}

function getPool(): Pool | null {
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;
  if (!global.__RR_ATH_INTEREST_POOL__) {
    global.__RR_ATH_INTEREST_POOL__ = new Pool({ connectionString: conn });
  }
  return global.__RR_ATH_INTEREST_POOL__;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return jsonError("Unauthorized", 401);

    const role = (session.user as any)?.role;
    if (role !== "Athlete") return jsonError("Athlete only", 403);

    const userId = Number((session.user as any)?.id || 0);
    if (!userId) return jsonError("Invalid user", 400);

    const body = await req.json().catch(() => ({}));
    const event_name = String(body?.event_name ?? "").trim();
    if (!event_name) return jsonError("event_name is required", 400);

    const age_group = String(body?.age_group ?? "").trim();
    const weight_class = String(body?.weight_class ?? "").trim();
    const source = String(body?.source ?? "athlete_action").trim();

    // Pack optional granularity into source for now (no schema changes)
    const sourcePacked = [
      source || "athlete_action",
      age_group ? `ageGroup=${encodeURIComponent(age_group)}` : "",
      weight_class ? `weight=${encodeURIComponent(weight_class)}` : "",
    ].filter(Boolean).join(";");

    const pool = getPool();
    if (!pool) return jsonError("Database not configured", 500);

    // Optional anti-spam: only 1 per athlete/event per day
    await pool.query(
      `
      insert into public.event_interests (user_id, event_name, source, actor_role, action_type)
      select $1, $2, $3, 'Athlete', 'ATHLETE_INTEREST'
      where not exists (
        select 1 from public.event_interests
        where user_id = $1
          and event_name = $2
          and actor_role = 'Athlete'
          and action_type = 'ATHLETE_INTEREST'
          and created_at >= now() - interval '24 hours'
      )
      `,
      [userId, event_name, sourcePacked]
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("[athlete/interest] error", e);
    return jsonError("Failed to record athlete interest", 500, String(e?.message || e));
  }
}
