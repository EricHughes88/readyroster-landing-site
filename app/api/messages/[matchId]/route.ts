// app/api/messages/[matchId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/* ------------------------------------------------------------------ */
/* Display Name Helper (uses your ACTUAL DB columns: firstname/lastname) */
/* ------------------------------------------------------------------ */
async function getUserDisplayName(
  client: Pool,
  userId?: number | null,
  fallbackRoleLabel?: string
): Promise<string | null> {
  if (!userId) return fallbackRoleLabel ?? null;

  try {
    const r = await client.query<{
      firstname: string | null;
      lastname: string | null;
      email: string | null;
      role: string | null;
    }>(
      `
      SELECT firstname, lastname, email, role
      FROM public.users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    const u = r.rows[0];
    if (!u) return fallbackRoleLabel ?? `User #${userId}`;

    // Prefer real first + last name
    const full = `${u.firstname ?? ""} ${u.lastname ?? ""}`.trim();
    if (full) return full;

    // Next fallback: email prefix
    if (u.email) {
      const base = u.email.split("@")[0];
      if (base) return base.charAt(0).toUpperCase() + base.slice(1);
    }

    // Last fallback: role label
    const role = String(u.role ?? "");
    if (role === "Coach") return "Coach";
    if (role === "Parent") return "Parent";

    return fallbackRoleLabel ?? `User #${userId}`;
  } catch {
    return fallbackRoleLabel ?? `User #${userId}`;
  }
}

/* ------------------------------------------------------------------ */
/* Notifications: create MESSAGE notification (adds RETURNING + logs)  */
/* columns: user_id, type, title, body, link, is_read, created_at      */
/* ------------------------------------------------------------------ */
async function createMessageNotification(args: {
  client: Pool;
  receiverUserId: number;
  matchId: number;
  fromName: string;
  text: string;
}) {
  try {
    const preview =
      args.text.length > 80 ? args.text.slice(0, 77) + "…" : args.text;

    const link = `/messages/match/${args.matchId}`;

    console.log("[notify] inserting notification", {
      receiverUserId: args.receiverUserId,
      link,
    });

    const ins = await args.client.query(
      `
      INSERT INTO public.notifications
        (user_id, type, title, body, link, is_read, created_at)
      VALUES
        ($1, 'message', $2, $3, $4, false, NOW())
      RETURNING id, user_id, type, link, is_read, created_at
      `,
      [args.receiverUserId, "New message", `${args.fromName}: ${preview}`, link]
    );

    console.log("[notify] inserted OK", ins.rows?.[0]);
  } catch (e) {
    console.error("[notify] createMessageNotification failed:", e);
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/messages/[matchId]                                         */
/* Returns: viewer, participants (coach+parent), messages[]            */
/* ------------------------------------------------------------------ */
export async function GET(
  _req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const matchId = Number(params.matchId);
  if (!Number.isFinite(matchId) || matchId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid match id" },
      { status: 400 }
    );
  }

  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const viewerId = Number(session.user.id);
  const viewerRole = (session.user as any).role as string | undefined;

  try {
    const client = pool;

    // Load match -> resolve coach_user_id (fallback via coach_need_id)
    const matchRes = await client.query<{ coach_user_id: number | null }>(
      `
      SELECT
        COALESCE(m.coach_user_id, cn.coach_user_id) AS coach_user_id
      FROM public.matches m
      LEFT JOIN public.coach_needs cn ON cn.id = m.coach_need_id
      WHERE m.id = $1
      LIMIT 1
      `,
      [matchId]
    );

    if (!matchRes.rows.length) {
      return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });
    }

    const { coach_user_id } = matchRes.rows[0];

    // Coach display name
    const coachName = await getUserDisplayName(client, coach_user_id, "Coach");

    // Parent display name: if viewer is parent, that's viewer. Otherwise look it up via wrestlers.
    let parentId: number | null = null;
    let parentName: string | null = "Parent";

    if (String(viewerRole ?? "") === "Parent") {
      parentId = viewerId;
      parentName = await getUserDisplayName(client, parentId, "Parent");
    } else {
      const pres = await client.query<{ parent_user_id: number | null }>(
        `
        SELECT w.parent_user_id
        FROM public.matches m
        JOIN public.wrestler_interests wi ON wi.id = m.wrestler_interest_id
        JOIN public.wrestlers w           ON w.id  = wi.wrestler_id
        WHERE m.id = $1
        LIMIT 1
        `,
        [matchId]
      );

      parentId = pres.rows?.[0]?.parent_user_id ?? null;
      parentName = await getUserDisplayName(client, parentId, "Parent");
    }

    // Load messages
    const messagesRes = await client.query<{
      messageid: number;
      matchid: number;
      senderid: number | null;
      receiverid: number | null;
      messagetext: string | null;
      sentat: string | null;
    }>(
      `
      SELECT messageid, matchid, senderid, receiverid, messagetext, sentat
      FROM public.messages
      WHERE matchid = $1
      ORDER BY sentat ASC
      `,
      [matchId]
    );

    const messages = (messagesRes.rows || []).map((m) => ({
      id: m.messageid,
      match_id: m.matchid,
      sender_id: m.senderid,
      receiver_id: m.receiverid,
      message_text: m.messagetext ?? "",
      sent_at: m.sentat,
    }));

    return NextResponse.json(
      {
        ok: true,
        viewer: { id: viewerId, role: viewerRole ?? null },
        participants: {
          coach: { id: coach_user_id, name: coachName },
          parent: { id: parentId, name: parentName },
        },
        messages,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/messages/:matchId] error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/messages/[matchId]                                        */
/* Inserts message + creates notification for other user               */
/* ------------------------------------------------------------------ */
export async function POST(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  console.log(">>> HIT /api/messages/[matchId] POST (with notifications) <<<");

  const matchId = Number(params.matchId);
  if (!Number.isFinite(matchId) || matchId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid match id" }, { status: 400 });
  }

  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const senderId = Number(session.user.id);
  const senderRole = String((session.user as any).role ?? "").toLowerCase();

  try {
    const body = await req.json();
    const text = String(body.text ?? "").trim();

    if (!text) {
      return NextResponse.json({ ok: false, error: "Message text required" }, { status: 400 });
    }

    // Load match => coach_user_id + parent_user_id
    // coach_user_id falls back to coach_needs via coach_need_id (fixes NULL coach_user_id matches)
    const matchRes = await pool.query<{
      coach_user_id: number | null;
      parent_user_id: number | null;
    }>(
      `
      SELECT
        COALESCE(m.coach_user_id, cn.coach_user_id) AS coach_user_id,
        w.parent_user_id
      FROM public.matches m
      LEFT JOIN public.coach_needs cn      ON cn.id = m.coach_need_id
      JOIN public.wrestler_interests wi    ON wi.id = m.wrestler_interest_id
      JOIN public.wrestlers w              ON w.id  = wi.wrestler_id
      WHERE m.id = $1
      LIMIT 1
      `,
      [matchId]
    );

    console.log("[msg] match lookup result", matchRes.rows?.[0]);

    if (!matchRes.rows.length) {
      return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });
    }

    const { coach_user_id, parent_user_id } = matchRes.rows[0];

    // Receiver = opposite party
    const receiverId =
      senderRole === "coach" ? (parent_user_id ?? null) : (coach_user_id ?? null);

    console.log("[msg] receiverId resolved", receiverId);

    // Insert message
    const inserted = await pool.query<{
      messageid: number;
      matchid: number;
      senderid: number | null;
      receiverid: number | null;
      messagetext: string | null;
      sentat: string | null;
    }>(
      `
      INSERT INTO public.messages (matchid, senderid, receiverid, messagetext, sentat)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING messageid, matchid, senderid, receiverid, messagetext, sentat
      `,
      [matchId, senderId, receiverId, text]
    );

    // Create notification for receiver (non-blocking)
    if (receiverId) {
      const fromName =
        (await getUserDisplayName(
          pool,
          senderId,
          senderRole === "coach" ? "Coach" : "Parent"
        )) || (senderRole === "coach" ? "Coach" : "Parent");

      await createMessageNotification({
        client: pool,
        receiverUserId: receiverId,
        matchId,
        fromName,
        text,
      });
    } else {
      console.log("[notify] skipped (receiverId is null)");
    }

    const m = inserted.rows[0];

    return NextResponse.json(
      {
        ok: true,
        message: {
          id: m.messageid,
          match_id: m.matchid,
          sender_id: m.senderid,
          receiver_id: m.receiverid,
          message_text: m.messagetext ?? "",
          sent_at: m.sentat,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/messages/:matchId] error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}