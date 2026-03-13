import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth.config";

import { notifyAthleteFollowersOnNewInterest } from "@/lib/notifyAthleteFollowers";

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

    const role = String((session.user as any)?.role ?? "");
    if (role !== "Athlete") return jsonError("Athlete only", 403);

    const userId = Number((session.user as any)?.id || 0);
    if (!userId) return jsonError("Invalid user", 400);

    const body = await req.json().catch(() => ({}));

    const event_name = String(body?.event_name ?? "").trim();
    if (!event_name) return jsonError("event_name is required", 400);

    const age_group = String(body?.age_group ?? "").trim();
    const weight_class = String(body?.weight_class ?? "").trim();
    const event_date = String(body?.event_date ?? "").trim();
    const source = String(body?.source ?? "athlete_action").trim();

    const sourcePacked = [
      source || "athlete_action",
      age_group ? `ageGroup=${encodeURIComponent(age_group)}` : "",
      weight_class ? `weight=${encodeURIComponent(weight_class)}` : "",
      event_date ? `eventDate=${encodeURIComponent(event_date)}` : "",
    ]
      .filter(Boolean)
      .join(";");

    const pool = getPool();
    if (!pool) return jsonError("Database not configured", 500);

    // Record athlete interest
    const insertRes = await pool.query(
      `
      INSERT INTO public.event_interests
      (user_id, event_name, source, actor_role, action_type)
      SELECT $1, $2, $3, 'Athlete', 'ATHLETE_INTEREST'
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.event_interests
        WHERE user_id = $1
          AND event_name = $2
          AND actor_role = 'Athlete'
          AND action_type = 'ATHLETE_INTEREST'
          AND created_at >= now() - interval '24 hours'
      )
      `,
      [userId, event_name, sourcePacked]
    );

    /*
      ---------------------------------------
      NEW: Notify coaches following this athlete
      ---------------------------------------
    */
    if ((insertRes.rowCount ?? 0) > 0) {
      const athleteRes = await pool.query<{
        athleteid: number;
        firstname: string | null;
        lastname: string | null;
      }>(
        `
        SELECT
          athleteid,
          firstname,
          lastname
        FROM public.athletes
        WHERE userid = $1
        LIMIT 1
        `,
        [userId]
      );

      if (athleteRes.rows.length > 0) {
        const athlete = athleteRes.rows[0];
        const athleteId = Number(athlete.athleteid);

        const athleteName =
          `${String(athlete.firstname ?? "").trim()} ${String(athlete.lastname ?? "").trim()}`.trim() ||
          "An athlete you follow";

        try {
          await notifyAthleteFollowersOnNewInterest({
            wrestlerId: athleteId,
            athleteName,
            eventName: event_name,
            eventDate: event_date || null,
            weightClass: weight_class || null,
            ageGroup: age_group || null,
          });
        } catch (notifyErr) {
          console.error("[notifyAthleteFollowers] failed", notifyErr);
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        inserted: (insertRes.rowCount ?? 0) > 0,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[athlete/interest] error", e);
    return jsonError(
      "Failed to record athlete interest",
      500,
      String(e?.message || e)
    );
  }
}