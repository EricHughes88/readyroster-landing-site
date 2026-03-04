// app/api/admin/analytics/feed/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

function getSuperEmails(): string[] {
  return String(process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Minimal session shape so TS won't treat session as {}
 */
type SessionLike =
  | {
      user?: {
        id?: number | string | null;
        email?: string | null;
        role?: string | null;
        name?: string | null;
      };
    }
  | null;

async function requireAdmin() {
  const session = (await getServerSession(authConfig as any)) as SessionLike;

  if (!session?.user) {
    return { ok: false as const, status: 401, message: "Not signed in" };
  }

  const role = String(session.user.role ?? "").trim();
  const email = String(session.user.email ?? "").trim().toLowerCase();
  const isSuper = getSuperEmails().includes(email);

  if (role !== "Admin" && !isSuper) {
    return { ok: false as const, status: 403, message: "Forbidden" };
  }

  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin();
    if (!gate.ok) return jsonError(gate.message, gate.status);

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") || 60);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(200, limitRaw))
      : 60;

    // ✅ Uses YOUR messages table columns:
    // messageid, match_id, senderid, receiverid, messagetext, sentat
    // plus "created_at" and "body" if present (your screenshot shows them).
    const sql = `
      WITH msg AS (
        SELECT
          msg.messageid::text AS id,
          'message_sent'::text AS type,
          COALESCE(msg.sentat, msg.created_at, NOW()) AS created_at,
          msg.match_id::int AS entity_id,
          jsonb_build_object(
            'match_id', msg.match_id,
            'senderid', msg.senderid,
            'receiverid', msg.receiverid
          ) AS meta,
          COALESCE(NULLIF(msg.messagetext, ''), NULLIF(msg.body, ''), '') AS message
        FROM public.messages msg
      ),
      needs AS (
        SELECT
          cn.id::text AS id,
          'need_created'::text AS type,
          cn.created_at AS created_at,
          cn.id::int AS entity_id,
          jsonb_build_object('coach_user_id', cn.coach_user_id, 'event_name', cn.event_name) AS meta,
          COALESCE(cn.notes, '') AS message
        FROM public.coach_needs cn
      ),
      interests AS (
        SELECT
          wi.id::text AS id,
          'interest_created'::text AS type,
          wi.created_at AS created_at,
          wi.id::int AS entity_id,
          jsonb_build_object('wrestler_id', wi.wrestler_id, 'event_name', wi.event_name) AS meta,
          COALESCE(wi.notes, '') AS message
        FROM public.wrestler_interests wi
      ),
      matches AS (
        SELECT
          m.id::text AS id,
          'match_created'::text AS type,
          m.created_at AS created_at,
          m.id::int AS entity_id,
          jsonb_build_object('status', m.status) AS meta,
          ''::text AS message
        FROM public.matches m
      )
      SELECT *
      FROM (
        SELECT * FROM msg
        UNION ALL
        SELECT * FROM needs
        UNION ALL
        SELECT * FROM interests
        UNION ALL
        SELECT * FROM matches
      ) x
      ORDER BY created_at DESC NULLS LAST
      LIMIT $1
    `;

    const result = await pool.query(sql, [limit]);

    return NextResponse.json({
      ok: true,
      rows: result.rows ?? [],
    });
  } catch (e: any) {
    console.error("[feed] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}