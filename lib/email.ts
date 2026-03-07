import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

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