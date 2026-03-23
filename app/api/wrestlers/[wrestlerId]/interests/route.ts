// app/api/wrestlers/[wrestlerId]/interests/route.ts
import { NextResponse } from "next/server";
import pg from "pg";
import { z } from "zod";
import { notifyMatchesForInterest } from "@/lib/matchEngine";
import { notifyAthleteFollowersOnNewInterest } from "@/lib/notifyAthleteFollowers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { Pool } = pg;
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

/* ---------- Helpers ---------- */

function toRadians(deg: number) {
  return deg * (Math.PI / 180);
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

async function geocodeCityState(city: string, state: string) {
  const query = `${city}, ${state}`;
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=` +
    encodeURIComponent(query);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "ReadyRoster/1.0",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Geocoding failed with status ${res.status}`);
  }

  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(data) || data.length === 0) return null;

  const lat = Number(data[0].lat);
  const lon = Number(data[0].lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon };
}

/* ---------- Schemas ---------- */

const CreateSchema = z.object({
  eventName: z.string().min(1),
  eventDate: z.string().trim().optional().nullable(),
  weightClass: z.string().min(1),
  ageGroup: z.string().min(1),
  eventCity: z.string().min(1),
  eventState: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const SORT_WHITELIST = new Map<string, string>([
  ["event_name", "event_name"],
  ["event_date", "event_date"],
  ["weight_class", "weight_class"],
  ["age_group", "age_group"],
  ["travel_miles", "travel_miles"],
  ["created_at", "created_at"],
]);

/* ---------- GET: list interests for one wrestler ---------- */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ wrestlerId: string }> }
) {
  try {
    if (!pool) {
      return NextResponse.json({
        ok: true,
        interests: [],
        page: { limit: 10, offset: 0, total: 0 },
      });
    }

    const { wrestlerId } = await ctx.params;
    const wid = Number(wrestlerId);

    if (!Number.isFinite(wid) || wid <= 0) {
      return NextResponse.json(
        { ok: false, message: "Invalid wrestler id" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const eventName = url.searchParams.get("eventName") || "";
    const ageGroup = url.searchParams.get("ageGroup") || "";
    const onlyOk = url.searchParams.get("onlyOk") || "";
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") || 10), 1),
      100
    );
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

    let sortCol = "created_at";
    let sortDir: "asc" | "desc" = "desc";
    const sortRaw = url.searchParams.get("sort") || "";

    if (sortRaw) {
      const [c, d] = sortRaw.split(":");
      const col = SORT_WHITELIST.get(c || "");
      const dir = (d || "").toLowerCase() === "asc" ? "asc" : "desc";
      if (col) {
        sortCol = col;
        sortDir = dir;
      }
    }

    const where: string[] = [
      "wrestler_id = $1",
      "COALESCE(is_visible, TRUE) = TRUE",
      "(event_date IS NULL OR event_date::date >= CURRENT_DATE - INTERVAL '2 days')",
    ];

    const params: any[] = [wid];

    if (eventName) {
      params.push(`%${eventName}%`);
      where.push("event_name ILIKE $" + params.length);
    }

    if (ageGroup) {
      params.push(`%${ageGroup}%`);
      where.push("age_group ILIKE $" + params.length);
    }

    if (onlyOk === "parent") where.push("COALESCE(parent_ok, false) = true");
    if (onlyOk === "coach") where.push("COALESCE(coach_ok, false) = true");

    const whereSql = "WHERE " + where.join(" AND ");

    const client = await pool.connect();
    try {
      const countRes = await client.query(
        `
        SELECT COUNT(*)::int AS c
        FROM public.wrestler_interests
        ${whereSql}
        `,
        params
      );
      const total = countRes.rows[0]?.c ?? 0;

      const queryParams = [...params, limit, offset];

      const res = await client.query(
        `
        SELECT
          id,
          wrestler_id,
          event_name,
          event_date,
          weight_class,
          age_group,
          notes,
          event_city,
          event_state,
          travel_miles,
          parent_ok,
          coach_ok,
          created_at,
          is_visible,
          expired_at
        FROM public.wrestler_interests
        ${whereSql}
        ORDER BY ${sortCol} ${sortDir}
        LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
        `,
        queryParams
      );

      return NextResponse.json({
        ok: true,
        interests: res.rows,
        page: { limit, offset, total },
      });
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.error("interests GET error:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

/* ---------- POST: create interest for one wrestler ---------- */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ wrestlerId: string }> }
) {
  try {
    if (!pool) {
      return NextResponse.json(
        { ok: false, message: "DB not configured" },
        { status: 500 }
      );
    }

    const { wrestlerId } = await ctx.params;
    const wid = Number(wrestlerId);

    if (!Number.isFinite(wid) || wid <= 0) {
      return NextResponse.json(
        { ok: false, message: "Invalid wrestler id" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);

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
      eventName,
      eventDate,
      weightClass,
      ageGroup,
      eventCity,
      eventState,
      notes,
    } = parsed.data;

    const client = await pool.connect();
    try {
      const wrestlerCheck = await client.query<{
        id: number;
        first_name: string | null;
        last_name: string | null;
        city: string | null;
        state: string | null;
      }>(
        `
        SELECT id, first_name, last_name, city, state
        FROM public.wrestlers
        WHERE id = $1
        LIMIT 1
        `,
        [wid]
      );

      if (wrestlerCheck.rows.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Invalid wrestler id: no matching wrestler record exists for this id.",
          },
          { status: 400 }
        );
      }

      const wrestler = wrestlerCheck.rows[0];
      const wrestlerName =
        `${String(wrestler.first_name ?? "").trim()} ${String(
          wrestler.last_name ?? ""
        ).trim()}`.trim() || "An athlete you follow";

      let travelMiles: number | null = null;

      const homeCity = String(wrestler.city ?? "").trim();
      const homeState = String(wrestler.state ?? "").trim();

      if (homeCity && homeState && eventCity && eventState) {
        try {
          const [homeCoords, eventCoords] = await Promise.all([
            geocodeCityState(homeCity, homeState),
            geocodeCityState(eventCity, eventState),
          ]);

          if (homeCoords && eventCoords) {
            travelMiles = Math.round(
              haversineMiles(
                homeCoords.lat,
                homeCoords.lon,
                eventCoords.lat,
                eventCoords.lon
              )
            );
          }
        } catch (geoErr) {
          console.error("travel distance calculation failed:", geoErr);
        }
      }

      const r = await client.query<{ id: number }>(
        `
        INSERT INTO public.wrestler_interests
          (
            wrestler_id,
            event_name,
            event_date,
            weight_class,
            age_group,
            notes,
            event_city,
            event_state,
            travel_miles,
            is_visible
          )
        VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, TRUE)
        RETURNING id
        `,
        [
          wid,
          eventName,
          eventDate || null,
          weightClass,
          ageGroup,
          notes || null,
          eventCity,
          eventState,
          travelMiles,
        ]
      );

      const interestId = Number(r.rows[0]?.id);

      if (Number.isFinite(interestId) && interestId > 0) {
        try {
          await notifyMatchesForInterest(interestId);
        } catch (matchErr) {
          console.error("notifyMatchesForInterest failed:", matchErr);
        }

        try {
          await notifyAthleteFollowersOnNewInterest({
            wrestlerId: wid,
            athleteName: wrestlerName,
            eventName,
            eventDate: eventDate || null,
            weightClass: weightClass || null,
            ageGroup: ageGroup || null,
          });
        } catch (notifyErr) {
          console.error("[notifyAthleteFollowers] failed", notifyErr);
        }
      }

      return NextResponse.json(
        {
          ok: true,
          id: interestId,
          wrestler,
          travel_miles: travelMiles,
        },
        { status: 201 }
      );
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.error("interests POST error:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Server error" },
      { status: 500 }
    );
  }
}