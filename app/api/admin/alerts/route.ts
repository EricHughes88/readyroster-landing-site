// app/api/admin/alerts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RangeValue = "24h" | "7d" | "30d" | "all";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeRange(value: string | null): RangeValue {
  if (value === "24h") return "24h";
  if (value === "7d") return "7d";
  if (value === "all") return "all";
  return "30d";
}

function buildRangeSql(range: RangeValue, column: string) {
  if (range === "24h") return `${column} >= NOW() - INTERVAL '24 hours'`;
  if (range === "7d") return `${column} >= NOW() - INTERVAL '7 days'`;
  if (range === "30d") return `${column} >= NOW() - INTERVAL '30 days'`;
  return `1=1`;
}

function buildSeriesSql(range: RangeValue, column: string) {
  if (range === "24h") {
    return {
      bucketExpr: `TO_CHAR(DATE_TRUNC('hour', ${column}), 'Mon DD HH24:00')`,
      bucketOrderExpr: `DATE_TRUNC('hour', ${column})`,
      whereExpr: `${column} >= NOW() - INTERVAL '24 hours'`,
    };
  }

  if (range === "7d") {
    return {
      bucketExpr: `TO_CHAR(DATE_TRUNC('day', ${column}), 'Mon DD')`,
      bucketOrderExpr: `DATE_TRUNC('day', ${column})`,
      whereExpr: `${column} >= NOW() - INTERVAL '7 days'`,
    };
  }

  if (range === "30d") {
    return {
      bucketExpr: `TO_CHAR(DATE_TRUNC('day', ${column}), 'Mon DD')`,
      bucketOrderExpr: `DATE_TRUNC('day', ${column})`,
      whereExpr: `${column} >= NOW() - INTERVAL '30 days'`,
    };
  }

  return {
    bucketExpr: `TO_CHAR(DATE_TRUNC('month', ${column}), 'Mon YYYY')`,
    bucketOrderExpr: `DATE_TRUNC('month', ${column})`,
    whereExpr: `1=1`,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user) {
      return jsonError("Unauthorized", 401);
    }

    const { searchParams } = new URL(req.url);
    const q = safeStr(searchParams.get("q")).toLowerCase();
    const range = normalizeRange(searchParams.get("range"));

    const recruitingWhere = buildRangeSql(range, "sent_at");
    const matchWhere = buildRangeSql(range, "created_at");

    const recruitingSeriesCfg = buildSeriesSql(range, "sent_at");
    const matchSeriesCfg = buildSeriesSql(range, "created_at");

    const [
      recruitingStatsQ,
      matchStatsQ,
      topEventsQ,
      recentRecruitingQ,
      recentMatchQ,
      recruitingSeriesQ,
      matchSeriesQ,
    ] = await Promise.all([
      pool.query<{
        sent_last_24h: string | number | null;
        sent_last_7d: string | number | null;
        total_sent: string | number | null;
        latest_sent_at: string | null;
      }>(
        `
        SELECT
          COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '24 hours') AS sent_last_24h,
          COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '7 days') AS sent_last_7d,
          COUNT(*) FILTER (WHERE ${recruitingWhere}) AS total_sent,
          MAX(sent_at) FILTER (WHERE ${recruitingWhere}) AS latest_sent_at
        FROM public.recruiting_alert_log
        `
      ),

      pool.query<{
        parent_sent_last_24h: string | number | null;
        coach_sent_last_24h: string | number | null;
        parent_sent_last_7d: string | number | null;
        coach_sent_last_7d: string | number | null;
        total_parent_sent: string | number | null;
        total_coach_sent: string | number | null;
        total_match_emails_sent: string | number | null;
        latest_created_at: string | null;
      }>(
        `
        SELECT
          COUNT(*) FILTER (
            WHERE emailed_parent = TRUE
              AND created_at >= NOW() - INTERVAL '24 hours'
          ) AS parent_sent_last_24h,

          COUNT(*) FILTER (
            WHERE emailed_coach = TRUE
              AND created_at >= NOW() - INTERVAL '24 hours'
          ) AS coach_sent_last_24h,

          COUNT(*) FILTER (
            WHERE emailed_parent = TRUE
              AND created_at >= NOW() - INTERVAL '7 days'
          ) AS parent_sent_last_7d,

          COUNT(*) FILTER (
            WHERE emailed_coach = TRUE
              AND created_at >= NOW() - INTERVAL '7 days'
          ) AS coach_sent_last_7d,

          COUNT(*) FILTER (
            WHERE emailed_parent = TRUE
              AND ${matchWhere}
          ) AS total_parent_sent,

          COUNT(*) FILTER (
            WHERE emailed_coach = TRUE
              AND ${matchWhere}
          ) AS total_coach_sent,

          (
            COUNT(*) FILTER (
              WHERE emailed_parent = TRUE
                AND ${matchWhere}
            ) +
            COUNT(*) FILTER (
              WHERE emailed_coach = TRUE
                AND ${matchWhere}
            )
          ) AS total_match_emails_sent,

          MAX(created_at) FILTER (
            WHERE (emailed_parent = TRUE OR emailed_coach = TRUE)
              AND ${matchWhere}
          ) AS latest_created_at
        FROM public.match_notification_log
        `
      ),

      pool.query<{
        event_name: string | null;
        total_sent: string | number | null;
      }>(
        `
        SELECT
          COALESCE(NULLIF(TRIM(event_name), ''), 'Unknown Event') AS event_name,
          COUNT(*) AS total_sent
        FROM public.recruiting_alert_log
        WHERE ${recruitingWhere}
        GROUP BY COALESCE(NULLIF(TRIM(event_name), ''), 'Unknown Event')
        ORDER BY COUNT(*) DESC, event_name ASC
        LIMIT 10
        `
      ),

      pool.query<{
        type: string;
        created_at: string | null;
        event_name: string | null;
        sent_to_email: string | null;
        weight_class: string | null;
        age_group: string | null;
        wave: string | null;
        audience: string;
        wrestler_interest_id: number | null;
        coach_need_id: number | null;
      }>(
        `
        SELECT
          'recruiting_alert' AS type,
          sent_at AS created_at,
          event_name,
          sent_to_email,
          weight_class,
          age_group,
          wave,
          'parent' AS audience,
          wrestler_interest_id,
          coach_need_id
        FROM public.recruiting_alert_log
        WHERE ${recruitingWhere}
        ORDER BY sent_at DESC
        LIMIT 100
        `
      ),

      pool.query<{
        type: string;
        created_at: string | null;
        event_name: string | null;
        sent_to_email: string | null;
        audience: string;
        wrestler_interest_id: number | null;
        coach_need_id: number | null;
      }>(
        `
        SELECT *
        FROM (
          SELECT
            'match_notification' AS type,
            created_at,
            event_name,
            parent_email AS sent_to_email,
            'parent' AS audience,
            wrestler_interest_id,
            coach_need_id
          FROM public.match_notification_log
          WHERE emailed_parent = TRUE
            AND ${matchWhere}

          UNION ALL

          SELECT
            'match_notification' AS type,
            created_at,
            event_name,
            coach_email AS sent_to_email,
            'coach' AS audience,
            wrestler_interest_id,
            coach_need_id
          FROM public.match_notification_log
          WHERE emailed_coach = TRUE
            AND ${matchWhere}
        ) recent_match_notifications
        ORDER BY created_at DESC
        LIMIT 100
        `
      ),

      pool.query<{
        label: string;
        count: string | number | null;
        sort_at: string;
      }>(
        `
        SELECT
          ${recruitingSeriesCfg.bucketExpr} AS label,
          COUNT(*) AS count,
          ${recruitingSeriesCfg.bucketOrderExpr}::text AS sort_at
        FROM public.recruiting_alert_log
        WHERE ${recruitingSeriesCfg.whereExpr}
        GROUP BY 1, 3
        ORDER BY 3 ASC
        `
      ),

      pool.query<{
        label: string;
        count: string | number | null;
        sort_at: string;
      }>(
        `
        SELECT
          ${matchSeriesCfg.bucketExpr} AS label,
          COUNT(*) AS count,
          ${matchSeriesCfg.bucketOrderExpr}::text AS sort_at
        FROM (
          SELECT created_at
          FROM public.match_notification_log
          WHERE emailed_parent = TRUE
            AND ${matchSeriesCfg.whereExpr}

          UNION ALL

          SELECT created_at
          FROM public.match_notification_log
          WHERE emailed_coach = TRUE
            AND ${matchSeriesCfg.whereExpr}
        ) sent_match_emails
        GROUP BY 1, 3
        ORDER BY 3 ASC
        `
      ),
    ]);

    const recruitingStats = recruitingStatsQ.rows[0] ?? {
      sent_last_24h: 0,
      sent_last_7d: 0,
      total_sent: 0,
      latest_sent_at: null,
    };

    const matchStats = matchStatsQ.rows[0] ?? {
      parent_sent_last_24h: 0,
      coach_sent_last_24h: 0,
      parent_sent_last_7d: 0,
      coach_sent_last_7d: 0,
      total_parent_sent: 0,
      total_coach_sent: 0,
      total_match_emails_sent: 0,
      latest_created_at: null,
    };

    const recentActivity = [
      ...recentRecruitingQ.rows.map((row) => ({
        type: row.type,
        created_at: row.created_at,
        event_name: row.event_name,
        sent_to_email: row.sent_to_email,
        weight_class: row.weight_class,
        age_group: row.age_group,
        wave: row.wave,
        audience: row.audience,
        wrestler_interest_id: row.wrestler_interest_id,
        coach_need_id: row.coach_need_id,
      })),
      ...recentMatchQ.rows.map((row) => ({
        type: row.type,
        created_at: row.created_at,
        event_name: row.event_name,
        sent_to_email: row.sent_to_email,
        weight_class: null,
        age_group: null,
        wave: null,
        audience: row.audience,
        wrestler_interest_id: row.wrestler_interest_id,
        coach_need_id: row.coach_need_id,
      })),
    ]
      .filter((row) => {
        if (!q) return true;

        const haystack = [
          row.type,
          row.event_name,
          row.sent_to_email,
          row.weight_class,
          row.age_group,
          row.wave,
          row.audience,
        ]
          .map((v) => safeStr(v).toLowerCase())
          .join(" ");

        return haystack.includes(q);
      })
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 100);

    return NextResponse.json({
      ok: true,
      q: q || "",
      range,

      stats: {
        recruiting_alerts: {
          sent_last_24h: Number(recruitingStats.sent_last_24h ?? 0),
          sent_last_7d: Number(recruitingStats.sent_last_7d ?? 0),
          total_sent: Number(recruitingStats.total_sent ?? 0),
          latest_sent_at: recruitingStats.latest_sent_at ?? null,
        },

        match_notifications: {
          parent_sent_last_24h: Number(matchStats.parent_sent_last_24h ?? 0),
          coach_sent_last_24h: Number(matchStats.coach_sent_last_24h ?? 0),
          parent_sent_last_7d: Number(matchStats.parent_sent_last_7d ?? 0),
          coach_sent_last_7d: Number(matchStats.coach_sent_last_7d ?? 0),
          total_parent_sent: Number(matchStats.total_parent_sent ?? 0),
          total_coach_sent: Number(matchStats.total_coach_sent ?? 0),
          total_match_emails_sent: Number(
            matchStats.total_match_emails_sent ?? 0
          ),
          latest_created_at: matchStats.latest_created_at ?? null,
        },
      },

      charts: {
        recruiting_alerts_over_time: recruitingSeriesQ.rows.map((row) => ({
          label: row.label,
          count: Number(row.count ?? 0),
        })),
        match_emails_over_time: matchSeriesQ.rows.map((row) => ({
          label: row.label,
          count: Number(row.count ?? 0),
        })),
        top_events: topEventsQ.rows.map((row) => ({
          label: row.event_name ?? "Unknown Event",
          count: Number(row.total_sent ?? 0),
        })),
      },

      top_events: topEventsQ.rows.map((row) => ({
        event_name: row.event_name ?? "Unknown Event",
        total_sent: Number(row.total_sent ?? 0),
      })),

      recent_activity: recentActivity,
    });
  } catch (err: any) {
    console.error("admin alerts api error", err);
    return jsonError(err?.message || "Failed to load admin alerts", 500);
  }
}