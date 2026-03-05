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

async function requireSuperAdmin() {
  // ✅ Force a usable type so session.user.email doesn't error in TS
  const session = (await getServerSession(authConfig as any)) as any;

  const email = String(session?.user?.email ?? "").toLowerCase();
  if (!email) return { ok: false as const, status: 401, message: "Unauthorized" };

  const supers = getSuperEmails();
  if (!supers.includes(email)) {
    return { ok: false as const, status: 403, message: "Forbidden" };
  }

  return { ok: true as const, email };
}

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return jsonError(guard.message, guard.status);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const fromName = String(body?.fromName ?? "").trim();
  const toName = String(body?.toName ?? "").trim();

  if (!fromName || !toName) {
    return jsonError("fromName and toName are required", 400);
  }
  if (fromName === toName) {
    return jsonError("fromName and toName must differ", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const a = await client.query(
      `UPDATE coach_needs
       SET event_name = $1
       WHERE event_name = $2`,
      [toName, fromName]
    );

    const b = await client.query(
      `UPDATE wrestler_interests
       SET event_name = $1
       WHERE event_name = $2`,
      [toName, fromName]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      fromName,
      toName,
      updated: {
        coach_needs: a.rowCount ?? 0,
        wrestler_interests: b.rowCount ?? 0,
      },
    });
  } catch (e: any) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    return jsonError("Merge failed", 500, e?.message ?? e);
  } finally {
    client.release();
  }
}