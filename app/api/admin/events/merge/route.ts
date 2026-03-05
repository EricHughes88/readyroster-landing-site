import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const runtime = "nodejs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user) {
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();

    const fromName = String(body?.fromName ?? "").trim();
    const toName = String(body?.toName ?? "").trim();

    if (!fromName || !toName) {
      return jsonError("Missing event names", 400);
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
        UPDATE coach_needs
        SET event_name = $1
        WHERE event_name = $2
        `,
        [toName, fromName]
      );

      await client.query(
        `
        UPDATE wrestler_interests
        SET event_name = $1
        WHERE event_name = $2
        `,
        [toName, fromName]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return NextResponse.json({
      ok: true,
      message: "Events merged successfully",
    });
  } catch (e: any) {
    console.error("merge events error:", e);
    return jsonError(e?.message || "Server error", 500);
  }
}