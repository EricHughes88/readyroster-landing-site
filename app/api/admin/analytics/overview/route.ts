// app/api/admin/analytics/overview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const days = clampDays(url.searchParams.get("days"));

    const sql = `
      WITH params AS (
        SELECT
          $1::int AS days,
          (CURRENT_DATE - ($1::int - 1))::date AS start_day,
          CURRENT_DATE::date AS end_day
      ),

      series AS (
        SELECT d::date AS day
        FROM params p
        CROSS JOIN generate_series(p.start_day, p.end_day, interval '1 day') AS d
      ),

      new_users AS (
        SELECT
          date_trunc('day', u.created_at)::date AS day,
          COUNT(*)::int AS count
        FROM public.users u
        JOIN params p ON true
        WHERE u.created_at >= p.start_day
          AND u.created_at < (p.end_day + 1)
        GROUP BY 1
      ),

      needs_posted AS (
        SELECT
          date_trunc('day', cn.created_at)::date AS day,
          COUNT(*)::int AS count
        FROM public.coach_needs cn
        JOIN params p ON true
        WHERE cn.created_at >= p.start_day
          AND cn.created_at < (p.end_day + 1)
        GROUP BY 1
      ),

      athlete_interest AS (
        SELECT
          date_trunc('day', wi.created_at)::date AS day,
          COUNT(*)::int AS count
        FROM public.wrestler_interests wi
        JOIN params p ON true
        WHERE wi.created_at >= p.start_day
          AND wi.created_at < (p.end_day + 1)
        GROUP BY 1
      ),

      match_requests AS (
        SELECT
          date_trunc('day', m.created_at)::date AS day,
          COUNT(*)::int AS count
        FROM public.matches m
        JOIN params p ON true
        WHERE m.created_at >= p.start_day
          AND m.created_at < (p.end_day + 1)
        GROUP BY 1
      ),

      -- IMPORTANT: using msg.sentat (your actual column)
      messages_sent AS (
        SELECT
          date_trunc('day', msg.sentat)::date AS day,
          COUNT(*)::int AS count
        FROM public.messages msg
        JOIN params p ON true
        WHERE msg.sentat >= p.start_day
          AND msg.sentat < (p.end_day + 1)
        GROUP BY 1
      )

      SELECT
        s.day,

        COALESCE(nu.count, 0)::int  AS new_users,
        COALESCE(np.count, 0)::int  AS needs_posted,
        COALESCE(ai.count, 0)::int  AS athlete_interest,
        COALESCE(mr.count, 0)::int  AS match_requests,
        COALESCE(ms.count, 0)::int  AS messages_sent,

        (
          COALESCE(np.count, 0)
          + COALESCE(ai.count, 0)
          + COALESCE(mr.count, 0)
          + COALESCE(ms.count, 0)
        )::int AS activity_total

      FROM series s
      LEFT JOIN new_users nu        ON nu.day = s.day
      LEFT JOIN needs_posted np     ON np.day = s.day
      LEFT JOIN athlete_interest ai ON ai.day = s.day
      LEFT JOIN match_requests mr   ON mr.day = s.day
      LEFT JOIN messages_sent ms    ON ms.day = s.day
      ORDER BY s.day ASC;
    `;

    const result = await pool.query(sql, [days]);

    const trend = result.rows.map((r) => ({
      day: r.day,
      new_users: Number(r.new_users ?? 0),
      needs_posted: Number(r.needs_posted ?? 0),
      athlete_interest: Number(r.athlete_interest ?? 0),
      match_requests: Number(r.match_requests ?? 0),
      messages_sent: Number(r.messages_sent ?? 0),
      activity_total: Number(r.activity_total ?? 0),
    }));

    const totals = trend.reduce(
      (acc, d) => {
        acc.new_users += d.new_users;
        acc.needs_posted += d.needs_posted;
        acc.athlete_interest += d.athlete_interest;
        acc.match_requests += d.match_requests;
        acc.messages_sent += d.messages_sent;
        return acc;
      },
      {
        new_users: 0,
        needs_posted: 0,
        athlete_interest: 0,
        match_requests: 0,
        messages_sent: 0,
      }
    );

    return NextResponse.json({
      ok: true,
      days,
      totals: {
        new_users: totals.new_users,
        active_users: 0,
        needs_posted: totals.needs_posted,
        match_requests: totals.match_requests,
        messages_sent: totals.messages_sent,
      },
      trend: {
        new_users: trend.map((d) => ({
          day: d.day,
          count: d.new_users,
        })),
        activity: trend.map((d) => ({
          day: d.day,
          total: d.activity_total,
        })),
      },
    });
  } catch (e: any) {
    console.error("[overview] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}