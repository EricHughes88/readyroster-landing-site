// app/api/admin/coaches/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { logAdminEvent } from "@/lib/adminAudit";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __RR_PG_POOL__: pg.Pool | undefined;
}

const { Pool } = pg;

function getPool(): pg.Pool {
  const conn = process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL not set");

  if (!global.__RR_PG_POOL__) {
    global.__RR_PG_POOL__ = new Pool({ connectionString: conn });
  }

  return global.__RR_PG_POOL__;
}

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

function getIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = (await getServerSession(authConfig as any)) as any;

  if (!session?.user) {
    return jsonError("Not signed in", 401);
  }

  const adminUserId = Number(session.user?.id ?? 0);
  const coachId = Number(params?.id ?? 0);

  if (!Number.isFinite(coachId) || coachId <= 0) {
    return jsonError("Invalid coach id", 400);
  }

  const pool = getPool();

  try {
    // 1) Coach / team profile
    const coachRes = await pool.query(
      `
      SELECT
        id,
        firstname,
        lastname,
        email,
        phone,
        created_at,
        teamid,
        teamname,
        coach_name,
        contactemail,
        logopath,
        city,
        state
      FROM public.admin_coaches_directory
      WHERE id = $1
      LIMIT 1
      `,
      [coachId]
    );

    const coach = coachRes.rows?.[0] ?? null;

    if (!coach) {
      return jsonError("Coach not found", 404);
    }

    // 2) Posted needs
    const needsRes = await pool.query(
      `
      SELECT
        cn.id,
        cn.event_name,
        cn.event_date,
        cn.age_group,
        cn.weight_class,
        cn.notes,
        cn.created_at,
        cn.city,
        cn.state,
        cn.is_open,
        cn.is_visible,
        cn.expired_at
      FROM public.coach_needs cn
      WHERE cn.coach_user_id = $1
      ORDER BY cn.created_at DESC NULLS LAST, cn.id DESC
      `,
      [coachId]
    );

    // 3) Matches / requests with real wrestler names
    const matchesRes = await pool.query(
      `
      SELECT
        m.id,
        m.status,
        wi.event_name,
        wi.event_date,
        wi.age_group,
        wi.weight_class,
        w.id AS athlete_id,
        NULLIF(
          TRIM(
            CONCAT(
              COALESCE(w.first_name, ''),
              ' ',
              COALESCE(w.last_name, '')
            )
          ),
          ''
        ) AS athlete_name,
        m.parent_ok,
        m.coach_ok,
        m.confirmed_at,
        m.created_at,
        m.updated_at
      FROM public.matches m
      LEFT JOIN public.wrestler_interests wi
        ON wi.id = m.wrestler_interest_id
      LEFT JOIN public.wrestlers w
        ON w.id = wi.wrestler_id
      WHERE m.coach_user_id = $1
      ORDER BY m.created_at DESC NULLS LAST, m.id DESC
      `,
      [coachId]
    );

    const matches = Array.isArray(matchesRes.rows)
      ? matchesRes.rows.map((row) => ({
          ...row,
          athlete_name:
            row.athlete_name ||
            (row.athlete_id ? `Wrestler #${row.athlete_id}` : "Unknown Athlete"),
        }))
      : [];

    if (Number.isFinite(adminUserId) && adminUserId > 0) {
      try {
        await logAdminEvent({
          adminUserId,
          action: "view_admin_coach_profile",
          entityType: "coach",
          entityId: coachId,
          metadata: {
            returnedNeeds: Array.isArray(needsRes.rows) ? needsRes.rows.length : 0,
            returnedMatches: matches.length,
          },
          ip: getIp(req),
          userAgent: req.headers.get("user-agent"),
        });
      } catch {
        // ignore audit logging issues
      }
    }

    return NextResponse.json({
      ok: true,
      coachId,
      coach,
      needs: Array.isArray(needsRes.rows) ? needsRes.rows : [],
      matches,
    });
  } catch (e: any) {
    console.error("[admin/coaches/[id]] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}