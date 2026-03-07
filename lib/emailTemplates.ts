function wrapEmail(title: string, bodyHtml: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #111;">
      <h1 style="margin: 0 0 16px; font-size: 24px;">${title}</h1>
      <div style="font-size: 16px; line-height: 1.6;">
        ${bodyHtml}
      </div>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #ddd;" />
      <p style="font-size: 13px; color: #666;">Ready Roster</p>
    </div>
  `;
}

export function matchFoundParentEmail(args: {
  parentName?: string | null;
  wrestlerName: string;
  eventName?: string | null;
  coachName?: string | null;
  teamName?: string | null;
  matchUrl?: string;
}) {
  const { parentName, wrestlerName, eventName, coachName, teamName, matchUrl } = args;

  const subject = "New Ready Roster match found";

  const html = wrapEmail(
    subject,
    `
      <p>Hi ${parentName || "there"},</p>
      <p>A potential match was found for <strong>${wrestlerName}</strong>.</p>
      <p>
        <strong>Event:</strong> ${eventName || "N/A"}<br/>
        <strong>Coach:</strong> ${coachName || "N/A"}<br/>
        <strong>Team:</strong> ${teamName || "N/A"}
      </p>
      ${
        matchUrl
          ? `<p><a href="${matchUrl}" style="display:inline-block;padding:12px 18px;background:#c1121f;color:#fff;text-decoration:none;border-radius:8px;">View Match</a></p>`
          : ""
      }
    `
  );

  const text = [
    `Hi ${parentName || "there"},`,
    `A potential match was found for ${wrestlerName}.`,
    `Event: ${eventName || "N/A"}`,
    `Coach: ${coachName || "N/A"}`,
    `Team: ${teamName || "N/A"}`,
    matchUrl ? `View Match: ${matchUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

export function matchFoundCoachEmail(args: {
  coachName?: string | null;
  wrestlerName: string;
  eventName?: string | null;
  parentName?: string | null;
  matchUrl?: string;
}) {
  const { coachName, wrestlerName, eventName, parentName, matchUrl } = args;

  const subject = "New athlete candidate found";

  const html = wrapEmail(
    subject,
    `
      <p>Hi ${coachName || "Coach"},</p>
      <p>A new athlete candidate was found for your team need.</p>
      <p>
        <strong>Athlete:</strong> ${wrestlerName}<br/>
        <strong>Event:</strong> ${eventName || "N/A"}<br/>
        <strong>Parent:</strong> ${parentName || "N/A"}
      </p>
      ${
        matchUrl
          ? `<p><a href="${matchUrl}" style="display:inline-block;padding:12px 18px;background:#003049;color:#fff;text-decoration:none;border-radius:8px;">Review Candidate</a></p>`
          : ""
      }
    `
  );

  const text = [
    `Hi ${coachName || "Coach"},`,
    `A new athlete candidate was found for your team need.`,
    `Athlete: ${wrestlerName}`,
    `Event: ${eventName || "N/A"}`,
    `Parent: ${parentName || "N/A"}`,
    matchUrl ? `Review Candidate: ${matchUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}