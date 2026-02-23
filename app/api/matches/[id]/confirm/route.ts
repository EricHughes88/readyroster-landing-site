import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* Notifications helper (handles read vs is_read)                      */
/* ------------------------------------------------------------------ */

let notifReadCol: "is_read" | "read" | null = null;
let notifChecked = false;

async function resolveNotificationsReadColumn() {
  if (notifChecked) return notifReadCol;
  notifChecked = true;

  try {
    const t = await pool.query(`SELECT to_regclass('public.notifications') AS r`);
    if (!t.rows?.[0]?.r) return (notifReadCol = null);

    const cols = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='notifications'
        AND column_name IN ('is_read','read')
      `
    );

    const names = new Set<string>((cols.rows || []).map((r: any) => r.column_name));
    if (names.has("is_read")) notifReadCol = "is_read";
    else if (names.has("read")) notifReadCol = "read";
    else notifReadCol = null;

    return notifReadCol;
  } catch {
    notifReadCol = null;
    return notifReadCol;
  }
}

async function createNotification(args: {
  userId: number;
  type: string;
  title: string;
  body: string;
  link: string;
}) {
  try {
    const readCol = await resolveNotificationsReadColumn();
    if (!readCol) return;

    await pool.query(
      `
      INSERT INTO public.notifications
        (user_id, type, title, body, link, ${readCol}, created_at)
      VALUES
        ($1, $2, $3, $4, $5, false, NOW())
      `,
      [args.userId, args.type, args.title, args.body, args.link]
    );
  } catch (e) {
    console.error("[notify] createNotification failed:", e);
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/matches/:id/confirm-coach                                 */
/* ------------------------------------------------------------------ */

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const mid = Number(params.id);

  if (!Number.isFinite(mid) || mid <= 0) {
    return NextResponse.json({ ok: false, message: "Invalid matchId" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const mres = await client.query(
      `
      SELECT
        m.id,
        m.status,
        m.parent_ok,
        m.coach_ok,
        m.coach_user_id,
        wi.wrestler_id,
        w.parent_user_id
      FROM public.matches m
      JOIN public.wrestler_interests wi ON wi.id = m.wrestler_interest_id
      JOIN public.wrestlers w           ON w.id  = wi.wrestler_id
      WHERE m.id = $1
      FOR UPDATE
      `,
      [mid]
    );

    if (!mres.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, message: "Match not found" }, { status: 404 });
    }

    const row = mres.rows[0] as {
      parent_ok: boolean | null;
      parent_user_id: number | null;
    };

    const nextCoachOk = true;
    const nextParentOk = row.parent_ok ?? false;
    const willBeConfirmed = nextParentOk && nextCoachOk;

    const updated = await client.query(
      `
      UPDATE public.matches
      SET
        coach_ok = true,
        status = CASE WHEN $2 THEN 'confirmed' ELSE status END,
        confirmed_at = CASE
          WHEN $2 AND (status <> 'confirmed' OR confirmed_at IS NULL)
          THEN NOW()
          ELSE confirmed_at
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, status, parent_ok, coach_ok, confirmed_at, updated_at
      `,
      [mid, willBeConfirmed]
    );

    await client.query("COMMIT");

    const parentUserId = Number(row.parent_user_id || 0);
    if (parentUserId) {
      if (willBeConfirmed) {
        await createNotification({
          userId: parentUserId,
          type: "match_confirmed",
          title: "Match confirmed!",
          body: "Coach confirmed your match. You’re locked in for this event.",
          link: `/matches/${mid}`,
        });
      } else {
        await createNotification({
          userId: parentUserId,
          type: "coach_confirmed",
          title: "Coach confirmed",
          body: "Coach confirmed the match request. Confirm on your side to lock it in.",
          link: `/parent/matches/${mid}`,
        });
      }
    }

    return NextResponse.json({ ok: true, match: updated.rows[0] }, { status: 200 });
  } catch (e: any) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("confirm-coach error:", e);
    return NextResponse.json(
      { ok: false, message: "Failed to confirm match (coach)" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}