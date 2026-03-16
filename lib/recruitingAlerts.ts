// lib/recruitingAlerts.ts
import { pool } from "@/lib/db";
import { sendRecruitingAlertEmail } from "@/lib/email";

type CoachNeedRow = {
  id: number;
  event_name: string | null;
  event_date: string | null;
  weight_class: string | null;
  age_group: string | null;
  state: string | null;
};

type CandidateRow = {
  athlete_id: number;
  wrestler_interest_id: number | null;
  first_name: string | null;
  last_name: string | null;
  athlete_state: string | null;
  email: string | null;
  parent_firstname: string | null;
  parent_lastname: string | null;
  interest_created_at: string | null;
};

type RecruitingAlertRunResult = {
  ok: boolean;
  totalNeedsScanned: number;
  totalCandidatesMatched: number;
  totalEmailsSent: number;
  totalSkippedAlreadySent: number;
  totalSkippedMissingEmail: number;
  totalEmailFailures: number;
  results: Array<{
    coachNeedId: number;
    eventName: string;
    wave: "state" | "national" | null;
    candidates: number;
    sent: number;
    skipped: number;
  }>;
};

function normalize(v: unknown) {
  return String(v ?? "").trim();
}

function daysUntil(dateStr?: string | null) {
  if (!dateStr) return null;

  const today = new Date();
  const eventDate = new Date(dateStr);

  if (Number.isNaN(eventDate.getTime())) return null;

  const diffMs = eventDate.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getWave(daysOut: number | null): "state" | "national" | null {
  if (daysOut === null) return null;
  if (daysOut < 0) return null;
  if (daysOut > 21) return "state";
  return "national";
}

async function getOpenCoachNeeds(): Promise<CoachNeedRow[]> {
  const q = await pool.query<CoachNeedRow>(
    `
    SELECT
      cn.id,
      cn.event_name,
      cn.event_date,
      cn.weight_class,
      cn.age_group,
      cn.state
    FROM public.coach_needs cn
    WHERE cn.is_open = TRUE
      AND COALESCE(cn.is_visible, TRUE) = TRUE
      AND cn.event_date IS NOT NULL
      AND cn.event_date >= CURRENT_DATE
      AND COALESCE(NULLIF(TRIM(cn.event_name), ''), '') <> ''
      AND COALESCE(NULLIF(TRIM(cn.weight_class), ''), '') <> ''
      AND COALESCE(NULLIF(TRIM(cn.age_group), ''), '') <> ''
    ORDER BY cn.event_date ASC
    `
  );

  return q.rows;
}

async function findCandidatesForNeed(
  need: CoachNeedRow,
  wave: "state" | "national"
): Promise<CandidateRow[]> {
  const params: string[] = [
    normalize(need.weight_class),
    normalize(need.age_group),
  ];

  let stateClause = "";
  if (wave === "state") {
    params.push(normalize(need.state));
    stateClause = `AND COALESCE(UPPER(TRIM(a.state)), '') = UPPER(TRIM($3))`;
  }

  const q = await pool.query<CandidateRow>(
    `
    SELECT DISTINCT ON (a.athleteid)
      a.athleteid AS athlete_id,
      wi.id AS wrestler_interest_id,
      a.firstname AS first_name,
      a.lastname AS last_name,
      a.state AS athlete_state,
      COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(a.parent_email), '')) AS email,
      u.firstname AS parent_firstname,
      u.lastname AS parent_lastname,
      wi.created_at AS interest_created_at
    FROM public.wrestler_interests wi
    JOIN public.athletes a
      ON a.athleteid = wi.wrestler_id
    LEFT JOIN public.users u
      ON u.user_id = a.userid
    WHERE COALESCE(UPPER(TRIM(wi.weight_class)), '') = UPPER(TRIM($1))
      AND COALESCE(UPPER(TRIM(wi.age_group)), '') = UPPER(TRIM($2))
      AND COALESCE(wi.is_visible, TRUE) = TRUE
      AND wi.created_at >= NOW() - INTERVAL '120 days'
      ${stateClause}
      AND COALESCE(NULLIF(TRIM(COALESCE(u.email, a.parent_email)), ''), '') <> ''
    ORDER BY a.athleteid, wi.created_at DESC
    `,
    params
  );

  return q.rows;
}

async function alreadyAlerted(coachNeedId: number, athleteId: number) {
  const q = await pool.query(
    `
    SELECT 1
    FROM public.recruiting_alert_log
    WHERE coach_need_id = $1
      AND athlete_id = $2
    LIMIT 1
    `,
    [coachNeedId, athleteId]
  );

  return q.rows.length > 0;
}

async function logAlert(args: {
  coachNeedId: number;
  athleteId: number;
  wrestlerInterestId: number | null;
  eventName: string;
  eventDate: string | null;
  weightClass: string;
  ageGroup: string;
  eventState: string | null;
  wave: "state" | "national";
  email: string;
}) {
  await pool.query(
    `
    INSERT INTO public.recruiting_alert_log (
      coach_need_id,
      athlete_id,
      wrestler_interest_id,
      event_name,
      event_date,
      weight_class,
      age_group,
      event_state,
      wave,
      sent_to_email
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (coach_need_id, athlete_id) DO NOTHING
    `,
    [
      args.coachNeedId,
      args.athleteId,
      args.wrestlerInterestId,
      args.eventName,
      args.eventDate,
      args.weightClass,
      args.ageGroup,
      args.eventState,
      args.wave,
      args.email,
    ]
  );
}

export async function runRecruitingAlerts(): Promise<RecruitingAlertRunResult> {
  const needs = await getOpenCoachNeeds();

  let totalNeedsScanned = 0;
  let totalCandidatesMatched = 0;
  let totalEmailsSent = 0;
  let totalSkippedAlreadySent = 0;
  let totalSkippedMissingEmail = 0;
  let totalEmailFailures = 0;

  const results: RecruitingAlertRunResult["results"] = [];

  for (const need of needs) {
    totalNeedsScanned++;

    const eventName = normalize(need.event_name);
    const weightClass = normalize(need.weight_class);
    const ageGroup = normalize(need.age_group);

    if (!eventName || !weightClass || !ageGroup) continue;

    const daysOut = daysUntil(need.event_date);
    const wave = getWave(daysOut);
    if (!wave) continue;

    const candidates = await findCandidatesForNeed(need, wave);
    totalCandidatesMatched += candidates.length;

    let sent = 0;
    let skipped = 0;

    for (const c of candidates) {
      if (!c.email) {
        totalSkippedMissingEmail++;
        skipped++;
        continue;
      }

      const exists = await alreadyAlerted(need.id, c.athlete_id);
      if (exists) {
        totalSkippedAlreadySent++;
        skipped++;
        continue;
      }

      const emailResult = await sendRecruitingAlertEmail({
        to: c.email,
        eventName,
        eventDate: need.event_date,
        weightClass,
        ageGroup,
        recipientName:
          c.parent_firstname ??
          c.first_name ??
          "there",
      });

      if (!emailResult.ok) {
        totalEmailFailures++;
        skipped++;
        console.error("Recruiting alert email failed", {
          coachNeedId: need.id,
          athleteId: c.athlete_id,
          email: c.email,
          error: emailResult.error,
        });
        continue;
      }

      await logAlert({
        coachNeedId: need.id,
        athleteId: c.athlete_id,
        wrestlerInterestId: c.wrestler_interest_id,
        eventName,
        eventDate: need.event_date,
        weightClass,
        ageGroup,
        eventState: need.state,
        wave,
        email: c.email,
      });

      sent++;
      totalEmailsSent++;
    }

    results.push({
      coachNeedId: need.id,
      eventName,
      wave,
      candidates: candidates.length,
      sent,
      skipped,
    });
  }

  return {
    ok: true,
    totalNeedsScanned,
    totalCandidatesMatched,
    totalEmailsSent,
    totalSkippedAlreadySent,
    totalSkippedMissingEmail,
    totalEmailFailures,
    results,
  };
}