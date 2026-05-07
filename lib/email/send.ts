/**
 * Minimal Resend client. Best-effort — never throws, returns a boolean.
 *
 * Env contract:
 *   RESEND_API_KEY   — required to actually send. Without it, sendEmail is a
 *                      no-op that returns false (so a missing key in dev /
 *                      preview never breaks the calling route).
 *   EMAIL_FROM       — optional. Defaults to "WorkInCafé <noreply@workin.cafe>".
 *                      Must be a verified sender on the Resend account.
 *
 * See #22.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'WorkInCafé <noreply@workin.cafe>';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback. Optional but recommended for deliverability. */
  text?: string;
  /** Override the From header. Defaults to `EMAIL_FROM` env, then DEFAULT_FROM. */
  from?: string;
  /** Reply-To header. Optional. */
  replyTo?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = input.from ?? process.env.EMAIL_FROM ?? DEFAULT_FROM;

  try {
    const resp = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    return resp.ok;
  } catch {
    // Network errors and the like — best-effort, swallow.
    return false;
  }
}
