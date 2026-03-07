import { pool } from "@/lib/db";

type MatchPair = {
  wrestler_interest_id: number;
  coach_need_id: number;
  event_name: string | null;
  parent_email: string | null;
  parent_name: string | null;
  coach_email: string | null;
  coach_name: string | null;
};

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

async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
}) {
  console.log("EMAIL SEND", args);
}

function parentSubject(eventName: string) {
  return `Ready Roster found a potential team for ${eventName}`;
}

function coachSubject(eventName: string) {
  return `Ready Roster found a potential athlete for ${eventName}`;
}

function parentBody(parentName: string | null, eventName: string) {
  return `Hello ${parentName || "there"},

Ready Roster found a potential team for ${eventName} based on your wrestler’s posted interest.

Log in to Ready Roster to review the opportunity.

Thanks,
Ready Roster`;
}

function coachBody(coachName: string | null, eventName: string) {
  return `Hello ${coachName || "Coach"},

Ready Roster found a potential athlete for ${eventName} based on one of your posted team needs.

Log in to Ready Roster to review the potential match.

Thanks,
Ready Roster`;
}

async function getMatchesForInterest(interestId: number): Promise<MatchPair[]> {
  const res = await pool.query<MatchPair>(
    `
    SELECT
      wi.id AS wrestler_interest_id,
      cn.id AS coach_need_id,
      wi.event_name,
      u_parent.email AS parent_email,
      TRIM(COALESCE(u_parent.firstname, '') || ' ' || COALESCE(u_parent.lastname, '')) AS parent_name,
      COALESCE(u_coach.email, t.contactemail) AS coach_email,
      COALESCE(
        t.coach_name,
        TRIM(COALESCE(u_coach.firstname, '') || ' ' || COALESCE(u_coach.lastname, ''))
      ) AS coach_name
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
      TRIM(COALESCE(u_parent.firstname, '') || ' ' || COALESCE(u_parent.lastname, '')) AS parent_name,
      COALESCE(u_coach.email, t.contactemail) AS coach_email,
      COALESCE(
        t.coach_name,
        TRIM(COALESCE(u_coach.firstname, '') || ' ' || COALESCE(u_coach.lastname, ''))
      ) AS coach_name
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

  for (const pair of pairs) {
    const eventName = pair.event_name || "your event";

    const existing = await pool.query(
      `
      SELECT id, emailed_parent, emailed_coach
      FROM public.match_notification_log
      WHERE wrestler_interest_id = $1
        AND coach_need_id = $2
      LIMIT 1
      `,
      [pair.wrestler_interest_id, pair.coach_need_id]
    );

    let emailedParent = false;
    let emailedCoach = false;

    if (existing.rows.length === 0) {
      await pool.query(
        `
        INSERT INTO public.match_notification_log
          (wrestler_interest_id, coach_need_id, emailed_parent, emailed_coach)
        VALUES ($1, $2, false, false)
        `,
        [pair.wrestler_interest_id, pair.coach_need_id]
      );
    } else {
      emailedParent = existing.rows[0].emailed_parent;
      emailedCoach = existing.rows[0].emailed_coach;
    }

    if (!emailedParent && pair.parent_email) {
      await sendEmail({
        to: pair.parent_email,
        subject: parentSubject(eventName),
        text: parentBody(pair.parent_name, eventName),
      });

      await pool.query(
        `
        UPDATE public.match_notification_log
        SET emailed_parent = true
        WHERE wrestler_interest_id = $1
          AND coach_need_id = $2
        `,
        [pair.wrestler_interest_id, pair.coach_need_id]
      );
    }

    if (!emailedCoach && pair.coach_email) {
      await sendEmail({
        to: pair.coach_email,
        subject: coachSubject(eventName),
        text: coachBody(pair.coach_name, eventName),
      });

      await pool.query(
        `
        UPDATE public.match_notification_log
        SET emailed_coach = true
        WHERE wrestler_interest_id = $1
          AND coach_need_id = $2
        `,
        [pair.wrestler_interest_id, pair.coach_need_id]
      );
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