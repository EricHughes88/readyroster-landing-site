import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type NotifyArgs = {
  wrestlerId: number;
  athleteName: string | null;
  eventName: string | null;
  eventDate?: string | null;
  weightClass?: string | null;
  ageGroup?: string | null;
};

export async function notifyAthleteFollowersOnNewInterest({
  wrestlerId,
  athleteName,
  eventName,
  eventDate,
  weightClass,
  ageGroup,
}: NotifyArgs) {
  const client = await pool.connect();

  try {
    const followersRes = await client.query<{ coach_user_id: number }>(
      `
      SELECT coach_user_id
      FROM public.athlete_follows
      WHERE wrestler_id = $1
      `,
      [wrestlerId]
    );

    const followers = followersRes.rows ?? [];

    if (followers.length === 0) {
      return { ok: true, inserted: 0 };
    }

    const safeAthleteName = athleteName?.trim() || "An athlete you follow";
    const safeEventName = eventName?.trim() || "a new event";

    const detailParts = [
      eventDate?.trim() ? `Date: ${eventDate}` : null,
      ageGroup?.trim() ? `Age: ${ageGroup}` : null,
      weightClass?.trim() ? `Weight: ${weightClass}` : null,
    ].filter(Boolean);

    const body =
      detailParts.length > 0
        ? `${safeAthleteName} posted a new event interest for ${safeEventName}. ${detailParts.join(" • ")}`
        : `${safeAthleteName} posted a new event interest for ${safeEventName}.`;

    let inserted = 0;

    for (const row of followers) {
      const coachUserId = Number(row.coach_user_id);
      if (!coachUserId) continue;

      await client.query(
        `
        INSERT INTO public.notifications
        (
          user_id,
          type,
          title,
          body,
          link,
          created_at,
          is_read
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), FALSE)
        `,
        [
          coachUserId,
          "athlete_interest_posted",
          "Athlete update",
          body,
          `/athletes/${wrestlerId}`,
        ]
      );

      inserted += 1;
    }

    return { ok: true, inserted };
  } finally {
    client.release();
  }
}