import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

const EVENT_KEY_SQL = (col: string) => `
  TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        LOWER(COALESCE(${col}, '')),
        '[^a-z0-9\\s]+',
        '',
        'g'
      ),
      '\\s+',
      ' ',
      'g'
    )
  )
`;

function normalizeKey(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSuperEmails(): string[] {
  return String(process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;
    const email = String(session?.user?.email ?? "").toLowerCase();
    const role = String(session?.user?.role ?? "").toLowerCase();

    const allowed =
      !!session?.user &&
      (role === "admin" ||
        role === "super_admin" ||
        getSuperEmails().includes(email));

    if (!allowed) {
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();

    const fromName = String(body?.fromName ?? "").trim();
    const toName = String(body?.toName ?? "").trim();

    if (!fromName || !toName) {
      return jsonError("Missing event names", 400);
    }

    if (fromName === toName) {
      return jsonError("Merge FROM and TO must be different", 400);
    }

    const fromKey = normalizeKey(fromName);
    const toKey = normalizeKey(toName);

    if (!fromKey || !toKey) {
      return jsonError("Invalid event names", 400);
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const coachNeedsRes = await client.query(
        `
        UPDATE public.coach_needs
        SET event_name = $1
        WHERE ${EVENT_KEY_SQL("event_name")} = $2
        `,
        [toName, fromKey]
      );

      const interestsRes = await client.query(
        `
        UPDATE public.wrestler_interests
        SET event_name = $1
        WHERE ${EVENT_KEY_SQL("event_name")} = $2
        `,
        [toName, fromKey]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        ok: true,
        message: "Events merged successfully",
        updated: {
          coach_needs: coachNeedsRes.rowCount ?? 0,
          wrestler_interests: interestsRes.rowCount ?? 0,
          total:
            (coachNeedsRes.rowCount ?? 0) + (interestsRes.rowCount ?? 0),
        },
        merge: {
          fromName,
          toName,
          fromKey,
          toKey,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.error("merge events error:", e);
    return jsonError(e?.message || "Server error", 500, {
      pg: { message: e?.message, code: e?.code },
    });
  }
}