import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) return jsonError("Invalid id", 400);

    const sql = `
      SELECT
        id,
        first_name,
        last_name,
        city,
        state,
        dob,
        parent_user_id,
        parent_firstname,
        parent_lastname,
        parent_email,
        parent_phone
      FROM public.admin_athletes_directory
      WHERE id = $1
      LIMIT 1;
    `;

    const res = await pool.query(sql, [id]);
    const row = res.rows?.[0] ?? null;

    return NextResponse.json({ ok: true, row });
  } catch (e: any) {
    console.error("[admin/athletes/:id] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}