// app/api/admin/coaches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export type AdminCoachRow = {
  id: number;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;

  teamid: number | null;
  teamname: string | null;
  coach_name: string | null;
  contactemail: string | null;
  logopath: string | null;
  city: string | null;
  state: string | null;

  // ✅ NEW
  needs_count: number;
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authConfig);
    const role = (session as any)?.user?.role;

    if (!session || role !== "Admin") {
      return jsonError("Unauthorized", 401);
    }

    const url = new URL(req.url);
    const state = (url.searchParams.get("state") || "").trim();

    const params: any[] = [];
    let whereState = "";

    if (state && state !== "ALL") {
      params.push(state);
      whereState = ` AND COALESCE(t.state,'') = $${params.length}`;
    }

    // NOTE: teams columns:
    // teamid, teamname, coach_name, contactemail, userid, logopath, city, state
    const q = `
      SELECT
        u.id,
        u.firstname,
        u.lastname,
        u.email,
        u.phone,
        u.created_at,

        t.teamid,
        t.teamname,
        t.coach_name,
        t.contactemail,
        t.logopath,
        t.city,
        t.state,

        COALESCE(n.needs_count, 0)::int AS needs_count

      FROM public.users u
      JOIN public.teams t
        ON t.userid = u.id

      LEFT JOIN (
        SELECT coach_user_id, COUNT(*) AS needs_count
        FROM public.coach_needs
        GROUP BY coach_user_id
      ) n
        ON n.coach_user_id = u.id

      WHERE u.role = 'Coach'
      ${whereState}

      ORDER BY
        COALESCE(t.state, '') ASC,
        COALESCE(t.teamname, '') ASC,
        u.id ASC
    `;

    const r = await pool.query<AdminCoachRow>(q, params);

    return NextResponse.json({ ok: true, coaches: r.rows });
  } catch (err: any) {
    return jsonError("Failed to load coaches", 500, {
      message: String(err?.message || err),
    });
  }
}