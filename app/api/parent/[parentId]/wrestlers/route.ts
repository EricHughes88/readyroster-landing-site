// app/api/parent/[parentId]/wrestlers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth"; // make sure this path matches your auth config
import { Pool } from "pg";

let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

/**
 * GET /api/parent/:parentId/wrestlers
 * Returns all wrestlers belonging to the logged-in parent (by parent_user_id).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { parentId: string } }
) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { ok: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    const sessionUserId = Number(session.user.id);
    const parentId = Number(params.parentId);

    if (!parentId || Number.isNaN(parentId)) {
      return NextResponse.json(
        { ok: false, message: "Invalid parent id" },
        { status: 400 }
      );
    }

    // Safety: only allow a parent to fetch their own wrestlers
    if (parentId !== sessionUserId) {
      return NextResponse.json(
        { ok: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const db = getPool();

    // Filter by parent_user_id (your actual column)
    // age_group / weight_class are returned as NULL for now unless you add them.
    const { rows } = await db.query(
      `
      SELECT
        id,
        first_name,
        last_name,
        NULL::text AS age_group,
        NULL::text AS weight_class
      FROM wrestlers
      WHERE parent_user_id = $1
      ORDER BY id DESC;
      `,
      [parentId]
    );

    return NextResponse.json(
      { ok: true, wrestlers: rows },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error in GET /api/parent/[parentId]/wrestlers:", err);
    return NextResponse.json(
      {
        ok: false,
        message: "Internal server error",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
