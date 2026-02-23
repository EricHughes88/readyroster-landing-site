// app/api/inbox/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/* ------------------------------------------------------------------ */
/* Notifications read-column resolver (is_read vs read)                */
/* ------------------------------------------------------------------ */

let notifReadCol: "is_read" | "read" | null = null;
let notifChecked = false;

async function resolveNotificationsReadColumn(client: Pool) {
  if (notifChecked) return notifReadCol;
  notifChecked = true;

  try {
    const t = await client.query(`SELECT to_regclass('public.notifications') AS r`);
    if (!t.rows?.[0]?.r) return (notifReadCol = null);

    const cols = await client.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='notifications'
        AND column_name IN ('is_read','read')
      `
    );

    const names = new Set<string>((cols.rows || []).map((r: any) => r.column_name));
    if (names.has("is_read")) notifReadCol = "is_read";
    else if (names.has("read")) notifReadCol = "read";
    else notifReadCol = null;

    return notifReadCol;
  } catch {
    notifReadCol = null;
    return notifReadCol;
  }
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const role = String((session.user as any).role ?? "").toLowerCase();

  // parent sees matches tied to their wrestlers; coach sees matches tied to their needs
  const where = role === "coach" ? "m.coach_user_id = $1" : "w.parent_user_id = $1";

  try {
    const readCol = await resolveNotificationsReadColumn(pool);

    // If no notifications table/column, unread_count should just be 0
    const unreadSql = readCol
      ? `
        (
          SELECT COUNT(*)
          FROM public.notifications n
          WHERE n.user_id = $1
            AND n.type = 'message'
            AND n.link = ('/messages/match/' || m.id)
            AND (n.${readCol} = false)
        ) AS unread_count
      `
      : `0::int AS unread_count`;

    const sql = `
      SELECT
        m.id AS match_id,
        m.status,
        m.parent_ok,
        m.coach_ok,
        m.updated_at,

        -- other party display
        CASE
          WHEN $2 = 'coach' THEN p.email
          ELSE c.email
        END AS other_email,

        CASE
          WHEN $2 = 'coach' THEN COALESCE(p.firstname || ' ' || p.lastname, p.email, 'Parent')
          ELSE COALESCE(c.firstname || ' ' || c.lastname, c.email, 'Coach')
        END AS other_name,

        -- last message
        lm.messagetext AS last_message,
        lm.sentat AS last_sent_at,

        ${unreadSql}

      FROM public.matches m
      JOIN public.wrestler_interests wi ON wi.id = m.wrestler_interest_id
      JOIN public.wrestlers w           ON w.id  = wi.wrestler_id

      LEFT JOIN public.users c ON c.id = m.coach_user_id
      LEFT JOIN public.users p ON p.id = w.parent_user_id

      LEFT JOIN LATERAL (
        SELECT messagetext, sentat
        FROM public.messages
        WHERE matchid = m.id
        ORDER BY sentat DESC
        LIMIT 1
      ) lm ON true

      WHERE ${where}
      ORDER BY COALESCE(lm.sentat, m.updated_at) DESC
      LIMIT 200
    `;

    const { rows } = await pool.query(sql, [userId, role]);
    return NextResponse.json({ ok: true, conversations: rows }, { status: 200 });
  } catch (e) {
    console.error("[inbox] error", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}