// app/api/interests/[interestId]/route.ts
import { NextResponse } from "next/server";
import pg from "pg";
import { z } from "zod";

const { Pool } = pg;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

// Same normalization used when creating interests
function normalizeAgeGroup(input: string): string {
  let s = (input || "").trim();
  const girls = /\bgirls?\b/i.test(s);
  s = s.replace(/\bgirls?\b/gi, "").trim();
  s = s.replace(/&/g, "and").replace(/\s+/g, " ").toLowerCase();

  const m = s.match(/\b(6|8|10|12|14)\b(?:\s*(u|and\s*under|under))?/i);
  if (m) {
    const num = m[1];
    const canonical = `${num}U`;
    return girls ? `Girls ${canonical}` : canonical;
  }
  if (/\b(high\s*school|hs)\b/i.test(s)) return girls ? "Girls HS" : "HS";
  if (/\bopen\b/i.test(s)) return girls ? "Girls Open" : "Open";

  const tidy = s.replace(/\b\w/g, (c) => c.toUpperCase());
  return girls ? `Girls ${tidy}` : tidy;
}

function toRadians(deg: number): number {
  return deg * (Math.PI / 180);
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

// -------- DELETE /api/interests/:interestId --------
export async function DELETE(
  _req: Request,
  { params }: { params: { interestId: string } }
) {
  try {
    if (!pool) return NextResponse.json({ ok: true }, { status: 200 });

    const id = Number(params.interestId);
    if (!id) {
      return NextResponse.json(
        { ok: false, message: "Invalid id" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM public.wrestler_interests WHERE id = $1`,
        [id]
      );

      if ((result.rowCount ?? 0) === 0) {
        return NextResponse.json(
          { ok: false, message: "Interest not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Interest DELETE error:", err);
    return NextResponse.json(
      { ok: false, message: "Server error" },
      { status: 500 }
    );
  }
}

// -------- PATCH /api/interests/:interestId --------
const UpdateSchema = z.object({
  eventName: z.string().min(1).optional(),
  eventDate: z.string().nullable().optional(), // YYYY-MM-DD
  weightClass: z.string().min(1).optional(),
  ageGroup: z.string().min(1).optional(),
  eventCity: z.string().min(1).optional(),
  eventState: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { interestId: string } }
) {
  try {
    if (!pool) {
      return NextResponse.json(
        { ok: false, message: "DB not configured" },
        { status: 500 }
      );
    }

    const id = Number(params.interestId);
    if (!id) {
      return NextResponse.json(
        { ok: false, message: "Invalid id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const existingRes = await client.query<{
        id: number;
        wrestler_id: number;
        event_city: string | null;
        event_state: string | null;
      }>(
        `
        SELECT id, wrestler_id, event_city, event_state
        FROM public.wrestler_interests
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      if (existingRes.rows.length === 0) {
        return NextResponse.json(
          { ok: false, message: "Interest not found" },
          { status: 404 }
        );
      }

      const existing = existingRes.rows[0];

      const updates: string[] = [];
      const values: any[] = [];
      let i = 1;

      if (parsed.data.eventName !== undefined) {
        updates.push(`event_name = $${i++}`);
        values.push(parsed.data.eventName);
      }

      if (parsed.data.eventDate !== undefined) {
        updates.push(`event_date = $${i++}`);
        values.push(parsed.data.eventDate || null);
      }

      if (parsed.data.weightClass !== undefined) {
        updates.push(`weight_class = $${i++}`);
        values.push(parsed.data.weightClass);
      }

      if (parsed.data.ageGroup !== undefined) {
        updates.push(`age_group = $${i++}`);
        values.push(normalizeAgeGroup(parsed.data.ageGroup));
      }

      if (parsed.data.eventCity !== undefined) {
        updates.push(`event_city = $${i++}`);
        values.push(parsed.data.eventCity);
      }

      if (parsed.data.eventState !== undefined) {
        updates.push(`event_state = $${i++}`);
        values.push(parsed.data.eventState);
      }

      if (parsed.data.notes !== undefined) {
        updates.push(`notes = $${i++}`);
        values.push(parsed.data.notes ?? null);
      }

      if (updates.length === 0) {
        return NextResponse.json(
          { ok: false, message: "Nothing to update" },
          { status: 400 }
        );
      }

      const finalEventCity =
        parsed.data.eventCity !== undefined
          ? parsed.data.eventCity
          : (existing.event_city ?? "");

      const finalEventState =
        parsed.data.eventState !== undefined
          ? parsed.data.eventState
          : (existing.event_state ?? "");

      let travelMiles: number | null = null;

      if (finalEventCity && finalEventState) {
        const wrestlerRes = await client.query<{
          city: string | null;
          state: string | null;
        }>(
          `
          SELECT city, state
          FROM public.wrestlers
          WHERE id = $1
          LIMIT 1
          `,
          [existing.wrestler_id]
        );

        const homeCity = String(wrestlerRes.rows[0]?.city ?? "").trim();
        const homeState = String(wrestlerRes.rows[0]?.state ?? "").trim();

        if (homeCity && homeState) {
          try {
            const [homeCoords, eventCoords] = await Promise.all([
              geocodeCityState(homeCity, homeState),
              geocodeCityState(finalEventCity, finalEventState),
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
            console.error("Interest PATCH travel calculation failed:", geoErr);
          }
        }
      }

      updates.push(`travel_miles = $${i++}`);
      values.push(travelMiles);

      values.push(id);

      const sql = `
        UPDATE public.wrestler_interests
        SET ${updates.join(", ")}
        WHERE id = $${i}
      `;

      const result = await client.query(sql, values);

      if ((result.rowCount ?? 0) === 0) {
        return NextResponse.json(
          { ok: false, message: "Interest not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { ok: true, travel_miles: travelMiles },
        { status: 200 }
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Interest PATCH error:", err);
    return NextResponse.json(
      { ok: false, message: "Server error" },
      { status: 500 }
    );
  }
}