// app/api/dev/create-team-needs/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * DEV-ONLY endpoint to ensure the team_needs table exists.
 * Hit http://localhost:3000/api/dev/create-team-needs once while running `npm run dev`.
 * Then you can delete this file if you want.
 */
export async function GET() {
  // Safety guard – don’t allow this in production
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { ok: false, message: "Disabled outside development" },
      { status: 403 }
    );
  }

  const sql = `
    CREATE TABLE IF NOT EXISTS team_needs (
      id             SERIAL PRIMARY KEY,
      coach_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_name     TEXT NOT NULL,
      age_group      TEXT NOT NULL,
      weight_class   TEXT NOT NULL,
      event_date     DATE,
      city           TEXT,
      state          TEXT,
      notes          TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_team_needs_coach_user_id
      ON team_needs (coach_user_id);

    CREATE INDEX IF NOT EXISTS idx_team_needs_event_age_weight
      ON team_needs (event_name, age_group, weight_class);
  `;

  try {
    await pool.query(sql);
    return NextResponse.json(
      { ok: true, message: "team_needs table ensured" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error creating team_needs table:", err);
    return NextResponse.json(
      {
        ok: false,
        message: "Failed to create team_needs table",
        error: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}
