// lib/matchNotifications.ts
import { pool } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";
import {
  matchFoundCoachEmail,
  matchFoundParentEmail,
} from "@/lib/emailTemplates";

type MatchPair = {
  wrestler_interest_id: number;
  coach_need_id: number;
  event_name: string | null;
  parent_email: string | null;
  parent_name: string | null;
  coach_email: string | null;
  coach_name: string | null;
  wrestler_name: string | null;
  team_name: string | null;
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

async function ensureLogTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.match_notification_log (
      id BIGSERIAL PRIMARY KEY,
      wrestler_interest_id BIGINT NOT NULL,
      coach_need_id BIGINT NOT NULL,
      event_name TEXT,
      parent_email TEXT,
      coach_email TEXT,
      emailed_parent BOOLEAN NOT NULL DEFAULT FALSE,
      emailed_coach BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (wrestler_interest_id, coach_need_id)
    );
  `);

  await pool.query(`
    ALTER TABLE public.match_notification_log
    ADD COLUMN IF NOT EXISTS event_name TEXT
  `);

  await pool.query(`
    ALTER TABLE public.match_notification_log
    ADD COLUMN IF NOT EXISTS parent_email TEXT
  `);

  await pool.query(`
    ALTER TABLE public.match_notification_log
    ADD COLUMN IF NOT EXISTS coach_email TEXT
  `);
}

async function getMatchesForInterest(interestId: number): Promise<MatchPair[]> {
  const res = await pool.query<MatchPair>(
    `
    SELECT
      wi.id AS wrestler_interest_id,
      cn.id AS coach_need_id,
      wi.event_name,
      u_parent.email AS parent_email,
      NULLIF(
        TRIM(COALESCE(u_parent.firstname, '') || ' ' || COALESCE(u_parent.lastname, '')),
        ''
      ) AS parent_name,
      COALESCE(u_coach.email, t.contactemail) AS coach_email,
      NULLIF(
        COALESCE(
          t.coach_name,
          TRIM(COALESCE(u_coach.firstname, '') || ' ' || COALESCE(u_coach.lastname, ''))
        ),
        ''
      ) AS coach_name,
      NULLIF(
        TRIM(COALESCE(w.first_name, '') || ' ' || COALESCE(w.last_name, '')),
        ''
      ) AS wrestler_name,
      NULLIF(t.teamname, '') AS team_name
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
    WHERE wi.id = $1
    `,
    [interestId]
  );

  return res.rows;
}

async function getMatchesForCoachNeed(coachNeedId: number): Promise<MatchPair[]> {
  const res = await pool.query<MatchPair>(
    `
    SELECT
      wi.id AS wrestler_interest_id,
      cn.id AS coach_need_id,
      cn.event_name,
      u_parent.email AS parent_email,
      NULLIF(
        TRIM(COALESCE(u_parent.firstname, '') || ' ' || COALESCE(u_parent.lastname, '')),
        ''
      ) AS parent_name,
      COALESCE(u_coach.email, t.contactemail) AS coach_email,
      NULLIF(
        COALESCE(
          t.coach_name,
          TRIM(COALESCE(u_coach.firstname, '') || ' ' || COALESCE(u_coach.lastname, ''))
        ),
        ''
      ) AS coach_name,
      NULLIF(
        TRIM(COALESCE(w.first_name, '') || ' ' || COALESCE(w.last_name, '')),
        ''
      ) AS wrestler_name,
      NULLIF(t.teamname, '') AS team_name
    FROM public.coach_needs cn
    JOIN public.wrestler_interests wi
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
    WHERE cn.id = $1
    `,
    [coachNeedId]
  );

  return res.rows;
}

async function processPairs(pairs: MatchPair[]) {
  await ensureLogTable();

  const baseUrl = normalizeBaseUrl(
    process.env.APP_BASE_URL ?? "http://localhost:3000"
  );

  for (const pair of pairs) {
    const eventName = safeStr(pair.event_name) || "your event";
    const parentName = safeStr(pair.parent_name) || "there";
    const coachName = safeStr(pair.coach_name) || "Coach";
    const wrestlerName = safeStr(pair.wrestler_name) || "your wrestler";
    const teamName = safeStr(pair.team_name) || "team";
    const parentEmail = safeStr(pair.parent_email) || null;
    const coachEmail = safeStr(pair.coach_email) || null;

    const existing = await pool.query<{
      emailed_parent: boolean;
      emailed_coach: boolean;
    }>(
      `
      SELECT emailed_parent, emailed_coach
      FROM public.match_notification_log
      WHERE wrestler_interest_id = $1
        AND coach_need_id = $2
      LIMIT 1
      `,
      [pair.wrestler_interest_id, pair.coach_need_id]
    );

    const already = existing.rows[0] ?? {
      emailed_parent: false,
      emailed_coach: false,
    };

    if (existing.rows.length === 0) {
      await pool.query(
        `
        INSERT INTO public.match_notification_log
          (
            wrestler_interest_id,
            coach_need_id,
            event_name,
            parent_email,
            coach_email,
            emailed_parent,
            emailed_coach
          )
        VALUES ($1, $2, $3, $4, $5, false, false)
        ON CONFLICT (wrestler_interest_id, coach_need_id) DO NOTHING
        `,
        [
          pair.wrestler_interest_id,
          pair.coach_need_id,
          eventName,
          parentEmail,
          coachEmail,
        ]
      );
    } else {
      await pool.query(
        `
        UPDATE public.match_notification_log
        SET
          event_name = COALESCE(NULLIF($3, ''), event_name),
          parent_email = COALESCE(NULLIF($4, ''), parent_email),
          coach_email = COALESCE(NULLIF($5, ''), coach_email)
        WHERE wrestler_interest_id = $1
          AND coach_need_id = $2
        `,
        [
          pair.wrestler_interest_id,
          pair.coach_need_id,
          eventName,
          parentEmail ?? "",
          coachEmail ?? "",
        ]
      );
    }

    const matchUrl = `${baseUrl}/admin/match-radar?wrestler_interest_id=${pair.wrestler_interest_id}&coach_need_id=${pair.coach_need_id}`;

    let emailedParent = already.emailed_parent;
    let emailedCoach = already.emailed_coach;

    if (!emailedParent && pair.parent_email) {
      const tpl = matchFoundParentEmail({
        parentName,
        wrestlerName,
        eventName,
        coachName,
        teamName,
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
          SET
            emailed_parent = true,
            event_name = COALESCE(NULLIF($3, ''), event_name),
            parent_email = COALESCE(NULLIF($4, ''), parent_email)
          WHERE wrestler_interest_id = $1
            AND coach_need_id = $2
          `,
          [
            pair.wrestler_interest_id,
            pair.coach_need_id,
            eventName,
            parentEmail ?? "",
          ]
        );
      } else {
        console.error("Failed sending parent email:", res.error);
      }
    }

    if (!emailedCoach && pair.coach_email) {
      const tpl = matchFoundCoachEmail({
        coachName,
        wrestlerName,
        eventName,
        parentName,
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
          SET
            emailed_coach = true,
            event_name = COALESCE(NULLIF($3, ''), event_name),
            coach_email = COALESCE(NULLIF($4, ''), coach_email)
          WHERE wrestler_interest_id = $1
            AND coach_need_id = $2
          `,
          [
            pair.wrestler_interest_id,
            pair.coach_need_id,
            eventName,
            coachEmail ?? "",
          ]
        );
      } else {
        console.error("Failed sending coach email:", res.error);
      }
    }
  }
}

export async function notifyMatchesForInterest(interestId: number) {
  const pairs = await getMatchesForInterest(interestId);
  await processPairs(pairs);
}

export async function notifyMatchesForCoachNeed(coachNeedId: number) {
  const pairs = await getMatchesForCoachNeed(coachNeedId);
  await processPairs(pairs);
}