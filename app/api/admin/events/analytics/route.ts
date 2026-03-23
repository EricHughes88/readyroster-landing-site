import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function GET() {
  const client = await pool.connect();

  try {
    const res = await client.query(`
      SELECT
        wi.event_name,

        COUNT(*) FILTER (WHERE wi.travel_miles IS NOT NULL)::int AS total_athletes,

        ROUND(AVG(wi.travel_miles))::int AS avg_travel_miles,

        ROUND(MAX(wi.travel_miles))::int AS max_travel_miles,

        COUNT(*) FILTER (
          WHERE wi.event_state IS NOT NULL
            AND w.state IS NOT NULL
            AND UPPER(TRIM(wi.event_state)) <> UPPER(TRIM(w.state))
        )::int AS out_of_state_count,

        -- 🔥 CLEAN EVENT SCORE
        ROUND(
          COALESCE(AVG(wi.travel_miles), 0) * 0.5 +

          COUNT(*) FILTER (WHERE wi.travel_miles IS NOT NULL) * 20 +

          COUNT(*) FILTER (
            WHERE wi.event_state IS NOT NULL
              AND w.state IS NOT NULL
              AND UPPER(TRIM(wi.event_state)) <> UPPER(TRIM(w.state))
          ) * 50
        )::int AS event_score

      FROM public.wrestler_interests wi
      LEFT JOIN public.wrestlers w
        ON w.id = wi.wrestler_id

      WHERE COALESCE(TRIM(wi.event_name), '') <> ''

      GROUP BY wi.event_name

      -- 🔥 FILTER OUT EMPTY EVENTS
      HAVING COUNT(*) FILTER (WHERE wi.travel_miles IS NOT NULL) > 0

      ORDER BY event_score DESC NULLS LAST, wi.event_name ASC
    `);

    return NextResponse.json({
      ok: true,
      rows: res.rows ?? [],
    });
  } catch (e: any) {
    console.error("[admin/events/analytics] error:", e);
    return jsonError(
      "Failed to load event analytics",
      500,
      e?.message ?? String(e)
    );
  } finally {
    client.release();
  }
}