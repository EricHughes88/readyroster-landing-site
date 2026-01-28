// app/api/test-notify/notifyUser.ts
import webpush from "web-push";
import { pool } from "@/lib/db";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:support@itsreadyroster.com";

let vapidReady = false;

function ensureVapid() {
  if (vapidReady) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidReady = true;
}

export async function notifyUser({
  userId,
  type = "system",
  title,
  body,
  link,
  push = false,
}: {
  userId: number;
  type?: "match" | "message" | "system";
  title: string;
  body: string;
  link?: string;
  push?: boolean;
}) {
  // Always insert in-app notification
  await pool.query(
    `insert into notifications (user_id, type, title, body, link)
     values ($1,$2,$3,$4,$5)`,
    [userId, type, title, body, link ?? null]
  );

  if (!push) return;

  ensureVapid();
  if (!vapidReady) return;

  // (Push sending later—after you add subscriptions)
}
