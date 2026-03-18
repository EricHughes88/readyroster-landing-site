// app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const rawToken = String(body?.token ?? "").trim();
    const newPassword = String(body?.password ?? "");

    if (!rawToken) {
      return jsonError("Missing reset token.", 400);
    }

    if (!newPassword || newPassword.length < 8) {
      return jsonError("Password must be at least 8 characters long.", 400);
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const userResult = await pool.query(
      `
      SELECT id, email
      FROM users
      WHERE reset_token_hash = $1
        AND reset_token_expires_at IS NOT NULL
        AND reset_token_expires_at > NOW()
      LIMIT 1
      `,
      [tokenHash]
    );

    if (userResult.rowCount === 0) {
      return jsonError("This password reset link is invalid or has expired.", 400);
    }

    const user = userResult.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `
      UPDATE users
      SET
        password_hash = $1,
        reset_token_hash = NULL,
        reset_token_expires_at = NULL,
        password_updated_at = NOW()
      WHERE id = $2
      `,
      [passwordHash, user.id]
    );

    return NextResponse.json({
      ok: true,
      message: "Password reset successful.",
    });
  } catch (error) {
    console.error("[reset-password] POST error:", error);
    return jsonError("Unable to reset password right now.", 500);
  }
}