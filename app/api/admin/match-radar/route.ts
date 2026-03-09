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

function getSuperEmails(): string[] {
  return String(process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin() {
  const session = (await getServerSession(authConfig as any)) as any;
  const email = String(session?.user?.email ?? "").toLowerCase();

  if (!email) return { ok: false as const, status: 401 };

  const superAdmins = getSuperEmails();
  if (!superAdmins.includes(email)) {
    return { ok: false as const, status: 403 };
  }

  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return jsonError("Unauthorized", auth.status);

    const { searchParams } = new URL(req.url);
    const eventName = (searchParams.get("event_name") ?? "").trim();
    const state = (searchParams.get("state") ?? "").trim();
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") ?? "250"), 1),
      1000
    );

    const values: any[] = [];
    const filters: string[] = [];

    if (eventName) {
      values.push(eventName);
      filters.push(`LOWER(TRIM(wi.event_name)) = LOWER(TRIM($${values.length}))`);
    }

    if (state) {
      values.push(state);
      filters.push(
        `LOWER(TRIM(COALESCE(w.state, ''))) = LOWER(TRIM($${values.length}))`
      );
    }

    values.push(limit);

    const result = await pool.query(
      `
      SELECT
        wi.id AS wrestler_interest_id,
        cn.id AS coach_need_id,

        wi.event_name,
        wi.weight_class,
        wi.age_group,

        w.id AS wrestler_id,
        w.first_name,
        w.last_name,
        w.city AS athlete_city,
        w.state AS athlete_state,
        w.parent_user_id,

        NULLIF(
          TRIM(COALESCE(u_parent.firstname, '') || ' ' || COALESCE(u_parent.lastname, '')),
          ''
        ) AS parent_name,
        u_parent.email AS parent_email,

        cn.coach_user_id,
        NULLIF(t.teamname, '') AS team_name,
        NULLIF(
          COALESCE(
            t.coach_name,
            TRIM(COALESCE(u_coach.firstname, '') || ' ' || COALESCE(u_coach.lastname, ''))
          ),
          ''
        ) AS coach_name,
        COALESCE(u_coach.email, t.contactemail) AS coach_email,
        cn.city AS coach_city,
        cn.state AS coach_state,

        m.id AS match_id,
        m.status AS match_status,

        COALESCE(mnl.emailed_parent, false) AS emailed_parent,
        COALESCE(mnl.emailed_coach, false) AS emailed_coach,
        mnl.created_at AS notification_created_at,

        (
          CASE
            WHEN LOWER(TRIM(COALESCE(wi.event_name, ''))) = LOWER(TRIM(COALESCE(cn.event_name, '')))
            THEN 50 ELSE 0
          END
          +
          CASE
            WHEN LOWER(TRIM(COALESCE(wi.weight_class, ''))) = LOWER(TRIM(COALESCE(cn.weight_class, '')))
            THEN 30 ELSE 0
          END
          +
          CASE
            WHEN LOWER(TRIM(COALESCE(wi.age_group, ''))) = LOWER(TRIM(COALESCE(cn.age_group, '')))
            THEN 20 ELSE 0
          END
          +
          CASE
            WHEN LOWER(TRIM(COALESCE(w.state, ''))) = LOWER(TRIM(COALESCE(cn.state, '')))
                 AND COALESCE(w.state, '') <> ''
            THEN 10 ELSE 0
          END
        ) AS match_score

      FROM public.wrestler_interests wi
      JOIN public.coach_needs cn
        ON LOWER(TRIM(cn.event_name)) = LOWER(TRIM(wi.event_name))
       AND LOWER(TRIM(cn.age_group)) = LOWER(TRIM(wi.age_group))
       AND LOWER(TRIM(cn.weight_class)) = LOWER(TRIM(wi.weight_class))

      LEFT JOIN public.wrestlers w
        ON w.id = wi.wrestler_id

      LEFT JOIN public.users u_parent
        ON u_parent.id = w.parent_user_id

      LEFT JOIN public.teams t
        ON t.userid = cn.coach_user_id

      LEFT JOIN public.users u_coach
        ON u_coach.id = cn.coach_user_id

      LEFT JOIN public.matches m
        ON m.wrestler_interest_id = wi.id
       AND m.coach_need_id = cn.id

      LEFT JOIN public.match_notification_log mnl
        ON mnl.wrestler_interest_id = wi.id
       AND mnl.coach_need_id = cn.id

      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}

      ORDER BY
        match_score DESC,
        wi.event_name ASC,
        w.last_name ASC NULLS LAST,
        w.first_name ASC NULLS LAST,
        cn.id DESC

      LIMIT $${values.length}
      `,
      values
    );

    return NextResponse.json({
      ok: true,
      count: result.rows.length,
      rows: result.rows,
    });
  } catch (err: any) {
    console.error("admin match radar GET error:", err);
    return jsonError("Failed to load match radar", 500, err?.message ?? err);
  }
}