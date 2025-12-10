// app/api/coach/needs/[needId]/matches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

type Candidate = {
  id: number; // wrestler_interest id
  wrestler_id: number | null;
  first_name: string | null;
  last_name: string | null;
  event_name: string | null;
  event_date: string | null;
  weight_class: string;
  age_group: string;
  notes: string | null;
  match_id?: number | null;
  match_status?: "pending" | "confirmed" | "declined" | null;
  parent_ok?: boolean | null;
  coach_ok?: boolean | null;
};

type ApiResponse = {
  ok: boolean;
  need?: any;
  candidates?: Candidate[];
  message?: string;
};

function jsonError(
  message: string,
  status = 500,
  extra?: Record<string, unknown>
) {
  return NextResponse.json<ApiResponse>(
    { ok: false, message, ...extra },
    { status }
  );
}

// GET /api/coach/needs/[needId]/matches
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ needId: string }> }
) {
  try {
    const { needId: rawNeedId } = await ctx.params;
    if (!rawNeedId) {
      return jsonError("Missing needId in route.", 400);
    }

    const needId = Number(rawNeedId);
    if (!Number.isFinite(needId) || needId <= 0) {
      return jsonError("Invalid needId. Must be a positive number.", 400, {
        needId: rawNeedId,
      });
    }

    const client = await pool.connect();
    try {
      // 1) Load the coach need record
      const needRes = await client.query(
        `
        SELECT
          id,
          coach_user_id,
          event_name,
          event_date,
          age_group,
          weight_class,
          city,
          state,
          notes
        FROM coach_needs
        WHERE id = $1
        `,
        [needId]
      );

      if (needRes.rowCount === 0) {
        return jsonError("Need not found.", 404);
      }

      const need = needRes.rows[0];

      // 2) Find wrestler interests that match this need
      const matchesRes = await client.query<Candidate>(
        `
        SELECT
          wi.id,
          wi.wrestler_id,
          w.first_name,
          w.last_name,
          wi.event_name,
          wi.event_date,
          wi.weight_class,
          wi.age_group,
          wi.notes,
          m.id          AS match_id,
          m.status      AS match_status,
          m.parent_ok,
          m.coach_ok
        FROM wrestler_interests wi
        LEFT JOIN matches m
          ON m.wrestler_interest_id = wi.id
         AND m.coach_need_id = $1
        LEFT JOIN wrestlers w
          ON w.id = wi.wrestler_id
        WHERE wi.event_name  = $2
          AND wi.weight_class = $3
          AND wi.age_group    = $4
        ORDER BY
          -- show unmatched interests first, then by name
          (m.id IS NOT NULL),
          w.last_name NULLS LAST,
          w.first_name NULLS LAST,
          wi.id DESC
        `,
        [
          needId,
          need.event_name,
          need.weight_class,
          need.age_group,
        ]
      );

      return NextResponse.json<ApiResponse>(
        {
          ok: true,
          need,
          candidates: matchesRes.rows,
        },
        { status: 200 }
      );
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("Error in /api/coach/needs/[needId]/matches:", err);
    return jsonError("Internal server error in matches route", 500, {
      error: String(err?.message ?? err),
    });
  }
}
