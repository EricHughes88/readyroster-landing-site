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
  eventName: string;
  eventDate?: string | null;
  weightClass: string;
  ageGroup: string;
  recipientName?: string | null;
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
  eventName,
  eventDate,
  weightClass,
  ageGroup,
  recipientName,
}: RecruitingAlertArgs) {
  const name = recipientName || "there";
  const formattedDate = formatDate(eventDate);
  const loginUrl = `${normalizeBaseUrl(appBaseUrl)}/login`;

  const subject = `Teams recruiting for ${eventName} (${weightClass})`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6">
    <p>Hello ${name},</p>

    <p>
      Ready Roster found a recruiting opportunity for an upcoming event.
    </p>

    <p>
      <strong>Event:</strong> ${eventName}<br/>
      <strong>Event Date:</strong> ${formattedDate}<br/>
      <strong>Weight Class:</strong> ${weightClass}<br/>
      <strong>Age Group:</strong> ${ageGroup}
    </p>

    <p>
      This alert was generated because of previous Ready Roster activity
      in this weight class and age group.
    </p>

    <p>
      <a href="${loginUrl}"
        style="background:#b91c1c;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">
        View Opportunities
      </a>
    </p>

    <p>— Ready Roster</p>
  </div>
  `;

  const text = `Ready Roster Recruiting Alert

Hello ${name},

Ready Roster found a recruiting opportunity.

Event: ${eventName}
Event Date: ${formattedDate}
Weight Class: ${weightClass}
Age Group: ${ageGroup}

View opportunities:
${loginUrl}

— Ready Roster`;

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
          <strong>${athleteName}</strong> — ${weightClass}, ${ageGroup}${
            state ? `, ${state}` : ""
          }
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

      return `- ${athleteName} — ${weightClass}, ${ageGroup}${state ? `, ${state}` : ""}`;
    })
    .join("\n");

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6">
    <p>Hello ${name},</p>

    <p>
      Ready Roster found new recruiting leads for <strong>${eventName}</strong>.
    </p>

    ${
      safeLeads.length > 0
        ? `
      <ul style="padding-left:18px">
        ${leadsHtml}
      </ul>
      `
        : `
      <p>No new leads were found at this time.</p>
      `
    }

    <p>
      <a href="${loginUrl}"
        style="background:#b91c1c;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">
        View Leads
      </a>
    </p>

    <p>— Ready Roster</p>
  </div>
  `;

  const text = `Hello ${name},

Ready Roster found new recruiting leads for ${eventName}.

${safeLeads.length > 0 ? leadsText : "No new leads were found at this time."}

View leads:
${loginUrl}

— Ready Roster`;

  return sendTransactionalEmail({
    to,
    subject,
    html,
    text,
  });
}