import type { Env } from '../env';
import type { Lead } from '../../src/shared/gallery-types';
import { DATE_RE } from '../../src/shared/gallery-types';
import { allow, clientIp, clip, errorResponse, json, readJson } from '../lib/http';
import { leadId } from '../lib/ids';
import { emailTemplate, sendEmail, sendTelegram, toWhatsAppNumber } from '../lib/notify';
import { keys, putJson } from '../lib/storage';

export const EVENT_TYPES = ['weddings', 'bar-bat-mitzvah', 'events', 'couples', 'portraits', 'corporate', 'other'] as const;

const EVENT_LABELS: Record<string, { he: string; en: string }> = {
  weddings: { he: 'חתונה', en: 'Wedding' },
  'bar-bat-mitzvah': { he: 'בר/בת מצווה', en: 'Bar/Bat Mitzvah' },
  events: { he: 'אירוע / שמחה', en: 'Celebration' },
  couples: { he: 'צילומי זוגיות', en: 'Couple session' },
  portraits: { he: 'משפחה / פורטרט', en: 'Family / portrait' },
  corporate: { he: 'אירוע עסקי', en: 'Corporate' },
  other: { he: 'אחר', en: 'Other' },
};

const isPhone = (v: string) => /^\+?\d{9,15}$/.test(v.replace(/[\s\-().]/g, ''));
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

async function verifyTurnstile(env: Env, token: string, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean };
  return data.success === true;
}

export function validateInquiry(body: Record<string, unknown>): { lead?: Omit<Lead, 'id' | 'createdAt' | 'status'>; errors: string[] } {
  const errors: string[] = [];
  const name = clip(body.name, 100);
  const phone = clip(body.phone, 40);
  const email = clip(body.email, 160);
  const eventType = clip(body.eventType, 40);
  const date = clip(body.date, 10);
  if (name.length < 2) errors.push('name');
  if (!isPhone(phone)) errors.push('phone');
  if (email && !isEmail(email)) errors.push('email');
  if (!(EVENT_TYPES as readonly string[]).includes(eventType)) errors.push('eventType');
  if (date && !DATE_RE.test(date)) errors.push('date');
  if (errors.length) return { errors };
  const utm: Record<string, string> = {};
  if (body.utm && typeof body.utm === 'object') {
    for (const [k, v] of Object.entries(body.utm as Record<string, unknown>).slice(0, 8)) {
      if (/^utm_[a-z_]{1,20}$/.test(k)) utm[k] = clip(v, 120);
    }
  }
  return {
    errors,
    lead: {
      lang: body.lang === 'en' ? 'en' : 'he',
      eventType,
      date: date || undefined,
      dateFlexible: body.dateFlexible === true,
      venue: clip(body.venue, 160) || undefined,
      guests: clip(body.guests, 20) || undefined,
      package: clip(body.package, 60) || undefined,
      addons: Array.isArray(body.addons) ? body.addons.slice(0, 20).map((a) => clip(a, 40)).filter(Boolean) : undefined,
      budget: clip(body.budget, 30) || undefined,
      name,
      phone,
      email: email || undefined,
      contactPref: clip(body.contactPref, 20) || undefined,
      source: clip(body.source, 30) || undefined,
      message: clip(body.message, 3000) || undefined,
      page: clip(body.page, 200) || undefined,
      referrer: clip(body.referrer, 300) || undefined,
      utm: Object.keys(utm).length ? utm : undefined,
      summary: clip(body.summary, 4000) || undefined,
    },
  };
}

function formatDate(date: string | undefined, lang: 'he' | 'en'): string {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00Z`);
  const greg = new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  let heb = '';
  try {
    heb = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  } catch {
    /* ignore */
  }
  return heb ? `${greg} (${heb})` : greg;
}

export function replyGreeting(lead: Pick<Lead, 'name' | 'lang' | 'eventType' | 'date'>): string {
  const first = lead.name.split(/\s+/)[0] ?? lead.name;
  const label = EVENT_LABELS[lead.eventType]?.[lead.lang] ?? '';
  if (lead.lang === 'en') {
    const when = lead.date ? ` on ${formatDate(lead.date, 'en').split(' (')[0]}` : '';
    return `Hi ${first}! It's Moshik 📸 Thank you for reaching out about your ${label.toLowerCase()}${when}. I'd love to tell you more — when is a good time to talk?`;
  }
  const when = lead.date ? ` ב־${formatDate(lead.date, 'he').split(' (')[0]}` : '';
  return `היי ${first}! כאן מושיק 📸 תודה על הפנייה לגבי ה${label}${when}. אשמח לספר לכם עוד — מתי נוח לדבר?`;
}

async function notifyLead(env: Env, lead: Lead) {
  const ev = EVENT_LABELS[lead.eventType]?.he ?? lead.eventType;
  const wa = `https://wa.me/${toWhatsAppNumber(lead.phone)}?text=${encodeURIComponent(replyGreeting(lead))}`;
  const site = (env.SITE_URL || '').replace(/\/$/, '');
  const rows: [string, string][] = [
    ['אירוע', ev],
    ['תאריך', lead.date ? formatDate(lead.date, 'he') + (lead.dateFlexible ? ' · גמיש' : '') : 'טרם נקבע'],
    ['מקום', lead.venue ?? ''],
    ['אורחים', lead.guests ?? ''],
    ['חבילה', lead.package ?? ''],
    ['תוספות', (lead.addons ?? []).join(', ')],
    ['תקציב', lead.budget ?? ''],
    ['שם', lead.name],
    ['טלפון', lead.phone],
    ['אימייל', lead.email ?? ''],
    ['העדפת קשר', lead.contactPref ?? ''],
    ['הגיעו דרך', lead.source ?? ''],
    ['הודעה', lead.message ?? ''],
    ['שפה', lead.lang === 'en' ? 'English' : 'עברית'],
  ];
  const subject = `📸 פנייה חדשה: ${ev}${lead.date ? ` · ${lead.date}` : ''} · ${lead.name}`;
  const text = [subject, '', ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), '', `וואטסאפ: ${wa}`].join('\n');
  const html = emailTemplate({
    title: `פנייה חדשה — ${ev}`,
    intro: 'מישהו מילא את טופס בדיקת התאריך באתר. כדאי לחזור מהר — זוגות סוגרים עם מי שעונה ראשון 😉',
    rows,
    actions: [
      { label: 'תשובה בוואטסאפ', href: wa },
      { label: 'חיוג', href: `tel:${lead.phone.replace(/[^\d+]/g, '')}` },
      ...(site ? [{ label: 'פתיחה בממשק הניהול', href: `${site}/admin/#/inquiries` }] : []),
    ],
    footer: 'נשלח אוטומטית מאתר מושיק',
    rtl: true,
  });
  await Promise.allSettled([sendEmail(env, { subject, html, text, replyTo: lead.email }), sendTelegram(env, text)]);
}

export async function handleInquiry(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const ip = clientIp(request);
  if (!(await allow(env.INQUIRY_LIMITER, `inq:${ip}`, { limit: 6, windowMs: 60_000 }))) return errorResponse(429, 'Too many requests', 'rate_limited');
  const body = await readJson<Record<string, unknown>>(request, 32 * 1024);

  // Spam traps: hidden honeypot field and an impossibly fast submission.
  const started = Number(body.startedAt);
  if (clip(body.company, 100) || (Number.isFinite(started) && started > 0 && Date.now() - started < 2500)) {
    return json({ ok: true, id: 'received' });
  }
  if (!(await verifyTurnstile(env, clip(body.turnstileToken, 2048), ip))) return errorResponse(403, 'Verification failed', 'captcha');

  const { lead: data, errors } = validateInquiry(body);
  if (!data) return json({ ok: false, error: 'Invalid fields', code: 'invalid', fields: errors }, { status: 400 });

  const canNotify = Boolean((env.RESEND_API_KEY && env.NOTIFY_EMAIL) || (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID));
  if (!env.BUCKET && !canNotify) return errorResponse(503, 'Inquiries are not configured', 'unavailable');

  const lead: Lead = {
    ...data,
    id: leadId(),
    status: 'new',
    createdAt: new Date().toISOString(),
    country: (request as Request & { cf?: { country?: string } }).cf?.country,
  };
  if (env.BUCKET) await putJson(env.BUCKET, keys.lead(lead.id), lead);
  ctx.waitUntil(notifyLead(env, lead).catch((err) => console.error('notify failed', err)));
  return json({ ok: true, id: lead.id });
}
