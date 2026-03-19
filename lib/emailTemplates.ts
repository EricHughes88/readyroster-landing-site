// lib/emailTemplates.ts

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function wrapEmail(args: {
  title: string;
  subtitle?: string;
  preheader?: string;
  bodyHtml: string;
}) {
  const subtitle = safeStr(args.subtitle);
  const preheader = safeStr(args.preheader);

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

function primaryButton(label: string, href?: string) {
  if (!safeStr(href)) return "";

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

function buildDetailsTable(
  rows: Array<{ label: string; value: string | null | undefined }>
) {
  return rows
    .filter((row) => safeStr(row.value))
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
}

export function matchFoundParentEmail(args: {
  parentName?: string | null;
  wrestlerName: string;
  eventName?: string | null;
  coachName?: string | null;
  teamName?: string | null;
  matchUrl?: string;
}) {
  const parentName = safeStr(args.parentName) || "there";
  const wrestlerName = safeStr(args.wrestlerName) || "your wrestler";
  const eventName = safeStr(args.eventName) || "N/A";
  const coachName = safeStr(args.coachName) || "N/A";
  const teamName = safeStr(args.teamName) || "N/A";
  const matchUrl = safeStr(args.matchUrl);

  const subject = `New match found for ${wrestlerName}`;

  const detailsHtml = buildDetailsTable([
    { label: "Athlete", value: wrestlerName },
    { label: "Event", value: eventName },
    { label: "Coach", value: coachName },
    { label: "Team", value: teamName },
  ]);

  const html = wrapEmail({
    title: "New Match Found",
    subtitle: "A coach match is now available to review.",
    preheader: `Ready Roster found a potential match for ${wrestlerName}.`,
    bodyHtml: `
      <p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.7;">
        Hi ${escapeHtml(parentName)},
      </p>

      <p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.7;">
        Ready Roster found a potential match for <strong>${escapeHtml(
          wrestlerName
        )}</strong>.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 8px 0;">
        ${detailsHtml}
      </table>

      <p style="margin:16px 0 0 0; font-size:14px; color:#4b5563; line-height:1.7;">
        Review the opportunity to see whether it is a good fit.
      </p>

      ${primaryButton("View Match", matchUrl)}

      ${
        matchUrl
          ? `
        <p style="margin:0 0 10px; font-size:14px; color:#6b7280; line-height:1.7;">
          If the button does not work, copy and paste this link into your browser:
        </p>

        <p style="margin:0 0 22px; font-size:13px; word-break:break-all; line-height:1.7;">
          <a href="${matchUrl}" style="color:#b91c1c; text-decoration:underline;">
            ${escapeHtml(matchUrl)}
          </a>
        </p>
      `
          : ""
      }

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
    "New Match Found",
    "",
    `Hi ${parentName},`,
    "",
    `Ready Roster found a potential match for ${wrestlerName}.`,
    "",
    `Athlete: ${wrestlerName}`,
    `Event: ${eventName}`,
    `Coach: ${coachName}`,
    `Team: ${teamName}`,
    "",
    "Review the opportunity to see whether it is a good fit.",
    ...(matchUrl ? ["", `View Match: ${matchUrl}`] : []),
    "",
    "The Ready Roster Team",
  ].join("\n");

  return { subject, html, text };
}

export function matchFoundCoachEmail(args: {
  coachName?: string | null;
  wrestlerName: string;
  eventName?: string | null;
  parentName?: string | null;
  matchUrl?: string;
}) {
  const coachName = safeStr(args.coachName) || "Coach";
  const wrestlerName = safeStr(args.wrestlerName) || "athlete";
  const eventName = safeStr(args.eventName) || "N/A";
  const parentName = safeStr(args.parentName) || "N/A";
  const matchUrl = safeStr(args.matchUrl);

  const subject = `New athlete candidate for ${eventName}`;

  const detailsHtml = buildDetailsTable([
    { label: "Athlete", value: wrestlerName },
    { label: "Event", value: eventName },
    { label: "Parent", value: parentName },
  ]);

  const html = wrapEmail({
    title: "New Athlete Candidate",
    subtitle: "A new match was found for your team need.",
    preheader: `Ready Roster found a new athlete candidate for ${eventName}.`,
    bodyHtml: `
      <p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.7;">
        Hi ${escapeHtml(coachName)},
      </p>

      <p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.7;">
        A new athlete candidate was found for your team need.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 8px 0;">
        ${detailsHtml}
      </table>

      <p style="margin:16px 0 0 0; font-size:14px; color:#4b5563; line-height:1.7;">
        Review this candidate to decide whether you want to move forward.
      </p>

      ${primaryButton("Review Candidate", matchUrl)}

      ${
        matchUrl
          ? `
        <p style="margin:0 0 10px; font-size:14px; color:#6b7280; line-height:1.7;">
          If the button does not work, copy and paste this link into your browser:
        </p>

        <p style="margin:0 0 22px; font-size:13px; word-break:break-all; line-height:1.7;">
          <a href="${matchUrl}" style="color:#b91c1c; text-decoration:underline;">
            ${escapeHtml(matchUrl)}
          </a>
        </p>
      `
          : ""
      }

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
    "New Athlete Candidate",
    "",
    `Hi ${coachName},`,
    "",
    "A new athlete candidate was found for your team need.",
    "",
    `Athlete: ${wrestlerName}`,
    `Event: ${eventName}`,
    `Parent: ${parentName}`,
    "",
    "Review this candidate to decide whether you want to move forward.",
    ...(matchUrl ? ["", `Review Candidate: ${matchUrl}`] : []),
    "",
    "The Ready Roster Team",
  ].join("\n");

  return { subject, html, text };
}