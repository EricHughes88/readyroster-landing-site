import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pool } from "@/lib/db"; // <-- your existing pg Pool

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) return jsonError("Missing Authorization: Bearer <token>", 401);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Verify the token and get the logged-in user (email + uuid)
    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) return jsonError("Invalid session token", 401, error);

    const authUserId = data.user.id;     // UUID
    const email = data.user.email?.toLowerCase();

    if (!email) return jsonError("Authenticated user has no email", 400);

    const client = await pool.connect();
    try {
      await client.query("begin");

      // 1) Find legacy user by email
      const legacyRes = await client.query(
        `select id, email, auth_user_id
         from public.users
         where lower(email) = $1
         limit 1`,
        [email]
      );

      if (legacyRes.rowCount === 0) {
        // No legacy user: nothing to migrate; still OK.
        await client.query("commit");
        return NextResponse.json({ ok: true, migrated: false, reason: "no_legacy_user" });
      }

      const legacyUser = legacyRes.rows[0] as { id: number; auth_user_id: string | null };

      // 2) Save mapping onto legacy user row if not already set
      if (!legacyUser.auth_user_id) {
        await client.query(
          `update public.users
           set auth_user_id = $1
           where id = $2`,
          [authUserId, legacyUser.id]
        );
      }

      // 3) Backfill user_uuid on push_subscriptions + notifications
      const ps = await client.query(
        `update public.push_subscriptions
         set user_uuid = $1
         where user_id = $2
           and (user_uuid is null or user_uuid <> $1)`,
        [authUserId, legacyUser.id]
      );

      const nf = await client.query(
        `update public.notifications
         set user_uuid = $1
         where user_id = $2
           and (user_uuid is null or user_uuid <> $1)`,
        [authUserId, legacyUser.id]
      );

      await client.query("commit");

      return NextResponse.json({
        ok: true,
        migrated: true,
        legacyUserId: legacyUser.id,
        pushSubscriptionsUpdated: ps.rowCount,
        notificationsUpdated: nf.rowCount,
      });
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    return jsonError("Migration failed", 500, String(err));
  }
}