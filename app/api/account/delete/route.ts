import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = (await getServerSession(authConfig as any)) as any;

  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = Number(session.user.id);

  if (!userId) {
    return NextResponse.json(
      { ok: false, message: "Invalid user" },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Soft-delete the user so they can no longer log in
    const userResult = await client.query(
      `
      UPDATE public.users
      SET is_active = FALSE,
          deleted_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id
      `,
      [userId]
    );

    if (!userResult.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, message: "User not found or already deleted." },
        { status: 404 }
      );
    }

    // Hide wrestler interests owned by this user
    // Covers both older and newer schema patterns
    try {
      await client.query(
        `
        UPDATE public.wrestler_interests
        SET is_visible = FALSE,
            expired_at = NOW()
        WHERE COALESCE(is_visible, TRUE) = TRUE
          AND (
            parent_user_id = $1
            OR user_id = $1
          )
        `,
        [userId]
      );
    } catch (err) {
      console.warn("[account/delete] wrestler_interests update skipped:", err);
    }

    // Hide coach needs owned by this user
    // Covers both older and newer schema patterns
    try {
      await client.query(
        `
        UPDATE public.coach_needs
        SET is_visible = FALSE,
            expired_at = NOW()
        WHERE COALESCE(is_visible, TRUE) = TRUE
          AND (
            coach_user_id = $1
            OR user_id = $1
          )
        `,
        [userId]
      );
    } catch (err) {
      console.warn("[account/delete] coach_needs update skipped:", err);
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      message: "Account deleted successfully.",
    });
  } catch (error: any) {
    await client.query("ROLLBACK");

    console.error("[account/delete] error:", error);

    return NextResponse.json(
      { ok: false, message: error?.message || "Failed to delete account" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}