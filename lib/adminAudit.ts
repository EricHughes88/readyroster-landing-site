// lib/adminAudit.ts
import pg from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __RR_PG_POOL__: pg.Pool | undefined;
}

const { Pool } = pg;

function getPool(): pg.Pool {
  const conn = process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL not set");
  if (!global.__RR_PG_POOL__) {
    global.__RR_PG_POOL__ = new Pool({ connectionString: conn });
  }
  return global.__RR_PG_POOL__;
}

export type AdminAuditEvent = {
  adminUserId: number;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: any;
  ip?: string | null;
  userAgent?: string | null;
};

export async function logAdminEvent(evt: AdminAuditEvent) {
  const pool = getPool();

  await pool.query(
    `
    insert into public.admin_audit_log
      (admin_user_id, action, entity_type, entity_id, metadata, ip, user_agent)
    values
      ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      evt.adminUserId,
      evt.action,
      evt.entityType ?? null,
      evt.entityId ?? null,
      evt.metadata ?? null,
      evt.ip ?? null,
      evt.userAgent ?? null,
    ]
  );
}