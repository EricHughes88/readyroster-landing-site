import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET() {
  const sql = `
    SELECT DISTINCT UPPER(TRIM(state)) AS state
    FROM public.admin_athletes_directory
    WHERE state IS NOT NULL AND TRIM(state) <> ''
    ORDER BY state;
  `;

  const res = await pool.query(sql);
  const states = (res.rows || []).map((r: any) => r.state).filter(Boolean);

  return NextResponse.json({ ok: true, states });
}