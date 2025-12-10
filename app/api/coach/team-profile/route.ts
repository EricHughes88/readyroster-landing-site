// app/api/coach/team-profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/* ------------------------ helpers ------------------------ */

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json(
    { ok: false, message, details: details ?? null },
    { status }
  );
}

type TeamRow = {
  teamid: number;
  teamname: string | null;
  coach_name: string | null;
  contactemail: string | null;
  logopath: string | null;
};

function mapRow(row: TeamRow | null) {
  if (!row) return null;
  return {
    teamName: row.teamname ?? "",
    coachName: row.coach_name ?? "",
    contactEmail: row.contactemail ?? "",
    logoPath: row.logopath ?? null,
  };
}

/* --------------------------- GET ------------------------- */
/* Returns the current coach's team profile                  */

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonError("Not authenticated", 401);
    }

    const coachUserId = Number(session.user.id);
    if (!coachUserId) {
      return jsonError("Invalid user id on session", 400);
    }

    const { rows } = await pool.query<TeamRow>(
      `
      SELECT teamid, teamname, coach_name, contactemail, logopath
      FROM teams
      WHERE userid = $1
      LIMIT 1
      `,
      [coachUserId]
    );

    const team = rows.length ? mapRow(rows[0]) : null;

    return NextResponse.json(
      {
        ok: true,
        team,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /api/coach/team-profile error:", err);
    return jsonError("Internal server error loading team profile", 500, {
      message: String(err?.message ?? err),
    });
  }
}

/* --------------------------- POST ------------------------ */
/* Upserts the team profile for the current coach            */

type SaveBody = {
  teamName?: string;
  coachName?: string;
  contactEmail?: string;
  logoPath?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonError("Not authenticated", 401);
    }

    const coachUserId = Number(session.user.id);
    if (!coachUserId) {
      return jsonError("Invalid user id on session", 400);
    }

    let body: SaveBody;
    try {
      body = (await req.json()) as SaveBody;
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const teamName = (body.teamName ?? "").trim();
    const coachName = (body.coachName ?? "").trim();
    const contactEmail = (body.contactEmail ?? "").trim();
    const logoPath =
      body.logoPath === undefined ? null : (body.logoPath ?? "").trim() || null;

    if (!teamName) {
      return jsonError("Team name is required", 400);
    }
    if (!coachName) {
      return jsonError("Coach name is required", 400);
    }
    if (!contactEmail) {
      return jsonError("Contact email is required", 400);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Upsert into teams table keyed by userid
      const upsertSql = `
        WITH updated AS (
          UPDATE teams
          SET teamname = $2,
              coach_name = $3,
              contactemail = $4,
              logopath = $5
          WHERE userid = $1
          RETURNING teamid, teamname, coach_name, contactemail, logopath
        )
        INSERT INTO teams (userid, teamname, coach_name, contactemail, logopath)
        SELECT $1, $2, $3, $4, $5
        WHERE NOT EXISTS (SELECT 1 FROM updated)
        RETURNING teamid, teamname, coach_name, contactemail, logopath
      `;

      const { rows } = await client.query<TeamRow>(upsertSql, [
        coachUserId,
        teamName,
        coachName,
        contactEmail,
        logoPath,
      ]);

      await client.query("COMMIT");

      const savedRow = rows[0] ?? null;
      const team = mapRow(savedRow);

      return NextResponse.json(
        {
          ok: true,
          team,
        },
        { status: 200 }
      );
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("POST /api/coach/team-profile error:", err);
      return jsonError("Error saving team profile", 500, {
        message: String(err?.message ?? err),
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("POST /api/coach/team-profile outer error:", err);
    return jsonError("Internal server error saving team profile", 500, {
      message: String(err?.message ?? err),
    });
  }
}
