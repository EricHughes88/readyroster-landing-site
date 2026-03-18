// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

function successResponse() {
  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, we sent a password reset link.",
  });
}

function buildResetEmailHtml(resetUrl: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 8px;">Reset your Ready Roster password</h2>
      <p style="margin: 0 0 16px;">
        We received a request to reset your password.
      </p>
      <p style="margin: 0 0 16px;">
        Click the button below to choose a new password:
      </p>
      <p style="margin: 0 0 24px;">
        <a
          href="${resetUrl}"
          style="
            display: inline-block;
            background: #dc2626;
            color: #ffffff;
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 8px;
            font-weight: 600;
          "
        >
          Reset Password
        </a>
      </p>
      <p style="margin: 0 0 12px;">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin: 0 0 24px; word-break: break-all;">
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
      <p style="margin: 0 0 8px; color: #6b7280;">
        This link will expire in 1 hour.
      </p>
      <p style="margin: 0; color: #6b7280;">
        If you did not request a password reset, you can safely ignore this email.
      </p>
    </div>
  `;
}

function buildResetEmailText(resetUrl: string) {
  return [
    "Reset your Ready Roster password",
    "",
    "We received a request to reset your password.",
    "",
    `Reset your password here: ${resetUrl}`,
    "",
    "This link will expire in 1 hour.",
    "If you did not request a password reset, you can safely ignore this email.",
  ].join("\n");
}

async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!resend || !emailFrom) {
    console.log("[forgot-password] Email provider not configured.");
    console.log("[forgot-password] Reset URL:", resetUrl);
    return;
  }

  await resend.emails.send({
    from: emailFrom,
    to,
    subject: "Reset your Ready Roster password",
    html: buildResetEmailHtml(resetUrl),
    text: buildResetEmailText(resetUrl),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "")
      .trim()
      .toLowerCase();

    if (!email) {
      return successResponse();
    }

    const userResult = await pool.query(
      `
      SELECT id, email
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [email]
    );

    // Always return the same success response so we don't reveal whether the email exists
    if (userResult.rowCount === 0) {
      return successResponse();
    }

    const user = userResult.rows[0];
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await pool.query(
      `
      UPDATE users
      SET
        reset_token_hash = $1,
        reset_token_expires_at = $2
      WHERE id = $3
      `,
      [tokenHash, expiresAt, user.id]
    );

    const resetUrl = `${appBaseUrl}/reset-password?token=${encodeURIComponent(
      rawToken
    )}`;

    await sendPasswordResetEmail(user.email, resetUrl);

    return successResponse();
  } catch (error) {
    console.error("[forgot-password] POST error:", error);

    // Keep the response generic for security
    return NextResponse.json(
      {
        ok: true,
        message: "If an account exists for that email, we sent a password reset link.",
      },
      { status: 200 }
    );
  }
}