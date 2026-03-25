import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { normalizeAgeGroup } from "@/lib/normalizeAgeGroup";

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
  age_group_key: string | null;
  notes: string | null;
  match_id?: number | null;
  match_status?: "pending" | "confirmed" | "declined" | "cancelled" | null;
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

function normalizeEventName(value?: string | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeWeightClass(value?: string | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/lbs?/g, "")
    .replace(/[^a-z0-9,]+/g, "");
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
      // 1) Load need only if it is still visible/current
      const needRes = await client.query(
        `
        SELECT
          id,
          coach_user_id,
          event_name,
          event_date,
          age_group,
          age_group_key,
          weight_class,
          city,
          state,
          notes,
          is_visible,
          expired_at
        FROM coach_needs
        WHERE id = $1
          AND COALESCE(is_visible, TRUE) = TRUE
          AND (
            event_date IS NULL
            OR event_date::date >= CURRENT_DATE - INTERVAL '2 days'
          )
        `,
        [needId]
      );

      if (needRes.rowCount === 0) {
        return jsonError("Need not found or no longer active.", 404);
      }

      const need = needRes.rows[0];

      const needAgeKey =
        need.age_group_key ?? normalizeAgeGroup(need.age_group) ?? null;

      const needEventKey = normalizeEventName(need.event_name);
      const needWeightKey = normalizeWeightClass(need.weight_class);

      // 2) Pull possible interests using normalized event + weight matching.
      //    Age group is finalized in JS so older rows without age_group_key still match.
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
          wi.age_group_key,
          wi.notes,
          m.id     AS match_id,
          m.status AS match_status,
          m.parent_ok,
          m.coach_ok
        FROM wrestler_interests wi
        LEFT JOIN matches m
          ON m.wrestler_interest_id = wi.id
         AND m.coach_need_id = $1
        LEFT JOIN wrestlers w
          ON w.id = wi.wrestler_id
        WHERE LOWER(REGEXP_REPLACE(COALESCE(wi.event_name, ''), '[^a-z0-9]+', '', 'g')) =
              LOWER(REGEXP_REPLACE(COALESCE($2, ''), '[^a-z0-9]+', '', 'g'))
          AND regexp_replace(
                regexp_replace(LOWER(COALESCE(wi.weight_class, '')), 'lbs?', '', 'g'),
                '[^a-z0-9,]+',
                '',
                'g'
              ) =
              regexp_replace(
                regexp_replace(LOWER(COALESCE($3, '')), 'lbs?', '', 'g'),
                '[^a-z0-9,]+',
                '',
                'g'
              )
          AND COALESCE(wi.is_visible, TRUE) = TRUE
          AND (
            wi.event_date IS NULL
            OR wi.event_date::date >= CURRENT_DATE - INTERVAL '2 days'
          )
        ORDER BY
          (m.id IS NOT NULL) DESC,
          w.last_name NULLS LAST,
          w.first_name NULLS LAST,
          wi.id DESC
        `,
        [needId, need.event_name ?? "", need.weight_class ?? ""]
      );

      const candidates = (matchesRes.rows ?? []).filter((row) => {
        const candidateAgeKey =
          row.age_group_key ?? normalizeAgeGroup(row.age_group) ?? null;

        // Primary: normalized key match
        if (needAgeKey && candidateAgeKey) {
          return candidateAgeKey === needAgeKey;
        }

        // Fallback: compare numeric-only age bucket
        const needDigits = String(need.age_group ?? "").replace(/[^0-9]+/g, "");
        const candidateDigits = String(row.age_group ?? "").replace(
          /[^0-9]+/g,
          ""
        );

        if (needDigits && candidateDigits) {
          return needDigits === candidateDigits;
        }

        // Final fallback: raw normalized helper
        return normalizeAgeGroup(row.age_group) === normalizeAgeGroup(need.age_group);
      });

      return NextResponse.json<ApiResponse>(
        {
          ok: true,
          need: {
            ...need,
            event_name_key: needEventKey,
            weight_class_key: needWeightKey,
            age_group_key: needAgeKey,
          },
          candidates,
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