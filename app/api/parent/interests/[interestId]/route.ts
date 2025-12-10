// app/api/parent/interests/[interestId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Check if a column exists on a table
async function colExists(client: any, table: string, col: string) {
  const q = `
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = $1
       AND column_name  = $2
     LIMIT 1
  `;
  const r = await client.query(q, [table, col]);
  return r.rows.length > 0;
}

/**
 * DELETE /api/parent/interests/:interestId
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { interestId: string } }
) {
  const user = await getSessionUser();
  if (!user?.id) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const interestId = Number(params.interestId);
  if (!interestId) {
    return NextResponse.json({ ok: false, message: "Invalid interestId" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Verify ownership
    const iRes = await client.query(
      `
      SELECT pi.id, pi.wrestler_id, w.parent_user_id
        FROM parent_interests pi
        JOIN wrestlers w ON w.id = pi.wrestler_id
       WHERE pi.id = $1
      `,
      [interestId]
    );
    const I = iRes.rows[0];
    if (!I) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, message: "Interest not found" }, { status: 404 });
    }
    if (Number(I.parent_user_id) !== Number(user.id)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    // 2) Determine which FK column the matches table uses
    const hasWrestlerInterestId = await colExists(client, "matches", "wrestler_interest_id");
    const hasInterestId = await colExists(client, "matches", "interest_id");
    const interestCol = hasWrestlerInterestId
      ? "wrestler_interest_id"
      : hasInterestId
      ? "interest_id"
      : null;

    // 3) Block if any confirmed matches reference this interest
    if (interestCol) {
      const confirmed = await client.query(
        `SELECT 1 FROM matches WHERE ${interestCol} = $1 AND status = 'confirmed' LIMIT 1`,
        [interestId]
      );
      if (confirmed.rows.length > 0) { // <— use rows.length instead of rowCount
        await client.query("ROLLBACK");
        return NextResponse.json(
          { ok: false, message: "Cannot delete an interest with confirmed matches. Cancel those first." },
          { status: 409 }
        );
      }

      // 4) Remove non-confirmed matches referencing this interest
      await client.query(
        `DELETE FROM matches WHERE ${interestCol} = $1 AND COALESCE(status,'pending') <> 'confirmed'`,
        [interestId]
      );
    }

    // 5) Delete the interest
    await client.query(`DELETE FROM parent_interests WHERE id = $1`, [interestId]);

    await client.query("COMMIT");
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err?.code === "23503") {
      return NextResponse.json(
        { ok: false, message: "This interest is still referenced by other records." },
        { status: 409 }
      );
    }
    console.error("DELETE /api/parent/interests/:id failed:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
