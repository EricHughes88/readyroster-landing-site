// app/api/views/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

declare global {
  // eslint-disable-next-line no-var
  var __RR_PG_POOL__: pg.Pool | undefined;
}

const { Pool } = pg;

function getPool(): pg.Pool {
  const conn = process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL not set");

  if (!global.__RR_PG_POOL__) {
    global.__RR_PG_POOL__ = new Pool({
      connectionString: conn,
    });
  }

  return global.__RR_PG_POOL__;
}

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendProfileViewEmail(args: {
  to: string;
  athleteName: string;
  viewerName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const activityUrl = `${appBaseUrl}/athlete?tab=activity`;

  if (!apiKey || !from) {
    return {
      ok: false as const,
      skipped: true as const,
      reason: "Missing RESEND_API_KEY or EMAIL_FROM",
    };
  }

  const subject = "A coach viewed your Ready Roster profile";

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin-bottom: 8px;">A coach viewed your profile</h2>
      <p style="margin: 0 0 12px 0;">
        <strong>${escapeHtml(args.viewerName)}</strong> viewed
        <strong>${escapeHtml(args.athleteName)}</strong>'s profile on Ready Roster.
      </p>
      <p style="margin: 0 0 18px 0;">
        Log in to see your profile activity and which coaches have viewed you.
      </p>
      <a
        href="${activityUrl}"
        style="
          display: inline-block;
          background: #dc2626;
          color: #ffffff;
          text-decoration: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 600;
        "
      >
        View Profile Activity
      </a>
    </div>
  `;

  const text = `${args.viewerName} viewed ${args.athleteName}'s profile on Ready Roster. Visit ${activityUrl} to see profile activity.`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject,
      html,
      text,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.message || "Failed to send email with Resend");
  }

  return {
    ok: true as const,
    id: data?.id ?? null,
  };
}

export async function POST(req: NextRequest) {
  const pool = getPool();

  try {
    const session = (await getServerSession(authConfig as any)) as any;

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    const targetType = String(body?.targetType ?? "").trim().toLowerCase();
    const targetId = Number(body?.targetId);

    if (!["athlete", "coach", "coach_need"].includes(targetType)) {
      return badRequest("Invalid targetType", { targetType });
    }

    if (!Number.isFinite(targetId) || targetId <= 0) {
      return badRequest("Invalid targetId", { targetId });
    }

    const rawViewerUserId = session?.user?.uid ?? session?.user?.id ?? null;
    const viewerUserId =
      rawViewerUserId === null || rawViewerUserId === undefined
        ? null
        : Number(rawViewerUserId);

    const viewerRole =
      String(session?.user?.role ?? "").trim().toLowerCase() || null;

    console.log("[api/views] start", {
      targetType,
      targetId,
      rawViewerUserId,
      viewerUserId,
      viewerRole,
    });

    const insertRes = await pool.query(
      `
      INSERT INTO public.profile_views (
        viewer_user_id,
        viewer_role,
        target_type,
        target_id
      )
      SELECT $1, $2, $3, $4
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.profile_views pv
        WHERE pv.viewer_user_id IS NOT DISTINCT FROM $1
          AND pv.target_type = $3
          AND pv.target_id = $4
          AND pv.viewed_at >= NOW() - INTERVAL '1 hour'
      )
      RETURNING id, viewed_at
      `,
      [
        Number.isFinite(viewerUserId as number) ? viewerUserId : null,
        viewerRole,
        targetType,
        targetId,
      ]
    );

    const inserted = (insertRes.rowCount ?? 0) > 0;

    let notificationCreated = false;
    let emailSent = false;
    let warning: string | null = null;

    if (
      inserted &&
      targetType === "athlete" &&
      viewerRole === "coach" &&
      Number.isFinite(viewerUserId as number)
    ) {
      try {
        const athleteRes = await pool.query(
          `
          SELECT
            w.id,
            w.first_name,
            w.last_name,
            w.parent_user_id,
            u.email AS parent_email
          FROM public.wrestlers w
          LEFT JOIN public.users u
            ON u.id = w.parent_user_id
          WHERE w.id = $1
          LIMIT 1
          `,
          [targetId]
        );

        const athlete = athleteRes.rows[0] ?? null;
        const recipientUserId = athlete?.parent_user_id ?? null;
        const recipientEmail = athlete?.parent_email ?? null;

        console.log("[api/views] athlete lookup", {
          athlete,
          recipientUserId,
          recipientEmail,
        });

        if (recipientUserId) {
          const coachRes = await pool.query(
            `
            SELECT
              u.id,
              u.firstname,
              u.lastname,
              u.email,
              t.teamname,
              t.coach_name
            FROM public.users u
            LEFT JOIN public.teams t
              ON t.userid = u.id
            WHERE u.id = $1
            LIMIT 1
            `,
            [viewerUserId]
          );

          const coach = coachRes.rows[0] ?? null;

          const viewerName =
            coach?.teamname ||
            coach?.coach_name ||
            [coach?.firstname, coach?.lastname].filter(Boolean).join(" ").trim() ||
            coach?.email ||
            "A coach";

          const athleteName =
            [athlete?.first_name, athlete?.last_name].filter(Boolean).join(" ").trim() ||
            "your athlete";

          try {
            await pool.query(
              `
              INSERT INTO public.notifications (
                user_id,
                type,
                title,
                body,
                link,
                is_read,
                created_at
              )
              SELECT $1, $2, $3, $4, $5, FALSE, NOW()
              WHERE NOT EXISTS (
                SELECT 1
                FROM public.notifications n
                WHERE n.user_id = $1
                  AND n.type = $2
                  AND n.link = $5
                  AND n.created_at >= NOW() - INTERVAL '1 hour'
              )
              `,
              [
                recipientUserId,
                "athlete_profile_view",
                "A coach viewed your profile",
                `${viewerName} viewed ${athleteName}'s profile.`,
                "/athlete?tab=activity",
              ]
            );
            notificationCreated = true;
          } catch (nErr: any) {
            console.error("[api/views] notification insert failed", {
              message: nErr?.message,
              code: nErr?.code,
              detail: nErr?.detail,
            });
            warning = `Notification failed: ${nErr?.message || "unknown error"}`;
          }

          if (recipientEmail) {
            try {
              const emailLogRes = await pool.query(
                `
                SELECT id
                FROM public.profile_view_email_log
                WHERE recipient_user_id = $1
                  AND athlete_id = $2
                  AND sent_at >= NOW() - INTERVAL '12 hours'
                ORDER BY sent_at DESC
                LIMIT 1
                `,
                [recipientUserId, targetId]
              );

              const alreadySentRecently = (emailLogRes.rowCount ?? 0) > 0;

              if (!alreadySentRecently) {
                await sendProfileViewEmail({
                  to: recipientEmail,
                  athleteName,
                  viewerName,
                });

                await pool.query(
                  `
                  INSERT INTO public.profile_view_email_log (
                    recipient_user_id,
                    athlete_id,
                    viewer_user_id,
                    sent_at
                  )
                  VALUES ($1, $2, $3, NOW())
                  `,
                  [recipientUserId, targetId, viewerUserId]
                );

                emailSent = true;
              }
            } catch (eErr: any) {
              console.error("[api/views] email flow failed", {
                message: eErr?.message,
                code: eErr?.code,
                detail: eErr?.detail,
              });
              warning = warning
                ? `${warning} | Email failed: ${eErr?.message || "unknown error"}`
                : `Email failed: ${eErr?.message || "unknown error"}`;
            }
          }
        }
      } catch (sideErr: any) {
        console.error("[api/views] side effects failed", {
          message: sideErr?.message,
          code: sideErr?.code,
          detail: sideErr?.detail,
        });
        warning = sideErr?.message || "Post-view side effects failed";
      }
    }

    return NextResponse.json({
      ok: true,
      inserted,
      notificationCreated,
      emailSent,
      warning,
      view: insertRes.rows[0] ?? null,
    });
  } catch (err: any) {
    console.error("[api/views] fatal error", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      stack: err?.stack,
    });

    return NextResponse.json(
      {
        ok: false,
        message: err?.message ?? "Failed to log view",
        pg: {
          code: err?.code ?? null,
          detail: err?.detail ?? null,
        },
      },
      { status: 500 }
    );
  }
}