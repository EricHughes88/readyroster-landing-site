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
    const gate = await requireAdminOrSuper();
    if (!gate.ok) return jsonError(gate.message, gate.status);

    const url = new URL(req.url);
    const days = clampDays(url.searchParams.get("days"));
    const limit = clampLimit(url.searchParams.get("limit"));

    const sql = `
      WITH params AS (
        SELECT
          $1::int AS days,
          (NOW() - (($1::int || ' days')::interval)) AS start_ts
      ),

      normalized_needs AS (
        SELECT
          TRIM(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                LOWER(COALESCE(cn.event_name, '')),
                '[^a-z0-9\\s]+',
                '',
                'g'
              ),
              '\\s+',
              ' ',
              'g'
            )
          ) AS event_key,
          TRIM(cn.event_name) AS event_name,
          cn.coach_user_id
        FROM public.coach_needs cn
        JOIN params p ON true
        WHERE cn.created_at >= p.start_ts
          AND cn.event_name IS NOT NULL
          AND TRIM(cn.event_name) <> ''
          AND COALESCE(cn.is_visible, TRUE) = TRUE
          AND COALESCE(cn.weight_class, '') NOT LIKE '%,%'
      ),

      needs AS (
        SELECT
          event_key,
          MIN(event_name) AS event_name,
          COUNT(*)::int AS coach_needs,
          COUNT(DISTINCT coach_user_id)::int AS unique_coaches
        FROM normalized_needs
        WHERE event_key <> ''
        GROUP BY event_key
      ),

      normalized_interests AS (
        SELECT
          TRIM(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                LOWER(COALESCE(wi.event_name, '')),
                '[^a-z0-9\\s]+',
                '',
                'g'
              ),
              '\\s+',
              ' ',
              'g'
            )
          ) AS event_key,
          TRIM(wi.event_name) AS event_name,
          wi.wrestler_id
        FROM public.wrestler_interests wi
        JOIN params p ON true
        WHERE wi.created_at >= p.start_ts
          AND wi.event_name IS NOT NULL
          AND TRIM(wi.event_name) <> ''
          AND wi.wrestler_id IS NOT NULL
      ),

      interests AS (
        SELECT
          event_key,
          MIN(event_name) AS event_name,
          COUNT(*)::int AS athlete_interest,
          COUNT(DISTINCT wrestler_id)::int AS unique_athletes
        FROM normalized_interests
        WHERE event_key <> ''
        GROUP BY event_key
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
        ON i.event_key = n.event_key
      ORDER BY
        (COALESCE(n.coach_needs, 0) + COALESCE(i.athlete_interest, 0)) DESC,
        COALESCE(n.coach_needs, 0) DESC,
        COALESCE(i.athlete_interest, 0) DESC,
        COALESCE(n.event_name, i.event_name) ASC
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