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
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset your Ready Roster password</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, Helvetica, sans-serif; color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6; margin:0; padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; margin:0 auto;">
                <tr>
                  <td align="center" style="padding:24px 16px 16px 16px;">
                    <img
                      src="https://itsreadyroster.com/email-logo.png"
                      alt="Ready Roster"
                      width="80"
                      style="display:block; margin:0 auto 12px auto;"
                    />
                    <div style="font-size:12px; color:#9ca3af; margin-top:4px;">
                      Wrestling connections made simple
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 16px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb;">
                      <tr>
                        <td style="background:linear-gradient(135deg, #991b1b 0%, #dc2626 100%); padding:28px 32px;">
                          <div style="font-size:24px; font-weight:700; color:#ffffff;">
                            Reset your password
                          </div>
                          <div style="font-size:14px; color:#fee2e2; margin-top:8px;">
                            We received a request to reset your Ready Roster password.
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:32px;">
                          <p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.7;">
                            Click the button below to choose a new password. This link will expire in <strong>1 hour</strong>.
                          </p>

                          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                            <tr>
                              <td align="center" style="border-radius:10px; background-color:#dc2626;">
                                <a
                                  href="${resetUrl}"
                                  style="display:inline-block; padding:14px 22px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;"
                                >
                                  Reset Password
                                </a>
                              </td>
                            </tr>
                          </table>

                          <p style="margin:0 0 10px; font-size:14px; color:#4b5563; line-height:1.7;">
                            If the button does not work, copy and paste this link into your browser:
                          </p>

                          <p style="margin:0 0 22px; font-size:13px; word-break:break-all; line-height:1.7;">
                            <a href="${resetUrl}" style="color:#b91c1c; text-decoration:underline;">
                              ${resetUrl}
                            </a>
                          </p>

                          <div style="height:1px; background-color:#e5e7eb; margin:24px 0;"></div>

                          <p style="margin:0 0 10px; font-size:14px; color:#6b7280; line-height:1.7;">
                            If you did not request this, you can safely ignore this email.
                          </p>

                          <p style="margin:0; font-size:14px; color:#6b7280; line-height:1.7;">
                            Thanks,<br />
                            <strong style="color:#111827;">The Ready Roster Team</strong>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding:18px 16px 0 16px;">
                    <div style="font-size:12px; color:#9ca3af;">
                      Ready Roster • Wrestling connections made easier
                    </div>
                    <div style="font-size:12px; color:#9ca3af; margin-top:4px;">
                      This is an automated email. Please do not reply.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function buildResetEmailText(resetUrl: string) {
  return [
    "Ready Roster",
    "",
    "Reset your password",
    "",
    "We received a request to reset your Ready Roster password.",
    "",
    "Use the link below to choose a new password:",
    resetUrl,
    "",
    "This link will expire in 1 hour.",
    "",
    "If you did not request this, you can safely ignore this email.",
    "",
    "The Ready Roster Team",
  ].join("\n");
}

async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!resend || !emailFrom) {
    console.log("[forgot-password] Email provider not configured.");
    console.log("[forgot-password] Reset URL:", resetUrl);
    return;
  }

  const result = await resend.emails.send({
    from: emailFrom,
    to,
    subject: "Reset your Ready Roster password",
    html: buildResetEmailHtml(resetUrl),
    text: buildResetEmailText(resetUrl),
  });

  console.log("[forgot-password] resend result:", result);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();

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

    if (userResult.rowCount === 0) {
      return successResponse();
    }

    const user = userResult.rows[0];
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

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

    return NextResponse.json(
      {
        ok: true,
        message: "If an account exists for that email, we sent a password reset link.",
      },
      { status: 200 }
    );
  }
}