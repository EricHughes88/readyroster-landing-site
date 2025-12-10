import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!pool) return NextResponse.json({ ok: true, messages: [] }, { status: 200 });
  const { id } = await ctx.params;
  const matchId = Number(id);
  const client = await pool.connect();
  try {
    const mr = await client.query(`SELECT status FROM public.matches WHERE id = $1`, [matchId]);
    if (mr.rowCount === 0) return NextResponse.json({ ok: false, message: "Match not found" }, { status: 404 });
    if (mr.rows[0].status !== "confirmed") return NextResponse.json({ ok: false, message: "Not confirmed" }, { status: 403 });

    // return your messages for this match…
    return NextResponse.json({ ok: true, messages: [] }, { status: 200 });
  } finally {
    client.release();
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!pool) return NextResponse.json({ ok: true }, { status: 200 });
  const { id } = await ctx.params;
  const matchId = Number(id);
  const client = await pool.connect();
  try {
    const mr = await client.query(`SELECT status FROM public.matches WHERE id = $1`, [matchId]);
    if (mr.rowCount === 0) return NextResponse.json({ ok: false, message: "Match not found" }, { status: 404 });
    if (mr.rows[0].status !== "confirmed") return NextResponse.json({ ok: false, message: "Not confirmed" }, { status: 403 });

    // read body, insert message tied to matchId…
    return NextResponse.json({ ok: true }, { status: 201 });
  } finally {
    client.release();
  }
}
