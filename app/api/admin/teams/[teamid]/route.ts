// app/api/admin/teams/[teamid]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

function isAdminRole(role: any) {
  const r = String(role || "").toLowerCase();
  return r === "admin";
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { teamid: string } }
) {
  const session = await getServerSession(authConfig);
  const role = (session as any)?.user?.role;

  if (!session || !isAdminRole(role)) {
    return jsonError("Unauthorized", 401);
  }

  const teamid = Number(ctx.params.teamid);
  if (!Number.isFinite(teamid) || teamid <= 0) {
    return jsonError("Invalid teamid", 400);
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  // Allow editing these columns on public.teams
  const allowed = ["teamname", "coach_name", "contactemail", "city", "state", "logopath"] as const;

  const updates: Record<string, any> = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      const v = body[k];
      // Normalize empty strings -> NULL
      updates[k] = typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v;
    }
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No valid fields to update", 400);
  }

  // Build SET clause dynamically
  const keys = Object.keys(updates);
  const setSql = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = keys.map((k) => updates[k]);

  const client = await pool.connect();
  try {
    const q = `
      UPDATE public.teams
      SET ${setSql}
      WHERE teamid = $${keys.length + 1}
      RETURNING teamid, teamname, coach_name, contactemail, city, state, logopath, userid;
    `;

    const r = await client.query(q, [...values, teamid]);

    if (r.rowCount === 0) {
      return jsonError("Team not found", 404);
    }

    return NextResponse.json({ ok: true, team: r.rows[0] });
  } catch (e: any) {
    return jsonError("Failed to update team", 500, String(e?.message || e));
  } finally {
    client.release();
  }
}