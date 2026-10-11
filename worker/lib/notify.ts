import type { Env } from '../env';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function sendEmail(env: Env, msg: { subject: string; html: string; text: string; replyTo?: string }): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Moshik Website <onboarding@resend.dev>',
      to: env.NOTIFY_EMAIL.split(',').map((s) => s.trim()).filter(Boolean),
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      reply_to: msg.replyTo || undefined,
    }),
  });
  if (!res.ok) console.error('Resend error', res.status, await res.text().catch(() => ''));
  return res.ok;
}

export async function sendTelegram(env: Env, text: string): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: text.slice(0, 4000), disable_web_page_preview: true }),
  });
  if (!res.ok) console.error('Telegram error', res.status, await res.text().catch(() => ''));
  return res.ok;
}

/** Israeli numbers → international digits for wa.me (0501234567 → 972501234567). */
export function toWhatsAppNumber(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `972${digits.slice(1)}`;
  return digits;
}

/** Simple branded HTML email with rows of label/value pairs and action buttons. */
export function emailTemplate(opts: { title: string; intro?: string; rows: [string, string][]; actions?: { label: string; href: string }[]; footer?: string; rtl?: boolean }): string {
  const dir = opts.rtl ? 'rtl' : 'ltr';
  const align = opts.rtl ? 'right' : 'left';
  const rows = opts.rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#6c625a;font-size:13px;width:34%;vertical-align:top;text-align:${align}">${esc(k)}</td><td style="padding:8px 0;color:#161311;font-size:15px;text-align:${align};white-space:pre-wrap">${esc(v)}</td></tr>`,
    )
    .join('');
  const actions = (opts.actions ?? [])
    .map((a) => `<a href="${esc(a.href)}" style="display:inline-block;margin:6px 4px;padding:12px 20px;background:#161311;color:#f6f2ec;text-decoration:none;font-size:13px;letter-spacing:.08em">${esc(a.label)}</a>`)
    .join('');
  return `<!doctype html><html dir="${dir}"><body style="margin:0;background:#f6f2ec;font-family:Assistant,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf9;border:1px solid #e2d6c6">
<tr><td style="padding:28px 32px;border-bottom:1px solid #ede6dc;text-align:center;font-family:Georgia,serif;letter-spacing:.4em;font-size:20px;color:#161311">MOSHIK</td></tr>
<tr><td style="padding:28px 32px;text-align:${align}" dir="${dir}">
<h1 style="margin:0 0 8px;font-family:Georgia,serif;font-weight:400;font-size:24px;color:#161311">${esc(opts.title)}</h1>
${opts.intro ? `<p style="margin:0 0 18px;color:#3b342f;font-size:15px">${esc(opts.intro)}</p>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
${actions ? `<div style="margin-top:22px;text-align:center">${actions}</div>` : ''}
</td></tr>
${opts.footer ? `<tr><td style="padding:16px 32px;border-top:1px solid #ede6dc;color:#8a8076;font-size:12px;text-align:center">${esc(opts.footer)}</td></tr>` : ''}
</table></td></tr></table></body></html>`;
}
