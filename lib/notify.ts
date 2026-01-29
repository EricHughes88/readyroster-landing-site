import webpush from "web-push";
import { pool } from "@/lib/db";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function notifyUser({
  userId,
  title,
  body,
  link,
  push = true,
}: {
  userId: number;
  title: string;
  body: string;
  link?: string;
  push?: boolean;
}) {
  // 1️⃣ Save in-app notification
  await pool.query(
    `
    insert into notifications (user_id, type, title, body, link)
    values ($1, 'system', $2, $3, $4)
    `,
    [userId, title, body, link ?? null]
  );

  if (!push) return;

  // 2️⃣ Send push notification
  const { rows } = await pool.query(
    `select endpoint, p256dh, auth from push_subscriptions where user_id = $1`,
    [userId]
  );

  for (const sub of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify({ title, body, url: link })
      );
    } catch {
      // cleanup dead subscriptions
      await pool.query(
        `delete from push_subscriptions where endpoint = $1`,
        [sub.endpoint]
      );
    }
  }
}
