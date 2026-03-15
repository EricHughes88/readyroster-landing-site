// lib/coachLeads.ts
import { pool } from "@/lib/db";
import { sendCoachLeadsEmail } from "@/lib/email";

type CoachLeadRow = {
  coach_need_id: number;
  coach_user_id: number;
  event_name: string | null;
  weight_class: string | null;
  age_group: string | null;
  coach_email: string | null;
  coach_firstname: string | null;
  athlete_id: number;
  athlete_firstname: string | null;
  athlete_lastname: string | null;
  athlete_state: string | null;
};

function normalize(v: unknown) {
  return String(v ?? "").trim();
}

export async function runCoachLeadDigest() {
  const q = await pool.query<CoachLeadRow>(
    `
    SELECT
      cn.id AS coach_need_id,
      cn.coach_user_id,
      cn.event_name,
      cn.weight_class,
      cn.age_group,
      u.email AS coach_email,
      u.firstname AS coach_firstname,
      a.athleteid AS athlete_id,
      a.firstname AS athlete_firstname,
      a.lastname AS athlete_lastname,
      a.state AS athlete_state
    FROM public.coach_needs cn
    JOIN public.users u
      ON u.id = cn.coach_user_id
    JOIN public.wrestler_interests wi
      ON COALESCE(UPPER(TRIM(wi.weight_class)), '') = COALESCE(UPPER(TRIM(cn.weight_class)), '')
     AND COALESCE(UPPER(TRIM(wi.age_group)), '') = COALESCE(UPPER(TRIM(cn.age_group)), '')
     AND wi.created_at >= NOW() - INTERVAL '120 days'
    JOIN public.athletes a
      ON a.athleteid = wi.wrestler_id
    WHERE cn.is_open = TRUE
      AND COALESCE(NULLIF(TRIM(u.email), ''), '') <> ''
    ORDER BY cn.id, a.athleteid
    `
  );

  const grouped = new Map<
    number,
    {
      coachNeedId: number;
      coachUserId: number;
      eventName: string;
      weightClass: string;
      ageGroup: string;
      coachEmail: string;
      coachFirstname: string;
      leads: Array<{
        athleteName: string;
        weightClass: string;
        ageGroup: string;
        state?: string | null;
      }>;
    }
  >();

  for (const row of q.rows) {
    const needId = Number(row.coach_need_id);
    if (!grouped.has(needId)) {
      grouped.set(needId, {
        coachNeedId: needId,
        coachUserId: Number(row.coach_user_id),
        eventName: normalize(row.event_name),
        weightClass: normalize(row.weight_class),
        ageGroup: normalize(row.age_group),
        coachEmail: normalize(row.coach_email),
        coachFirstname: normalize(row.coach_firstname),
        leads: [],
      });
    }

    const g = grouped.get(needId)!;
    g.leads.push({
      athleteName:
        `${normalize(row.athlete_firstname)} ${normalize(row.athlete_lastname)}`.trim() ||
        "Athlete",
      weightClass: normalize(row.weight_class),
      ageGroup: normalize(row.age_group),
      state: row.athlete_state,
    });
  }

  let emailsSent = 0;

  for (const item of grouped.values()) {
    if (!item.coachEmail || item.leads.length === 0) continue;

    const topLeads = item.leads.slice(0, 5);

    const emailResult = await sendCoachLeadsEmail({
      to: item.coachEmail,
      coachName: item.coachFirstname,
      eventName: item.eventName || "your event",
      leads: topLeads,
    });

    if (!emailResult.ok) continue;

    emailsSent++;

    await pool.query(
      `
      INSERT INTO public.coach_lead_email_log (
        coach_need_id,
        coach_user_id,
        event_name,
        lead_count,
        sent_to_email
      )
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        item.coachNeedId,
        item.coachUserId,
        item.eventName,
        topLeads.length,
        item.coachEmail,
      ]
    );
  }

  return {
    ok: true,
    coachNeedsWithLeads: grouped.size,
    emailsSent,
  };
}