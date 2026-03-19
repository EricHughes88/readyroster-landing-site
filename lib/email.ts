// lib/email.ts
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type RecruitingAlertArgs = {
  to: string;
  recipientName?: string | null;
  athleteName?: string | null;
  eventName: string;
  eventDate?: string | null;
  eventState?: string | null;
  weightClass: string;
  ageGroup: string;
  wave?: "state" | "national" | null;
  waveLabel?: string | null;
  matchUrl?: string | null;
};

type CoachLeadEmailArgs = {
  to: string;
  coachName?: string | null;
  eventName: string;
  leads: Array<{
    athleteName: string;
    weightClass: string;
    ageGroup: string;
    state?: string | null;
  }>;
};

function formatDate(value?: string | null) {
  if (!value) return "TBD";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPrimaryButton(label: string, href: string) {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
      <tr>
        <td align="center" style="border-radius:10px; background-color:#dc2626;">
          <a
            href="${href}"
            style="display:inline-block; padding:14px 22px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;"
          >
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function buildEmailShell(args: {
  preheader?: string;
  title: string;
  subtitle?: string;
  bodyHtml: string;
}) {
  const preheader = safeStr(args.preheader);
  const subtitle = safeStr(args.subtitle);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(args.title)}</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, Helvetica, sans-serif; color:#111827;">
        ${
          preheader
            ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${escapeHtml(
                preheader
              )}</div>`
            : ""
        }

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
                            ${escapeHtml(args.title)}
                          </div>
                          ${
                            subtitle
                              ? `<div style="font-size:14px; color:#fee2e2; margin-top:8px;">
                                   ${escapeHtml(subtitle)}
                                 </div>`
                              : ""
                          }
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:32px;">
                          ${args.bodyHtml}
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

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
}: SendEmailArgs) {
  if (!resend || !emailFrom) {
    console.warn("Email not configured: missing RESEND_API_KEY or EMAIL_FROM");
    return {
      ok: false,
      error: "Email not configured",
    };
  }

  try {
    const result = await resend.emails.send({
      from: emailFrom,
      to,
      subject,
      html,
      text,
    });

    if (result.error) {
      return {
        ok: false,
        error: result.error.message,
      };
    }

    return {
      ok: true,
      data: result.data,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message ?? "Unknown email error",
    };
  }
}

/*
----------------------------------------------------
Recruiting Alert Email
Used by the Recruiting Alerts engine
----------------------------------------------------
*/

export async function sendRecruitingAlertEmail({
  to,
  recipientName,
  athleteName,
  eventName,
  eventDate,
  eventState,
  weightClass,
  ageGroup,
  wave,
  waveLabel,
  matchUrl,
}: RecruitingAlertArgs) {
  const name = safeStr(recipientName) || "there";
  const athlete = safeStr(athleteName) || "your athlete";
  const formattedDate = formatDate(eventDate);
  const location = safeStr(eventState);
  const destinationUrl =
    safeStr(matchUrl) || `${normalizeBaseUrl(appBaseUrl)}/login`;

  const computedWaveLabel =
    safeStr(waveLabel) ||
    (wave === "state"
      ? "State Match Window"
      : wave === "national"
      ? "National Match Window"
      : "Recruiting Opportunity");

  const subject = `New match opportunity for ${eventName} • ${weightClass}`;

  const detailsRows = [
    { label: "Event", value: eventName },
    { label: "Event Date", value: formattedDate },
    { label: "Weight Class", value: weightClass },
    { label: "Age Group", value: ageGroup },
    ...(location ? [{ label: "State", value: location }] : []),
    { label: "Window", value: computedWaveLabel },
  ]
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 0; font-size:14px; color:#6b7280; width:120px; vertical-align:top;">
            <strong>${escapeHtml(row.label)}:</strong>
          </td>
          <td style="padding:8px 0; font-size:14px; color:#111827; vertical-align:top;">
            ${escapeHtml(row.value)}
          </td>
        </tr>
      `
    )
    .join("");

  const html = buildEmailShell({
    preheader: `Ready Roster found a new match opportunity for ${athlete} at ${eventName}.`,
    title: "New Match Opportunity",
    subtitle: "A coach is actively recruiting in this division.",
    bodyHtml: `
      <p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.7;">
        Hello ${escapeHtml(name)},
      </p>

      <p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.7;">
        Ready Roster found a potential recruiting opportunity for <strong>${escapeHtml(
          athlete
        )}</strong>.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 8px 0;">
        ${detailsRows}
      </table>

      <p style="margin:16px 0 0 0; font-size:14px; color:#4b5563; line-height:1.7;">
        This alert was generated based on a coach need and previous Ready Roster activity in this weight class and age group.
      </p>

      <p style="margin:16px 0 0 0; font-size:14px; color:#4b5563; line-height:1.7;">
        Opportunities can move quickly, so it is a good idea to review this one soon.
      </p>

      ${buildPrimaryButton("View Match Opportunity", destinationUrl)}

      <p style="margin:0 0 10px; font-size:14px; color:#6b7280; line-height:1.7;">
        If the button does not work, copy and paste this link into your browser:
      </p>

      <p style="margin:0 0 22px; font-size:13px; word-break:break-all; line-height:1.7;">
        <a href="${destinationUrl}" style="color:#b91c1c; text-decoration:underline;">
          ${escapeHtml(destinationUrl)}
        </a>
      </p>

      <div style="height:1px; background-color:#e5e7eb; margin:24px 0;"></div>

      <p style="margin:0; font-size:14px; color:#6b7280; line-height:1.7;">
        Thanks,<br />
        <strong style="color:#111827;">The Ready Roster Team</strong>
      </p>
    `,
  });

  const text = [
    "Ready Roster",
    "",
    "New Match Opportunity",
    "",
    `Hello ${name},`,
    "",
    `Ready Roster found a potential recruiting opportunity for ${athlete}.`,
    "",
    `Event: ${eventName}`,
    `Event Date: ${formattedDate}`,
    `Weight Class: ${weightClass}`,
    `Age Group: ${ageGroup}`,
    ...(location ? [`State: ${location}`] : []),
    `Window: ${computedWaveLabel}`,
    "",
    "This alert was generated based on a coach need and previous Ready Roster activity in this weight class and age group.",
    "Opportunities can move quickly, so it is a good idea to review this one soon.",
    "",
    "View match opportunity:",
    destinationUrl,
    "",
    "The Ready Roster Team",
  ].join("\n");

  return sendTransactionalEmail({
    to,
    subject,
    html,
    text,
  });
}

/*
----------------------------------------------------
Coach Leads Email
Used by the Coach Leads engine
----------------------------------------------------
*/

export async function sendCoachLeadsEmail({
  to,
  coachName,
  eventName,
  leads,
}: CoachLeadEmailArgs) {
  const name = coachName || "Coach";
  const loginUrl = `${normalizeBaseUrl(appBaseUrl)}/login`;

  const subject = `New recruiting leads for ${eventName}`;

  const safeLeads = leads.slice(0, 5);

  const leadsHtml = safeLeads
    .map((lead) => {
      const athleteName = safeStr(lead.athleteName) || "Athlete";
      const weightClass = safeStr(lead.weightClass) || "Unknown weight";
      const ageGroup = safeStr(lead.ageGroup) || "Unknown age group";
      const state = safeStr(lead.state);

      return `
        <li style="margin-bottom:8px">
          <strong>${escapeHtml(athleteName)}</strong> — ${escapeHtml(
        weightClass
      )}, ${escapeHtml(ageGroup)}${state ? `, ${escapeHtml(state)}` : ""}
        </li>
      `;
    })
    .join("");

  const leadsText = safeLeads
    .map((lead) => {
      const athleteName = safeStr(lead.athleteName) || "Athlete";
      const weightClass = safeStr(lead.weightClass) || "Unknown weight";
      const ageGroup = safeStr(lead.ageGroup) || "Unknown age group";
      const state = safeStr(lead.state);

      return `- ${athleteName} — ${weightClass}, ${ageGroup}${
        state ? `, ${state}` : ""
      }`;
    })
    .join("\n");

  const html = buildEmailShell({
    preheader: `Ready Roster found new recruiting leads for ${eventName}.`,
    title: "New Recruiting Leads",
    subtitle: eventName,
    bodyHtml: `
      <p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.7;">
        Hello ${escapeHtml(name)},
      </p>

      <p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.7;">
        Ready Roster found new recruiting leads for <strong>${escapeHtml(
          eventName
        )}</strong>.
      </p>

      ${
        safeLeads.length > 0
          ? `
        <ul style="padding-left:18px; margin:0 0 18px 0; color:#374151; line-height:1.7;">
          ${leadsHtml}
        </ul>
        `
          : `
        <p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.7;">
          No new leads were found at this time.
        </p>
        `
      }

      ${buildPrimaryButton("View Leads", loginUrl)}

      <p style="margin:0; font-size:14px; color:#6b7280; line-height:1.7;">
        Thanks,<br />
        <strong style="color:#111827;">The Ready Roster Team</strong>
      </p>
    `,
  });

  const text = `Hello ${name},

Ready Roster found new recruiting leads for ${eventName}.

${safeLeads.length > 0 ? leadsText : "No new leads were found at this time."}

View leads:
${loginUrl}

The Ready Roster Team`;

  return sendTransactionalEmail({
    to,
    subject,
    html,
    text,
  });
}