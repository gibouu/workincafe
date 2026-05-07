/**
 * HTML / text bodies for the two claim-decision emails. Inline-styled so they
 * render the same in clients that strip <style> blocks. See #22.
 */

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://workin.cafe';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '"' ? '&quot;' :
    '&#39;',
  );
}

function shell(bodyHtml: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:32px auto;padding:32px;background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;">
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0 20px;"/>
    <p style="margin:0;font-size:12px;color:#71717a;">Sent by WorkInCafé. <a href="${APP_BASE_URL}" style="color:#71717a;text-decoration:underline;">workin.cafe</a></p>
  </div>
</body></html>`;
}

export interface ClaimApprovedInput {
  to: string;
  placeName: string;
  placeId: string;
}

export function claimApprovedEmail({ placeName, placeId }: ClaimApprovedInput) {
  const ownerLink = `${APP_BASE_URL}/owner/places/${encodeURIComponent(placeId)}`;
  const safePlace = escapeHtml(placeName);
  const subject = `You're now the owner of ${placeName} on WorkInCafé`;
  const html = shell(`
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">You're now the owner of <span style="color:#0a84ff;">${safePlace}</span></h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3f3f46;">
      Your ownership claim was approved. From your owner dashboard you can post deals, view analytics on visits and reviews, and respond to live updates.
    </p>
    <p style="margin:24px 0;">
      <a href="${ownerLink}" style="display:inline-block;background:#0a84ff;color:#ffffff;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:12px;font-size:15px;">Open your dashboard</a>
    </p>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.55;">
      If the button doesn't work, paste this link into your browser:<br/>
      <span style="color:#3f3f46;">${ownerLink}</span>
    </p>
  `);
  const text =
    `You're now the owner of ${placeName} on WorkInCafé.\n\n` +
    `Open your dashboard: ${ownerLink}\n\n` +
    `From there you can post deals, view analytics, and respond to live updates.`;
  return { subject, html, text };
}

export interface ClaimRejectedInput {
  to: string;
  placeName: string;
  reason?: string | null;
}

export function claimRejectedEmail({ placeName, reason }: ClaimRejectedInput) {
  const safePlace = escapeHtml(placeName);
  const safeReason = reason ? escapeHtml(reason) : '';
  const subject = `${placeName} ownership claim — update`;
  const reasonBlock = safeReason
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3f3f46;">
         <strong style="color:#0f172a;">Reason from the reviewer:</strong><br/>
         <em>${safeReason}</em>
       </p>`
    : '';
  const html = shell(`
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${safePlace} — claim update</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3f3f46;">
      We've reviewed your ownership claim and weren't able to approve it at this time.
    </p>
    ${reasonBlock}
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#3f3f46;">
      If you can provide additional proof — a recent invoice, a domain-matching email, or a photo of you at the place with proof of management — you can submit a new claim from the place card.
    </p>
    <p style="margin:24px 0;">
      <a href="${APP_BASE_URL}" style="display:inline-block;background:#0a84ff;color:#ffffff;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:12px;font-size:15px;">Open WorkInCafé</a>
    </p>
  `);
  const text =
    `Your ownership claim for ${placeName} wasn't approved.\n` +
    (reason ? `\nReason: ${reason}\n` : '') +
    `\nIf you can provide additional proof, you can submit a new claim from the place's card on WorkInCafé.\n${APP_BASE_URL}`;
  return { subject, html, text };
}
