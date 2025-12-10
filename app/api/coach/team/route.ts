// app/api/coach/team/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

type TeamRow = {
  teamid: number;
  teamname: string | null;
  coach_name: string | null;
  contactemail: string | null;
  logopath: string | null;
};

// GET: fetch current coach's team profile
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const userId = Number((session.user as any).id);
  if (!Number.isFinite(userId)) {
    return jsonError("Invalid user id on session", 400);
  }

  try {
    const { rows } = await pool.query<TeamRow>(
      `
      SELECT teamid, teamname, coach_name, contactemail, logopath
      FROM teams
      WHERE userid = $1
      LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) {
      return NextResponse.json(
        {
          ok: true,
          team: null,
        },
        { status: 200 }
      );
    }

    const t = rows[0];

    return NextResponse.json(
      {
        ok: true,
        team: {
          id: t.teamid,
          teamName: t.teamname,
          coachName: t.coach_name,
          contactEmail: t.contactemail,
          logoPath: t.logopath,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /api/coach/team error", err);
    return jsonError("Failed to load team profile", 500, {
      message: String(err?.message ?? err),
    });
  }
}

// POST: create or update current coach's team profile
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const userId = Number((session.user as any).id);
  if (!Number.isFinite(userId)) {
    return jsonError("Invalid user id on session", 400);
  }

  let body: {
    teamName?: string;
    coachName?: string;
    contactEmail?: string;
    logoPath?: string;
  };

  try {
    body = (await req.json()) ?? {};
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const teamName = (body.teamName ?? "").trim();
  const coachName = (body.coachName ?? "").trim();
  const contactEmail = (body.contactEmail ?? "").trim();
  const logoPath = (body.logoPath ?? "").trim() || null;

  if (!teamName) {
    return jsonError("Team name is required", 400);
  }

  try {
    // Check if a team already exists for this coach (userid)
    const existing = await pool.query<{ teamid: number }>(
      `
      SELECT teamid
      FROM teams
      WHERE userid = $1
      LIMIT 1
      `,
      [userId]
    );

    let saved: TeamRow;

    if (existing.rows.length) {
      // Update existing
      const { rows } = await pool.query<TeamRow>(
        `
        UPDATE teams
        SET teamname = $1,
            coach_name = $2,
            contactemail = $3,
            logopath = $4
        WHERE userid = $5
        RETURNING teamid, teamname, coach_name, contactemail, logopath
        `,
        [teamName, coachName || null, contactEmail || null, logoPath, userId]
      );
      saved = rows[0];
    } else {
      // Insert new
      const { rows } = await pool.query<TeamRow>(
        `
        INSERT INTO teams (teamname, coach_name, contactemail, userid, logopath)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING teamid, teamname, coach_name, contactemail, logopath
        `,
        [teamName, coachName || null, contactEmail || null, userId, logoPath]
      );
      saved = rows[0];
    }

    return NextResponse.json(
      {
        ok: true,
        team: {
          id: saved.teamid,
          teamName: saved.teamname,
          coachName: saved.coach_name,
          contactEmail: saved.contactemail,
          logoPath: saved.logopath,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("POST /api/coach/team error", err);
    return jsonError("Failed to save team profile", 500, {
      message: String(err?.message ?? err),
    });
  }
}
