// lib/notifications.ts
import { pool } from "@/lib/db";

export type NotificationType =
  | "match_request"
  | "match_confirmed"
  | "new_message"
  | "system";

export async function createNotification(args: {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}) {
  const userId = Number(args.userId || 0);
  if (!userId) return;

  await pool.query(
    `
    INSERT INTO public.notifications
      (user_id, type, title, body, link, is_read, created_at)
    VALUES
      ($1, $2, $3, $4, $5, false, NOW())
    `,
    [userId, args.type, args.title, args.body, args.link ?? null]
  );
}
