// app/api/admin/analytics/event-traction/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

function clampDays(raw: string | null) {
  const n = Number(raw ?? 30);
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(365, Math.floor(n)));
}

function clampLimit(raw: string | null) {
  const n = Number(raw ?? 50);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(200, Math.floor(n)));
}

function getSuperEmails() {
  return String(process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdminOrSuper() {
  const session = (await getServerSession(authConfig as any)) as any;

  if (!session?.user) {
    return { ok: false as const, status: 401, message: "Unauthorized" };
  }

  const role = String(session.user.role ?? "").trim();
  const email = String(session.user.email ?? "").trim().toLowerCase();

  const allowByRole = role === "Admin" || role === "Super Admin";
  const allowByEmail = getSuperEmails().includes(email);

  if (!allowByRole && !allowByEmail) {
    return { ok: false as const, status: 403, message: "Forbidden" };
  }

  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  try {
    // ✅ AUTH GATE
    const gate = await requireAdminOrSuper();
    if (!gate.ok) return jsonError(gate.message, gate.status);

    const url = new URL(req.url);
    const days = clampDays(url.searchParams.get("days"));
    const limit = clampLimit(url.searchParams.get("limit"));

    // Notes:
    // - coach_needs: demand
    // - wrestler_interests: supply
    // - supply_gap: needs - unique_athletes (simple heuristic)
    const sql = `
      WITH params AS (
        SELECT
          $1::int AS days,
          (NOW() - (($1::int || ' days')::interval)) AS start_ts
      ),

      needs AS (
        SELECT
          cn.event_name,
          COUNT(*)::int AS coach_needs,
          COUNT(DISTINCT cn.coach_user_id)::int AS unique_coaches
        FROM public.coach_needs cn
        JOIN params p ON true
        WHERE cn.created_at >= p.start_ts
          AND cn.event_name IS NOT NULL
          AND TRIM(cn.event_name) <> ''
        GROUP BY cn.event_name
      ),

      interests AS (
        SELECT
          wi.event_name,
          COUNT(*)::int AS athlete_interest,
          COUNT(DISTINCT wi.wrestler_id)::int AS unique_athletes
        FROM public.wrestler_interests wi
        JOIN params p ON true
        WHERE wi.created_at >= p.start_ts
          AND wi.event_name IS NOT NULL
          AND TRIM(wi.event_name) <> ''
          AND wi.wrestler_id IS NOT NULL
        GROUP BY wi.event_name
      )

      SELECT
        COALESCE(n.event_name, i.event_name) AS event_name,
        COALESCE(n.coach_needs, 0)::int AS coach_needs,
        COALESCE(n.unique_coaches, 0)::int AS unique_coaches,
        COALESCE(i.athlete_interest, 0)::int AS athlete_interest,
        COALESCE(i.unique_athletes, 0)::int AS unique_athletes,
        (COALESCE(n.coach_needs, 0) - COALESCE(i.unique_athletes, 0))::int AS supply_gap
      FROM needs n
      FULL OUTER JOIN interests i
        ON i.event_name = n.event_name
      ORDER BY (COALESCE(n.coach_needs,0) + COALESCE(i.athlete_interest,0)) DESC,
               COALESCE(n.coach_needs,0) DESC,
               COALESCE(i.athlete_interest,0) DESC,
               event_name ASC
      LIMIT $2;
    `;

    const result = await pool.query(sql, [days, limit]);

    return NextResponse.json({
      ok: true,
      days,
      limit,
      rows: result.rows ?? [],
    });
  } catch (e: any) {
    console.error("[event-traction] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}