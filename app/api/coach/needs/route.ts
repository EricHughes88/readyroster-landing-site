import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "pg";
import type { PoolClient } from "pg";
import { notifyMatchesForCoachNeed } from "@/lib/matchNotifications";
import { notifyCoachFollowersOnNeedPosted } from "@/lib/notifyCoachFollowers";
import { splitWeightClasses } from "@/lib/normalization";
import { normalizeAgeGroup } from "@/lib/normalizeAgeGroup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const NewNeedSchema = z.object({
  coachUserId: z.coerce.number().int().positive(),
  event_name: z.string().min(1, "event_name is required"),
  event_date: z.union([z.string().min(1), z.date()]).optional().nullable(),
  weight_class: z.string().min(1, "weight_class is required"),
  age_group: z.string().min(1, "age_group is required"),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const coachUserId = Number(searchParams.get("coachUserId"));
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

    if (!Number.isFinite(coachUserId) || coachUserId <= 0) {
      return NextResponse.json(
        { ok: false, message: "coachUserId is required", needs: [] },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      SELECT
        cn.id,
        cn.coach_user_id,
        cn.event_name,
        cn.event_date,
        cn.weight_class,
        cn.age_group,
        cn.city,
        cn.state,
        cn.notes,
        cn.is_open,
        cn.created_at,
        CASE
          WHEN COALESCE(cn.is_open, TRUE) = FALSE THEN 'closed'
          ELSE 'open'
        END AS status
      FROM public.coach_needs cn
      WHERE cn.coach_user_id = $1
        AND COALESCE(cn.is_visible, TRUE) = TRUE
        AND (
          cn.event_date IS NULL
          OR cn.event_date::date >= CURRENT_DATE - INTERVAL '2 days'
        )
      ORDER BY
        cn.event_date ASC NULLS LAST,
        cn.created_at DESC,
        cn.id DESC
      LIMIT $2
      `,
      [coachUserId, limit]
    );

    return NextResponse.json({
      ok: true,
      needs: result.rows ?? [],
    });
  } catch (e: any) {
    console.error("coach needs GET error:", e);

    return NextResponse.json(
      {
        ok: false,
        message: e?.message ?? "Server error",
        needs: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let client: PoolClient | undefined;

  try {
    const body = await req.json().catch(() => null);
    const parsed = NewNeedSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: "Invalid input",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      coachUserId,
      event_name,
      event_date,
      weight_class,
      age_group,
      city,
      state,
      notes,
    } = parsed.data;

    const normalizedEventName = normalizeText(event_name);
    const normalizedAgeGroup = normalizeAgeGroup(age_group);
    const normalizedCity = normalizeText(city ?? "");
    const normalizedState = normalizeText(state ?? "");
    const normalizedNotes = normalizeText(notes ?? "");

    if (!normalizedAgeGroup) {
      return NextResponse.json(
        {
          ok: false,
          message: "Age group is required",
        },
        { status: 400 }
      );
    }

    const weightClasses = splitWeightClasses(weight_class);

    if (weightClasses.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "At least one weight class is required",
        },
        { status: 400 }
      );
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const coachCheck = await client.query(
      `
      SELECT id, firstname, lastname, email
      FROM public.users
      WHERE id = $1
      LIMIT 1
      `,
      [coachUserId]
    );

    if (coachCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, message: "Invalid coachUserId" },
        { status: 400 }
      );
    }

    const insertedNeeds: any[] = [];

    for (const singleWeightClass of weightClasses) {
      const result = await client.query(
        `
        INSERT INTO public.coach_needs
        (
          coach_user_id,
          event_name,
          event_date,
          weight_class,
          age_group,
          city,
          state,
          notes,
          is_visible
        )
        VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, TRUE)
        RETURNING *
        `,
        [
          coachUserId,
          normalizedEventName,
          event_date || null,
          singleWeightClass,
          normalizedAgeGroup,
          normalizedCity || null,
          normalizedState || null,
          normalizedNotes || null,
        ]
      );

      insertedNeeds.push(result.rows[0]);
    }

    await client.query("COMMIT");

    for (const insertedNeed of insertedNeeds) {
      const coachNeedId = Number(insertedNeed?.id);

      if (!Number.isFinite(coachNeedId) || coachNeedId <= 0) continue;

      await notifyMatchesForCoachNeed(coachNeedId).catch(console.error);

      await notifyCoachFollowersOnNeedPosted({
        coachUserId,
        coachNeedId,
        eventName: insertedNeed?.event_name ?? null,
        ageGroup: insertedNeed?.age_group ?? null,
        weightClass: insertedNeed?.weight_class ?? null,
      }).catch(console.error);
    }

    return NextResponse.json(
      {
        ok: true,
        ids: insertedNeeds.map((n) => n.id),
        count: insertedNeeds.length,
        needs: insertedNeeds,
        coach: coachCheck.rows[0],
      },
      { status: 201 }
    );
  } catch (e) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("coach need POST error:", e);

    return NextResponse.json(
      { ok: false, message: "Server error" },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}