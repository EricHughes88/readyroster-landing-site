// app/api/messages/[matchId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ---- Display Name Helper ----
// Uses your ACTUAL database columns: firstname, lastname
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

    // 1️⃣ Prefer REAL first + last name
    if (u.firstname || u.lastname) {
      return `${u.firstname ?? ""} ${u.lastname ?? ""}`.trim();
    }

    // 2️⃣ Next fallback: email prefix
    if (u.email) {
      const base = u.email.split("@")[0];
      if (base) {
        return base.charAt(0).toUpperCase() + base.slice(1);
      }
    }

    // 3️⃣ Last fallback: role label
    if (u.role === "Coach") return "Coach";
    if (u.role === "Parent") return "Parent";

    return fallbackRoleLabel ?? `User #${userId}`;
  } catch (err) {
    return fallbackRoleLabel ?? `User #${userId}`;
  }
}

/**
 * GET /api/messages/[matchId]
 * Returns: viewer, participants (coach+parent), messages[]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const matchId = Number(params.matchId);
  if (!matchId) {
    return NextResponse.json(
      { ok: false, error: "Invalid match id" },
      { status: 400 }
    );
  }

  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const viewerId = Number(session.user.id);
  const viewerRole = (session.user as any).role as string | undefined;

  try {
    const client = pool;

    // Load match -> get coach ID
    const matchRes = await client.query<{ coach_user_id: number | null }>(
      `
      SELECT coach_user_id
      FROM public.matches
      WHERE id = $1
      `,
      [matchId]
    );

    if (!matchRes.rows.length) {
      return NextResponse.json(
        { ok: false, error: "Match not found" },
        { status: 404 }
      );
    }

    const { coach_user_id } = matchRes.rows[0];

    // ---- Load coach display name ----
    const coachName = await getUserDisplayName(client, coach_user_id, "Coach");

    // ---- Load parent display name (viewer is parent) ----
    let parentId: number | null = null;
    let parentName: string | null = "Parent";

    if (viewerRole === "Parent") {
      parentId = viewerId;
      parentName = await getUserDisplayName(client, parentId, "Parent");
    }

    // ---- Load messages ----
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

    const messages = messagesRes.rows.map((m) => ({
      id: m.messageid,
      match_id: m.matchid,
      sender_id: m.senderid,
      receiver_id: m.receiverid,
      message_text: m.messagetext ?? "",
      sent_at: m.sentat,
    }));

    // ---- Response ----
    return NextResponse.json({
      ok: true,
      viewer: {
        id: viewerId,
        role: viewerRole ?? null,
      },
      participants: {
        coach: { id: coach_user_id, name: coachName },
        parent: { id: parentId, name: parentName },
      },
      messages,
    });
  } catch (err) {
    console.error("[GET /api/messages/:matchId] error", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages/[matchId]
 * Inserts a new message.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const matchId = Number(params.matchId);
  if (!matchId) {
    return NextResponse.json(
      { ok: false, error: "Invalid match id" },
      { status: 400 }
    );
  }

  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const senderId = Number(session.user.id);

  try {
    const body = await req.json();
    const text = String(body.text ?? "").trim();

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Message text required" },
        { status: 400 }
      );
    }

    const client = pool;

    // Ensure match exists
    const matchRes = await client.query(
      `
      SELECT id
      FROM public.matches
      WHERE id = $1
      `,
      [matchId]
    );

    if (!matchRes.rows.length) {
      return NextResponse.json(
        { ok: false, error: "Match not found" },
        { status: 404 }
      );
    }

    // Insert message (receiverId = NULL for now)
    await client.query(
      `
      INSERT INTO public.messages (matchid, senderid, receiverid, messagetext, sentat)
      VALUES ($1, $2, NULL, $3, NOW())
      `,
      [matchId, senderId, text]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/messages/:matchId] error", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
