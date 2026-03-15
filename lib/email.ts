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

  const loginUrl = `${appBaseUrl}/login`;

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
        style="background:#b91c1c;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">
        View Opportunities
      </a>
    </p>

    <p>— Ready Roster</p>
  </div>
  `;

  const text = `
Ready Roster Recruiting Alert

Hello ${name},

Ready Roster found a recruiting opportunity.

Event: ${eventName}
Event Date: ${formattedDate}
Weight Class: ${weightClass}
Age Group: ${ageGroup}

View opportunities:
${loginUrl}

— Ready Roster
`;

  return sendTransactionalEmail({
    to,
    subject,
    html,
    text,
  });
}