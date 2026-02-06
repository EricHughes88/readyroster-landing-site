// lib/activity.ts
import { pool } from "@/lib/db";

export type ActivityEvent = {
  userId: number;
  eventType: string;          // e.g. "NEED_CREATED"
  entityType?: string | null; // e.g. "team_need"
  entityId?: number | null;   // row id
  metadata?: Record<string, any>;
};

export async function logActivity(e: ActivityEvent) {
  const metadata = e.metadata ?? {};
  await pool.query(
    `
    insert into public.activity_events
      (user_id, event_type, entity_type, entity_id, metadata)
    values ($1, $2, $3, $4, $5::jsonb)
    `,
    [
      e.userId,
      e.eventType,
      e.entityType ?? null,
      e.entityId ?? null,
      JSON.stringify(metadata),
    ]
  );
}
