// app/api/admin/athletes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const stateRaw = (url.searchParams.get("state") || "").trim();
    const qRaw = (url.searchParams.get("q") || "").trim();

    const params: any[] = [];
    const where: string[] = [];

    // State filter (treat "All" as no filter)
    if (stateRaw && stateRaw !== "All") {
      params.push(stateRaw);
      where.push(`UPPER(TRIM(state)) = UPPER(TRIM($${params.length}))`);
    }

    // Search filter (search across multiple text-like fields)
    if (qRaw) {
      params.push(`%${qRaw}%`);
      const p = `$${params.length}`;
      where.push(`(
        COALESCE(first_name, '') ILIKE ${p} OR
        COALESCE(last_name,  '') ILIKE ${p} OR
        COALESCE(city,       '') ILIKE ${p} OR
        COALESCE(state,      '') ILIKE ${p} OR
        COALESCE(parent_email,'') ILIKE ${p} OR
        COALESCE(parent_phone,'') ILIKE ${p}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // NOTE: These columns MUST exist in your view
    const sql = `
      SELECT
        id,
        first_name,
        last_name,
        city,
        state,
        dob,
        parent_user_id,
        parent_email,
        parent_phone
      FROM public.admin_athletes_directory
      ${whereSql}
      ORDER BY last_name NULLS LAST, first_name NULLS LAST
      LIMIT 1000;
    `;

    const res = await pool.query(sql, params);

    return NextResponse.json({
      ok: true,
      rows: Array.isArray(res.rows) ? res.rows : [],
    });
  } catch (e: any) {
    console.error("[admin/athletes] error:", e);
    return jsonError("Server error", 500, e?.message ?? String(e));
  }
}