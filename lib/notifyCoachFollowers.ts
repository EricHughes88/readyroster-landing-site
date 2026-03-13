import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type NotifyArgs = {
  coachUserId: number;
  coachNeedId: number;
  eventName: string | null;
  ageGroup: string | null;
  weightClass: string | null;
};

export async function notifyCoachFollowersOnNeedPosted({
  coachUserId,
  coachNeedId,
  eventName,
  ageGroup,
  weightClass,
}: NotifyArgs) {
  const client = await pool.connect();

  try {
    const followersRes = await client.query<{ follower_user_id: number }>(
      `
      SELECT follower_user_id
      FROM public.user_follows
      WHERE followed_user_id = $1
      `,
      [coachUserId]
    );

    const followers = followersRes.rows ?? [];

    if (followers.length === 0) {
      return { ok: true, inserted: 0 };
    }

    let inserted = 0;

    for (const row of followers) {
      const followerUserId = Number(row.follower_user_id);
      if (!followerUserId) continue;

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
          followerUserId,
          "coach_need_posted",
          "A coach you follow posted a new need",
          `Event: ${eventName ?? "Unknown"} • Age: ${ageGroup ?? "N/A"} • Weight: ${weightClass ?? "N/A"}`,
          `/coach/needs/${coachNeedId}`,
        ]
      );

      inserted += 1;
    }

    return { ok: true, inserted };
  } finally {
    client.release();
  }
}