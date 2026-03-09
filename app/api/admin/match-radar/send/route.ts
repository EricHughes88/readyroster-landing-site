import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { sendTransactionalEmail } from "@/lib/email";
import {
  matchFoundCoachEmail,
  matchFoundParentEmail,
} from "@/lib/emailTemplates";

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

  return { ok: true as const, email };
}

async function ensureLogTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.match_notification_log (
      id BIGSERIAL PRIMARY KEY,
      wrestler_interest_id BIGINT NOT NULL,
      coach_need_id BIGINT NOT NULL,
      emailed_parent BOOLEAN NOT NULL DEFAULT FALSE,
      emailed_coach BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (wrestler_interest_id, coach_need_id)
    );
  `);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return jsonError("Unauthorized", auth.status);

    const body = await req.json().catch(() => null);
    const wrestlerInterestId = Number(body?.wrestler_interest_id);
    const coachNeedId = Number(body?.coach_need_id);

    if (!Number.isFinite(wrestlerInterestId) || !Number.isFinite(coachNeedId)) {
      return jsonError("wrestler_interest_id and coach_need_id are required", 400);
    }

    await ensureLogTable();

    const pairRes = await pool.query(
      `
      SELECT
        wi.id AS wrestler_interest_id,
        cn.id AS coach_need_id,
        wi.event_name,
        wi.weight_class,
        wi.age_group,

        NULLIF(
          TRIM(COALESCE(w.first_name, '') || ' ' || COALESCE(w.last_name, '')),
          ''
        ) AS wrestler_name,
        w.city AS athlete_city,
        w.state AS athlete_state,

        NULLIF(
          TRIM(COALESCE(u_parent.firstname, '') || ' ' || COALESCE(u_parent.lastname, '')),
          ''
        ) AS parent_name,
        u_parent.email AS parent_email,

        NULLIF(t.teamname, '') AS team_name,
        NULLIF(
          COALESCE(
            t.coach_name,
            TRIM(COALESCE(u_coach.firstname, '') || ' ' || COALESCE(u_coach.lastname, ''))
          ),
          ''
        ) AS coach_name,
        COALESCE(u_coach.email, t.contactemail) AS coach_email,

        COALESCE(mnl.emailed_parent, false) AS emailed_parent,
        COALESCE(mnl.emailed_coach, false) AS emailed_coach
      FROM public.wrestler_interests wi
      JOIN public.coach_needs cn
        ON cn.id = $2
      LEFT JOIN public.wrestlers w
        ON w.id = wi.wrestler_id
      LEFT JOIN public.users u_parent
        ON u_parent.id = w.parent_user_id
      LEFT JOIN public.teams t
        ON t.userid = cn.coach_user_id
      LEFT JOIN public.users u_coach
        ON u_coach.id = cn.coach_user_id
      LEFT JOIN public.match_notification_log mnl
        ON mnl.wrestler_interest_id = wi.id
       AND mnl.coach_need_id = cn.id
      WHERE wi.id = $1
      LIMIT 1
      `,
      [wrestlerInterestId, coachNeedId]
    );

    if (pairRes.rows.length === 0) {
      return jsonError("Match pair not found", 404);
    }

    const pair = pairRes.rows[0];

    await pool.query(
      `
      INSERT INTO public.match_notification_log
        (wrestler_interest_id, coach_need_id, emailed_parent, emailed_coach)
      VALUES ($1, $2, false, false)
      ON CONFLICT (wrestler_interest_id, coach_need_id) DO NOTHING
      `,
      [wrestlerInterestId, coachNeedId]
    );

    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const matchUrl = `${baseUrl}/admin/match-radar?wrestler_interest_id=${wrestlerInterestId}&coach_need_id=${coachNeedId}`;

    let emailedParent = Boolean(pair.emailed_parent);
    let emailedCoach = Boolean(pair.emailed_coach);

    if (!emailedParent && pair.parent_email) {
      const tpl = matchFoundParentEmail({
        parentName: pair.parent_name,
        wrestlerName: pair.wrestler_name || "your wrestler",
        eventName: pair.event_name,
        coachName: pair.coach_name,
        teamName: pair.team_name,
        matchUrl,
      });

      const res = await sendTransactionalEmail({
        to: pair.parent_email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });

      if (res.ok) {
        emailedParent = true;
        await pool.query(
          `
          UPDATE public.match_notification_log
          SET emailed_parent = true
          WHERE wrestler_interest_id = $1
            AND coach_need_id = $2
          `,
          [wrestlerInterestId, coachNeedId]
        );
      } else {
        console.error("Manual send parent email failed:", res.error);
      }
    }

    if (!emailedCoach && pair.coach_email) {
      const tpl = matchFoundCoachEmail({
        coachName: pair.coach_name,
        wrestlerName: pair.wrestler_name || "athlete",
        eventName: pair.event_name,
        parentName: pair.parent_name,
        matchUrl,
      });

      const res = await sendTransactionalEmail({
        to: pair.coach_email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });

      if (res.ok) {
        emailedCoach = true;
        await pool.query(
          `
          UPDATE public.match_notification_log
          SET emailed_coach = true
          WHERE wrestler_interest_id = $1
            AND coach_need_id = $2
          `,
          [wrestlerInterestId, coachNeedId]
        );
      } else {
        console.error("Manual send coach email failed:", res.error);
      }
    }

    return NextResponse.json({
      ok: true,
      emailed_parent: emailedParent,
      emailed_coach: emailedCoach,
    });
  } catch (err: any) {
    console.error("admin manual outreach POST error:", err);
    return jsonError("Failed to send outreach", 500, err?.message ?? err);
  }
}