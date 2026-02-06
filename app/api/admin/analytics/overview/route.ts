// app/api/admin/analytics/overview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function intParam(url: URL, key: string, def: number) {
  const raw = url.searchParams.get(key);
  const n = raw ? Number(raw) : def;
  return Number.isFinite(n) ? n : def;
}

function isAdmin(session: any) {
  return session?.user && (session.user as any).role === "Admin";
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const days = Math.min(Math.max(intParam(url, "days", 30), 1), 365);

    // KPIs:
    // - new users in range (users.created_at)
    // - active users in range (activity_events)
    // - totals by event type in range
    const kpiSql = `
      with params as (
        select now() - ($1::int * interval '1 day') as since
      ),
      new_users as (
        select count(*)::int as cnt
        from public.users u, params p
        where u.created_at >= p.since
      ),
      active_users as (
        select count(distinct ae.user_id)::int as cnt
        from public.activity_events ae, params p
        where ae.created_at >= p.since
      ),
      events_by_type as (
        select ae.event_type, count(*)::int as cnt
        from public.activity_events ae, params p
        where ae.created_at >= p.since
        group by ae.event_type
      )
      select
        (select cnt from new_users) as new_users,
        (select cnt from active_users) as active_users,
        coalesce((select cnt from events_by_type where event_type = 'NEED_CREATED'), 0) as needs_created,
        coalesce((select cnt from events_by_type where event_type = 'MATCH_REQUESTED'), 0) as matches_requested,
        coalesce((select cnt from events_by_type where event_type = 'MESSAGE_SENT'), 0) as messages_sent
    `;

    const kpiRes = await pool.query(kpiSql, [days]);
    const kpis = kpiRes.rows[0] ?? {
      new_users: 0,
      active_users: 0,
      needs_created: 0,
      matches_requested: 0,
      messages_sent: 0,
    };

    // Time series (zero-filled) for last N days
    const seriesSql = `
      with params as (
        select
          date_trunc('day', now())::date as today,
          (date_trunc('day', now()) - (($1::int - 1) * interval '1 day'))::date as start_day
      ),
      days as (
        select generate_series(
          (select start_day from params),
          (select today from params),
          interval '1 day'
        )::date as day
      ),
      users_per_day as (
        select date_trunc('day', created_at)::date as day, count(*)::int as cnt
        from public.users
        where created_at >= (select start_day from params)
        group by 1
      ),
      activity_per_day as (
        select date_trunc('day', created_at)::date as day, count(*)::int as cnt
        from public.activity_events
        where created_at >= (select start_day from params)
        group by 1
      )
      select
        d.day,
        coalesce(u.cnt, 0) as new_users,
        coalesce(a.cnt, 0) as activity_events
      from days d
      left join users_per_day u on u.day = d.day
      left join activity_per_day a on a.day = d.day
      order by d.day asc
    `;

    const seriesRes = await pool.query(seriesSql, [days]);

    return NextResponse.json({
      ok: true,
      rangeDays: days,
      kpis,
      series: seriesRes.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Failed to load analytics", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
